// R2-1 검증 — Google 로그인 코어: 온보딩 선택 화면·동의 시트(§5-1)·병합 3분기(§5)·
// 계정 시트(§4)·자동 업서트·/privacy. 실 OAuth는 불가하므로 /api/auth/session·/api/me·
// /api/board·/api/register를 route 모킹으로 주입한다. dev 서버(localhost:3000) 필요.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
// isVisible()은 대기 없이 즉시 판정 — 렌더/애니메이션 경합 방지용 waitFor 래퍼
const visible = (loc, timeout = 5000) =>
  loc.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);

const SESSION = {
  user: { name: '헬렌', email: 'helen@test.dev' },
  googleSub: 'sub-123',
  expires: '2099-01-01T00:00:00.000Z',
};

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) {
    Object.assign(sections[id], extra);
  }
  return sections;
}

const board = (overrides = {}, extra = {}) => ({
  sections: seedSections(overrides),
  onboardingDone: true,
  dashboardIntroSeen: true,
  userName: '헬렌',
  startedAt: Date.now() - 86400000,
  lastVisitAt: Date.now() - 3600000,
  targetDate: '2029-07-07',
  schemaVersion: 4,
  ...extra,
});
// 의미 있는 보드 = 섹션 1에 대화 1개 (isBoardMeaningful 기준)
const meaningful = (extra = {}) =>
  board({ 1: { status: 'in_progress', chatMessages: [{ role: 'user', content: '테스트 답변' }] } }, extra);

const browser = await chromium.launch();

async function newPage({ seed, session = null, me = null, serverBoard, captures } = {}) {
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
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: session }));
  await page.route('**/api/auth/_log', (r) => r.fulfill({ json: {} }));
  if (me) await page.route('**/api/me', (r) => r.fulfill({ json: me }));
  if (serverBoard !== undefined) {
    await page.route('**/api/board', (r) => {
      if (r.request().method() === 'PUT') {
        captures?.push({ url: '/api/board PUT', body: r.request().postData() });
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({ json: serverBoard });
    });
  }
  await page.route('**/api/register', (r) => {
    captures?.push({ url: `/api/register ${r.request().method()}`, body: r.request().postData() });
    return r.fulfill({ json: { ok: true } });
  });
  return { ctx, page };
}

// ── 1) choice: 온보딩 미완료 직접 진입 가드 → / ──
{
  const { ctx, page } = await newPage({});
  await page.goto(`${BASE}/onboarding/choice`);
  await page.waitForURL(`${BASE}/`, { timeout: 5000 }).catch(() => {});
  ok('R2-1 choice 온보딩 미완료 가드', page.url() === `${BASE}/`);
  await ctx.close();
}

// ── 2~3) choice: 2버튼+유의 카피, 게스트 시작 → 대시보드 ──
{
  const { ctx, page } = await newPage({ seed: meaningful() });
  await page.goto(`${BASE}/onboarding/choice`);
  ok('R2-2a choice Google 버튼', await visible(page.getByText('Google로 시작하기')));
  ok('R2-2b choice 게스트 버튼', await visible(page.getByText('게스트로 시작하기')));
  ok('R2-2c choice 유의 카피', await visible(page.getByText('이 기기 브라우저에만 저장돼')));
  await page.getByText('게스트로 시작하기').click();
  await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {});
  ok('R2-3 게스트 시작 → 대시보드', page.url().endsWith('/dashboard'));
  await ctx.close();
}

// ── 4) 비로그인 대시보드: 계정 버튼 → 로그인 유도 시트 ──
{
  const { ctx, page } = await newPage({ seed: meaningful() });
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('button', { name: '계정', exact: true }).click();
  // 'Google로 로그인'은 본문 문단("…로그인하면…")과 중복 매칭(strict) — 버튼 role로 한정
  ok('R2-4 비로그인 계정 시트: Google 로그인', await visible(page.getByRole('button', { name: 'Google로 로그인', exact: true })));
  await ctx.close();
}

