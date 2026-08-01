// v8.6 검증 — 동기화 스탬프 기반 병합 판정(진짜 충돌만 ask)·보류 지속·플러시·로그아웃 완료 화면.
// 실 OAuth 불가 → /api/auth/*·/api/me·/api/board를 route 모킹으로 주입. 서버(localhost:3000) 필요.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
const visible = (loc, timeout = 5000) =>
  loc.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);

const SESSION = {
  user: { name: '헬렌', email: 'helen@test.dev' },
  googleSub: 'sub-123',
  expires: '2099-01-01T00:00:00.000Z',
};
const ME = {
  authenticated: true,
  registered: true,
  email: 'helen@test.dev',
  marketingConsent: false,
  hasBoard: true,
  boardUpdatedAt: Date.now(),
};

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}
const board = (overrides = {}, extra = {}) => ({
  sections: seedSections(overrides),
  onboardingDone: true,
  dashboardIntroSeen: true,
  userName: '헬렌',
  startedAt: 1700000000000,
  lastVisitAt: 1700000100000,
  targetDate: '2029-07-07',
  schemaVersion: 4,
  loginNudgeSeen: true,
  storyPromptVersion: 3,
  ...extra,
});
const meaningful = (extra = {}) =>
  board({ 1: { status: 'in_progress', chatMessages: [{ role: 'user', content: '테스트 답변' }] } }, extra);

// Postgres jsonb는 키 순서를 보존하지 않는다 — 재귀 키 역순 재구성으로 동등성 비교의 순서 독립을 검증
function shuffleKeys(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(shuffleKeys);
  const out = {};
  for (const k of Object.keys(v).reverse()) out[k] = shuffleKeys(v[k]);
  return out;
}

const browser = await chromium.launch();

// stamps: { rev, syncedLocalRev, syncedServerAt } — vb-* localStorage 키 시드
async function newPage({ seed, stamps, session = null, me = null, serverBoard, putResponse, captures } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
    }, seed);
  }
  if (stamps) {
    await page.addInitScript((s) => {
      if (!localStorage.getItem('vb-board-rev')) {
        if (s.rev !== undefined) localStorage.setItem('vb-board-rev', String(s.rev));
        if (s.syncedLocalRev !== undefined)
          localStorage.setItem('vb-synced-local-rev', String(s.syncedLocalRev));
        if (s.syncedServerAt !== undefined)
          localStorage.setItem('vb-synced-server-at', String(s.syncedServerAt));
      }
    }, stamps);
  }
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: session }));
  await page.route('**/api/auth/_log', (r) => r.fulfill({ json: {} }));
  if (me) await page.route('**/api/me', (r) => r.fulfill({ json: me }));
  if (serverBoard !== undefined) {
    await page.route('**/api/board', (r) => {
      if (r.request().method() === 'PUT') {
        captures?.push({ url: '/api/board PUT', body: r.request().postData() });
        return r.fulfill({ json: putResponse ?? { ok: true, updatedAt: 3000 } });
      }
      return r.fulfill({ json: serverBoard });
    });
  }
  await page.route('**/api/register', (r) => r.fulfill({ json: { ok: true } }));
  return { ctx, page };
}

// ── 1) 조용 채택 A — 서버가 로컬과 동일 내용(키 순서 셔플·휘발 필드만 상이) → 시트 없음 + PUT ──
{
  const captures = [];
  const local = meaningful();
  const server = shuffleKeys({ ...local, lastVisitAt: 1799999999999, loginNudgeSeen: false });
  const { ctx, page } = await newPage({
    seed: local,
    session: SESSION,
    me: ME,
    serverBoard: { board: server, updatedAt: 2000 },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2500);
  const sheet = await page.getByText('보드가 두 개 있어').isVisible().catch(() => false);
  ok('V86-1a 동일 내용(키 셔플) → 시트 없음', !sheet);
  ok('V86-1b 동일 내용 → 로컬 유지 자동 푸시', captures.some((c) => c.url === '/api/board PUT'));
  await ctx.close();
}

// ── 2) 조용 채택 B — 서버 updatedAt == 마지막 푸시 스탬프(내용은 상이) → 시트 없음 + 로컬 유지 ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    stamps: { rev: 5, syncedLocalRev: 3, syncedServerAt: 2000 },
    session: SESSION,
    me: ME,
    serverBoard: { board: meaningful({ userName: '서버헬렌' }), updatedAt: 2000 },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2500);
  const sheet = await page.getByText('보드가 두 개 있어').isVisible().catch(() => false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  ok('V86-2a 서버=마지막 푸시 → 시트 없음', !sheet);
  ok(
    'V86-2b 서버=마지막 푸시 → 로컬 유지+푸시',
    stored.userName === '헬렌' && captures.some((c) => c.url === '/api/board PUT')
  );
  await ctx.close();
}

