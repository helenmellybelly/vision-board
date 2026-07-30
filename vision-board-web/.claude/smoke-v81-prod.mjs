// v8.1 프로덕션 스모크 (v8.2 갱신) — 배포 후 1회: 무변경 재진입 clean CTA·완주 대시보드·
// 콜라주 2탭(전 뷰포트)/기본 phone(좁은 화면)·핀 주소 게이트. 전부 클라이언트 시드라 LLM 비용 없음.
// 사용: `node .claude/smoke-v81-prod.mjs` (BASE로 다른 배포 지정 가능)
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'https://vision-board-web.vercel.app';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}
const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const withPhoto = () => ({
  status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: '기존 일기야.',
  uploadedImages: [PIXEL, null, null],
});
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});

const browser = await chromium.launch();

async function newPage(seed, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  if (seed) {
    await page.addInitScript((data) => {
      localStorage.setItem('vision-board-data', JSON.stringify(data));
      localStorage.setItem('vb-collage-coach-v1', '1');
    }, seed);
  }
  return { ctx, page };
}

// 1) 주요 경로 200
for (const path of ['/', '/dashboard', '/collage', '/section/1', '/scene/1', '/scenes/1', '/finish']) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' }).catch(() => null);
  ok(`GET ${path}`, !!res && (res.status === 200 || (res.status >= 300 && res.status < 400)), `status=${res?.status}`);
}

// 2) 무변경 재진입 — clean CTA + 검증 0회 + completed 유지 (S1 핵심 계약)
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  let validateCalls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/validate/answers')) validateCalls += 1; });
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(2500);
  const cleanCta = page.getByRole('button', { name: '미래 일기 보러 가기 →', exact: true });
  ok('S2a clean CTA', await cleanCta.isVisible().catch(() => false));
  await cleanCta.click();
  await page.waitForURL('**/scene/1', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  ok('S2b 검증 0회', validateCalls === 0, `calls=${validateCalls}`);
  ok('S2c 기존 일기 그대로', await page.getByText('기존 일기야.').isVisible().catch(() => false));
  const status = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')).sections[1].status);
  ok('S2d completed 유지', status === 'completed', `status=${status}`);
  await ctx.close();
}

// 3) 완주 대시보드 — 주 CTA /collage + 보조 일기 링크
{
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto();
  const { ctx, page } = await newPage(board(overrides, { futureDayStory: '미래의 어느 하루.', oneSentence: '여유로운 사람.' }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(2000);
  ok('S3a 완주 주 CTA', await page.getByText('완성한 내 비전보드 보기').isVisible().catch(() => false));
  ok('S3b 보조 일기 링크', await page.getByText('미래의 하루 일기 다시 읽기').isVisible().catch(() => false));
  ok('S3c 구 CTA 부재', (await page.getByText('비전보드 완성하러 가기').count()) === 0);
  await ctx.close();
}

// 4) 콜라주 — 좁은 화면 기본 phone / lg 2탭·단일 보드·전폭 (v8.2)
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  ok('S4a 좁은 화면 기본 phone', await page.getByRole('radio', { name: '📱 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('S4b 폰 저장 버튼', await page.getByText('폰 배경화면 저장').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), { width: 1280, height: 900 });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const boards = await page.locator('[data-testid="collage-board"]').count();
  ok('S4c lg 단일 보드(기본 desktop)', boards === 1 && (await page.locator('[data-testid="collage-board"][data-view="desktop"]').count()) === 1, `boards=${boards}`);
  ok('S4d lg 탭 2개 + PC 저장 버튼만', (await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio').count()) === 2 && (await page.getByText('PC 배경화면 저장').isVisible().catch(() => false)) && !(await page.getByText('폰 배경화면 저장').isVisible().catch(() => false)));
  const bw = (await page.locator('[data-testid="collage-board"]').boundingBox())?.width ?? 0;
  ok('S4e lg PC 보드 전폭(≥1000px)', bw >= 1000, `w=${bw}`);
  await ctx.close();
}

// 5) /scenes 핀 주소 게이트
{
  const { ctx, page } = await newPage(board({}));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /이미지 주소\(URL\)로 담기/ }).click();
  await page.getByPlaceholder('이미지 URL 주소 붙여넣기').fill('https://kr.pinterest.com/pin/1234567890/');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(600);
  ok('S5 핀 주소 차단', await page.getByText('그건 핀 페이지 주소야').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.1 프로덕션 스모크 =====');
for (const r of results) console.log(r);
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
