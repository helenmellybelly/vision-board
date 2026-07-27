// R2-2 검증 — 게스트 로그인 유도 3종: B 소프트 게이트(첫 사진 후 첫 대시보드 방문 1회)·
// 대시보드 재유도 배너(7일 간격)·C 배경화면 보조 유도. 실 OAuth 불가 → /api/auth/session
// route 모킹(verify-r2a 패턴) + addInitScript 시드. dev/start 서버(localhost:3000) 필요.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
const DAY = 24 * 3600 * 1000;

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
// 사진 1장 담긴 게스트 보드 — hasAnyImage 성립 (게이트·배너의 공통 전제)
const photoBoard = (extra = {}) =>
  board({ 1: { status: 'in_progress', uploadedImages: [PIXEL, null, null, null, null] } }, extra);

const browser = await chromium.launch();

async function newPage({ seed, session = null, me = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
      localStorage.setItem('vb-collage-coach-v1', '1'); // 콜라주 코치마크 억제
    }, seed);
  }
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: session }));
  await page.route('**/api/auth/_log', (r) => r.fulfill({ json: {} }));
  if (me) await page.route('**/api/me', (r) => r.fulfill({ json: me }));
  await page.route('**/api/board', (r) =>
    r.request().method() === 'PUT'
      ? r.fulfill({ json: { ok: true } })
      : r.fulfill({ json: { board: null, updatedAt: null } })
  );
  return { ctx, page };
}

const readBoard = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? 'null'));

const gateSheet = (page) => page.getByText('이 보드를 저장하고 이어가려면');
const gateCta = (page) => page.getByRole('button', { name: 'Google로 로그인해두기' });
const banner = (page) => page.getByText('브라우저를 정리하면 보드가 사라질 수 있어'); // v7.9 손실 구체화 카피

// ── B-1) 게스트+사진+필드 부재 → 게이트 visible ──
{
  const { ctx, page } = await newPage({ seed: photoBoard() });
  await page.goto(`${BASE}/dashboard`);
  ok('B-1a 게이트 시트 노출', await visible(gateSheet(page)));
  ok('B-1b 주 버튼 "Google로 로그인해두기"', await visible(gateCta(page)));
  await ctx.close();
}

// ── B-2) "나중에 할게" → 필드 스탬프 + reload 후 부재(1회 계약) + 배너 쿨다운 ──
{
  const { ctx, page } = await newPage({ seed: photoBoard() });
  await page.goto(`${BASE}/dashboard`);
  await gateSheet(page).waitFor({ timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: '나중에 할게' }).click();
  await page.waitForTimeout(400);
  const stored = await readBoard(page);
  ok(
    'B-2a 닫기 → loginNudgeSeen+dismissedAt 스탬프',
    stored?.loginNudgeSeen === true && typeof stored?.loginBannerDismissedAt === 'number'
  );
  await page.reload();
  await page.waitForTimeout(1500);
  ok('B-2b reload 후 게이트 부재', !(await gateSheet(page).isVisible().catch(() => false)));
  ok('B-2c 직후 배너도 부재(7일 쿨다운)', !(await banner(page).isVisible().catch(() => false)));
  await ctx.close();
}

// ── B-3) 사진 0장 → 게이트·배너 부재 ──
{
  const { ctx, page } = await newPage({ seed: board() });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1800);
  ok('B-3 사진 0장 → 게이트·배너 부재',
    !(await gateSheet(page).isVisible().catch(() => false)) &&
    !(await banner(page).isVisible().catch(() => false)));
  await ctx.close();
}