// ── 5) 로그인+미등록 → 동의 시트: 필수만 활성 조건, 선택 미체크 가입 가능 ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    session: SESSION,
    me: { authenticated: true, registered: false, email: 'helen@test.dev', name: '헬렌' },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  const start = page.getByRole('button', { name: '시작하기', exact: true });
  await start.waitFor({ timeout: 5000 }).catch(() => {});
  ok('R2-5a 동의: 필수 미체크 시 비활성', await start.isDisabled().catch(() => false));
  await page.locator('label').filter({ hasText: '개인정보 수집' }).locator('input').check();
  ok('R2-5b 동의: 필수 체크 후 활성', await start.isEnabled().catch(() => false));
  await start.click();
  await page.waitForTimeout(600);
  const reg = captures.find((c) => c.url === '/api/register POST');
  ok(
    'R2-5c 동의: 선택 미체크 가입 POST(marketing=false)',
    !!reg && JSON.parse(reg.body).marketingConsent === false
  );
  await ctx.close();
}

// ── 6) 등록 유저 + 서버 보드 없음 → 로컬 자동 업서트(PUT) ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
    serverBoard: { board: null, updatedAt: null },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  ok('R2-6 서버 빈 보드 → 로컬 자동 업서트', captures.some((c) => c.url === '/api/board PUT'));
  await ctx.close();
}

// ── 7) 둘 다 의미 보드 → 병합 시트 → 서버 선택 시 localStorage 교체 ──
{
  const { ctx, page } = await newPage({
    seed: meaningful(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: true, boardUpdatedAt: Date.now() },
    serverBoard: { board: meaningful({ userName: '서버헬렌' }), updatedAt: Date.now() },
    captures: [],
  });
  await page.goto(`${BASE}/dashboard`);
  ok('R2-7a 병합 시트 렌더', await visible(page.getByText('보드가 두 개 있어')));
  await page.getByText('저장된 보드 가져오기').click();
  await page.waitForTimeout(1200);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  ok('R2-7b 서버 보드 채택 → localStorage 교체', stored.userName === '서버헬렌');
  await ctx.close();
}

// ── 8) 로컬 빈 보드 + 서버 의미 보드 → 시트 없이 자동 채택 ──
{
  const { ctx, page } = await newPage({
    seed: board(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: true, boardUpdatedAt: Date.now() },
    serverBoard: { board: meaningful({ userName: '서버헬렌' }), updatedAt: Date.now() },
    captures: [],
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  const sheetShown = await page.getByText('보드가 두 개 있어').isVisible().catch(() => false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  ok('R2-8 로컬 빈 보드 → 서버 자동 채택(시트 없음)', !sheetShown && stored.userName === '서버헬렌');
  await ctx.close();
}

// ── 9) 등록 유저 계정 시트: 이메일·로그아웃·계정 삭제·마케팅 토글 PATCH ──
{
  const captures = [];
  const { ctx, page } = await newPage({
    seed: meaningful(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
    serverBoard: { board: null, updatedAt: null },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole('button', { name: '계정', exact: true }).click();
  ok('R2-9a 계정 시트: 이메일', await visible(page.getByText('helen@test.dev')));
  ok('R2-9b 계정 시트: 로그아웃', await visible(page.getByText('로그아웃')));
  ok('R2-9c 계정 시트: 계정 삭제', await visible(page.getByText('계정 삭제')));
  // controlled checkbox — 상태는 PATCH 응답 후 갱신되므로 check() 대신 click() + 캡처 단언
  await page.locator('label').filter({ hasText: '소식 받기' }).locator('input').click();
  await page.waitForTimeout(500);
  ok('R2-9d 마케팅 토글 PATCH', captures.some((c) => c.url === '/api/register PATCH'));
  await ctx.close();
}

// ── 10) /privacy 200 + 핵심 텍스트 ──
{
  const { ctx, page } = await newPage({});
  const res = await page.goto(`${BASE}/privacy`);
  ok('R2-10a /privacy 200', res.status() === 200);
  ok('R2-10b /privacy 본문', await page.getByText('수집하는 정보').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log(results.join('\n'));
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
if (errors.length) console.log('\npageerror(참고 — hydration #418은 기존 전역 패턴):\n' + errors.join('\n'));
console.log(`\n${results.length - failCount}/${results.length} PASS`);
process.exit(failCount ? 1 : 0);