// ── 3) 조용 채택 C — 로컬 무변경(rev==synced) + 서버 앞섬 → 시트 없이 서버 채택 ──
{
  const { ctx, page } = await newPage({
    seed: meaningful(),
    stamps: { rev: 5, syncedLocalRev: 5, syncedServerAt: 1000 },
    session: SESSION,
    me: ME,
    serverBoard: { board: meaningful({ userName: '서버헬렌' }), updatedAt: 2000 },
    captures: [],
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(3000);
  const sheet = await page.getByText('보드가 두 개 있어').isVisible().catch(() => false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  ok('V86-3 로컬 무변경+서버 앞섬 → 조용히 서버 채택', !sheet && stored.userName === '서버헬렌');
  await ctx.close();
}

// ── 4~5) 진짜 충돌(양쪽 독립 변경) → ask / "나중에 정할게" 후 리로드에도 덮어쓰기 0건 ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    stamps: { rev: 6, syncedLocalRev: 5, syncedServerAt: 1000 },
    session: SESSION,
    me: ME,
    serverBoard: { board: meaningful({ userName: '서버헬렌' }), updatedAt: 2000 },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  ok('V86-4 양쪽 독립 변경 → 병합 시트', await visible(page.getByText('보드가 두 개 있어')));
  await page.getByText('나중에 정할게').click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForTimeout(3000);
  const sheetAfter = await page.getByText('보드가 두 개 있어').isVisible().catch(() => false);
  ok(
    'V86-5 보류 후 리로드 → 조용한 덮어쓰기 0건',
    captures.every((c) => c.url !== '/api/board PUT') && !sheetAfter,
    `puts=${captures.length}`
  );
  await ctx.close();
}

// ── 6~7) 동기화 스탬프 기록 / 디바운스 대기분 visibilitychange 플러시 ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    session: SESSION,
    me: { ...ME, hasBoard: false, boardUpdatedAt: null },
    serverBoard: { board: null, updatedAt: null },
    putResponse: { ok: true, updatedAt: 7777 },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const stamps = await page.evaluate(() => ({
    serverAt: localStorage.getItem('vb-synced-server-at'),
    localRev: localStorage.getItem('vb-synced-local-rev'),
  }));
  ok(
    'V86-6 PUT 성공 → 동기화 스탬프 기록',
    stamps.serverAt === '7777' && stamps.localRev !== null,
    JSON.stringify(stamps)
  );
  const before = captures.filter((c) => c.url === '/api/board PUT').length;
  await page.evaluate(() => window.dispatchEvent(new Event('vb:board-saved')));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(700);
  const after = captures.filter((c) => c.url === '/api/board PUT').length;
  // 저장 이벤트 후 1초 미만 — 디바운스(2.5s) 전 PUT이면 플러시가 쏜 것
  ok('V86-7 탭 숨김 → 디바운스 대기분 즉시 플러시', after > before, `before=${before} after=${after}`);
  await ctx.close();
}

// ── 8) 로그아웃 → /logged-out 완료 화면 + 보드 무손상 + 세션 스탬프 정리 ──
{
  let signedOut = false;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.addInitScript((data) => {
    if (!localStorage.getItem('vision-board-data')) {
      localStorage.setItem('vision-board-data', JSON.stringify(data));
    }
  }, meaningful());
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: signedOut ? null : SESSION }));
  await page.route('**/api/auth/_log', (r) => r.fulfill({ json: {} }));
  await page.route('**/api/auth/csrf', (r) => r.fulfill({ json: { csrfToken: 'test-csrf' } }));
  await page.route('**/api/auth/signout**', (r) => {
    signedOut = true;
    return r.fulfill({ json: { url: `${BASE}/` } });
  });
  await page.route('**/api/me', (r) => r.fulfill({ json: ME }));
  await page.route('**/api/board', (r) =>
    r.request().method() === 'PUT'
      ? r.fulfill({ json: { ok: true, updatedAt: 3000 } })
      : r.fulfill({ json: { board: null, updatedAt: null } })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('button', { name: '내 계정 — 로그인됨', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.waitForURL('**/logged-out', { timeout: 8000 }).catch(() => {});
  ok('V86-8a 로그아웃 → /logged-out 이동', page.url().endsWith('/logged-out'));
  ok('V86-8b 완료 카피', await visible(page.getByText('로그아웃됐어')));
  ok('V86-8c 재로그인 버튼', await visible(page.getByRole('button', { name: '다시 로그인' })));
  ok('V86-8d 보드 복귀 링크', await visible(page.getByRole('link', { name: '보드로 갈래' })));
  const state = await page.evaluate(() => ({
    userName: JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').userName,
    mergeChecked: sessionStorage.getItem('vb-merge-checked'),
  }));
  ok('V86-8e 로컬 보드 무손상', state.userName === '헬렌');
  ok('V86-8f 병합 세션 스탬프 정리', state.mergeChecked === null, `checked=${state.mergeChecked}`);
  await ctx.close();
}

await browser.close();

// ── 9) decideMerge 단위 (v81r1 D-1 패턴 — tsc 단독 컴파일 = 순수 모듈 계약 검증 겸용) ──
{
  let pass = false;
  let detail = '';
  try {
    const out = mkdtempSync(join(tmpdir(), 'vb-merge-v86-'));
    execSync(
      `npx tsc lib/merge.ts --outDir ${out} --module esnext --target es2020 --moduleResolution bundler --skipLibCheck`,
      { cwd: process.cwd(), stdio: 'pipe' }
    );
    const { decideMerge } = await import(pathToFileURL(join(out, 'merge.js')).href);
    const mk = (extra = {}) => ({
      sections: { 1: { id: 1, status: 'completed', miniStory: '이야기' } },
      lastVisitAt: 10,
      ...extra,
    });
    // u1: 휘발 필드만 상이 → 동등 → useLocal
    const u1 = decideMerge(mk(), mk({ lastVisitAt: 999, loginNudgeSeen: true }), 2000);
    // u2: 내용 상이 + 서버==마지막 푸시 → useLocal
    const diff = mk({ oneSentence: '서버 문장' });
    const u2 = decideMerge(mk(), diff, 2000, { serverAt: 2000, localRev: 3, currentRev: 7 });
    // u3: 내용 상이 + 로컬 무변경 + 서버 앞섬 → useServer
    const u3 = decideMerge(mk(), diff, 2000, { serverAt: 1000, localRev: 7, currentRev: 7 });
    // u4: 스탬프 없음(하위호환 3인자) → ask
    const u4 = decideMerge(mk(), diff, 2000);
    // u5: 스탬프 있어도 양쪽 갈라짐 → ask
    const u5 = decideMerge(mk(), diff, 2000, { serverAt: 1000, localRev: 5, currentRev: 8 });
    pass =
      u1.action === 'useLocal' &&
      u2.action === 'useLocal' &&
      u3.action === 'useServer' &&
      u4.action === 'ask' &&
      u5.action === 'ask';
    detail = `u1=${u1.action} u2=${u2.action} u3=${u3.action} u4=${u4.action} u5=${u5.action}`;
  } catch (e) {
    detail = String(e).slice(0, 120);
  }
  ok('V86-9 decideMerge v2 판정 5분기', pass, detail);
}

console.log(results.join('\n'));
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
if (errors.length) console.log('\npageerror(참고 — hydration #418은 기존 전역 패턴):\n' + errors.join('\n'));
console.log(`\n${results.length - failCount}/${results.length} PASS`);
process.exit(failCount ? 1 : 0);