// ── B-4) 로그인 모킹 → 게이트·배너 부재(자동 소멸 계약) ──
{
  const { ctx, page } = await newPage({
    seed: photoBoard({ loginNudgeSeen: true, loginBannerDismissedAt: Date.now() - 8 * DAY }),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1800);
  ok('B-4a 로그인 → 배너 부재', !(await banner(page).isVisible().catch(() => false)));
  const { ctx: ctx2, page: page2 } = await newPage({
    seed: photoBoard(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
  });
  await page2.goto(`${BASE}/dashboard`);
  await page2.waitForTimeout(1800);
  ok('B-4b 로그인 → 게이트 부재', !(await gateSheet(page2).isVisible().catch(() => false)));
  await ctx.close();
  await ctx2.close();
}

// ── B-5) 인트로 미시청 → 인트로 우선, 게이트 부재 ──
{
  const { ctx, page } = await newPage({ seed: photoBoard({ dashboardIntroSeen: false }) });
  await page.goto(`${BASE}/dashboard`);
  ok('B-5a 인트로 시트 우선', await visible(page.getByRole('dialog', { name: '6가지 영역 안내' })));
  ok('B-5b 인트로 중 게이트 부재', !(await gateSheet(page).isVisible().catch(() => false)));
  await ctx.close();
}

// ── BN-1) 게이트 기시청 + 8일 전 스탬프 → 배너 visible + r2a 계약('Google로 로그인' exact 0개) ──
{
  const { ctx, page } = await newPage({
    seed: photoBoard({ loginNudgeSeen: true, loginBannerDismissedAt: Date.now() - 8 * DAY }),
  });
  await page.goto(`${BASE}/dashboard`);
  ok('BN-1a 배너 노출(8일 경과)', await visible(banner(page)));
  ok('BN-1b 배너 CTA', await visible(page.getByRole('button', { name: 'Google로 저장해두기 →' })));
  // r2a R2-4가 의존하는 'Google로 로그인' exact 버튼은 배너·게이트 어디에도 없어야 한다 (strict 충돌 차단)
  const exactCount = await page.getByRole('button', { name: 'Google로 로그인', exact: true }).count();
  ok('BN-1c "Google로 로그인" exact 버튼 0개', exactCount === 0, `count=${exactCount}`);
  await ctx.close();
}

// ── BN-2) 배너 × → 스탬프 갱신 + reload 후 부재 ──
{
  const dismissedAt = Date.now() - 8 * DAY;
  const { ctx, page } = await newPage({
    seed: photoBoard({ loginNudgeSeen: true, loginBannerDismissedAt: dismissedAt }),
  });
  await page.goto(`${BASE}/dashboard`);
  await banner(page).waitFor({ timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: '로그인 안내 닫기' }).click();
  await page.waitForTimeout(400);
  const stored = await readBoard(page);
  ok('BN-2a × → dismissedAt 갱신', (stored?.loginBannerDismissedAt ?? 0) > dismissedAt);
  await page.reload();
  await page.waitForTimeout(1500);
  ok('BN-2b reload 후 배너 부재', !(await banner(page).isVisible().catch(() => false)));
  await ctx.close();
}

// ── BN-3) 1일 전 스탬프 → 배너 부재(7일 게이트) ──
{
  const { ctx, page } = await newPage({
    seed: photoBoard({ loginNudgeSeen: true, loginBannerDismissedAt: Date.now() - 1 * DAY }),
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1800);
  ok('BN-3 1일 경과 → 배너 부재', !(await banner(page).isVisible().catch(() => false)));
  await ctx.close();
}

// ── C-1) 게스트 /collage → 배경화면 저장 → C 문구 visible ──
// 헤드리스는 navigator.share 미지원 → 다운로드 폴백이라 OS 대화상자 없이 저장이 완료된다
{
  const { ctx, page } = await newPage({
    seed: photoBoard({
      loginNudgeSeen: true,
      loginBannerDismissedAt: Date.now(),
      collageDevicePresets: { phone: 'phone', desktop: 'pc-fhd' },
    }),
  });
  await page.goto(`${BASE}/collage?view=phone`); // 기본 view는 desktop — 폰 저장 버튼을 위해 명시
  await page.getByRole('button', { name: '폰 배경화면 저장' }).click();
  const saveBtn = page.getByRole('button', { name: '이미지로 저장' });
  await saveBtn.waitFor({ timeout: 8000 }).catch(() => {});
  // 미리보기 렌더 완료(disabled 해제)까지 대기 후 저장
  await page.waitForFunction(
    () => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((el) => el.textContent?.includes('이미지로 저장'));
      return b && !b.disabled;
    },
    { timeout: 10000 }
  ).catch(() => {});
  const download = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await saveBtn.click();
  await download;
  ok('C-1 저장 성공 후 보조 유도 1줄', await visible(page.getByText('이 보드, 계속 간직할래?')));
  await ctx.close();
}

// ── C-2) 로그인 모킹 → 저장 후에도 C 문구 부재 ──
{
  const { ctx, page } = await newPage({
    seed: photoBoard({
      loginNudgeSeen: true,
      loginBannerDismissedAt: Date.now(),
      collageDevicePresets: { phone: 'phone', desktop: 'pc-fhd' },
    }),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
  });
  await page.goto(`${BASE}/collage?view=phone`); // 기본 view는 desktop — 폰 저장 버튼을 위해 명시
  await page.getByRole('button', { name: '폰 배경화면 저장' }).click();
  const saveBtn = page.getByRole('button', { name: '이미지로 저장' });
  await saveBtn.waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((el) => el.textContent?.includes('이미지로 저장'));
      return b && !b.disabled;
    },
    { timeout: 10000 }
  ).catch(() => {});
  const download = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await saveBtn.click();
  await download;
  await page.waitForTimeout(600);
  ok('C-2 로그인 유저 → C 문구 부재', !(await page.getByText('이 보드, 계속 간직할래?').isVisible().catch(() => false)));
  await ctx.close();
}

await browser.close();

console.log(results.join('\n'));
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
if (errors.length) console.log('\npageerror(참고 — hydration #418은 기존 전역 패턴):\n' + errors.join('\n'));
console.log(`\n${results.length - failCount}/${results.length} PASS`);
process.exit(failCount ? 1 : 0);
