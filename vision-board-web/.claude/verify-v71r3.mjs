// v7.1-r3 검증 — 대시보드 미니보드 허브(셀 내비·추천 카드·퀵 버튼) + /collage?device= 딥링크
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

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

const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const textComplete = (extra = {}) =>
  ({ status: 'text_complete', extractedSlots: { ...FULL_EXTRACTED }, ...extra });
const withPhoto = (extra = {}) =>
  textComplete({ sceneText: '하루', miniStory: '스토리.', status: 'completed', uploadedImages: [PIXEL, null, null, null, null], ...extra });
const doneBoard = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4, ...extra,
});

const browser = await chromium.launch();

async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
      localStorage.setItem('vb-collage-coach-v1', '1'); // 코치마크 억제
    }, seed);
  }
  return { ctx, page };
}

// ── 1) 구 섹션 카드 부재 + 화면 높이 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto(), 2: textComplete() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-1a 구 상태 칩 텍스트 부재', (await page.getByText('글 완료').count()) === 0 && (await page.getByText('●●').count()) === 0);
  const h = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
  ok('R3-1b 대시보드 ≤1.2뷰포트', h <= 1.2, `ratio=${h.toFixed(2)}`);
  ok('R3-1c 미니보드 렌더', await page.getByText('Vision Board').isVisible().catch(() => false));

  // 6) 셀 터치 타깃 ≥44px
  const rect = await page.locator('button[aria-label*=" — "]').first().boundingBox();
  ok('R3-6 셀 터치 타깃 ≥44px', !!rect && rect.width >= 44 && rect.height >= 44, `w=${rect?.width} h=${rect?.height}`);
  await ctx.close();
}

// ── 2) 셀 탭 상태별 라우팅 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="나 — 완성"]').click();
  await page.waitForTimeout(1200);
  ok('R3-2a completed 셀 → /scenes/1', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="나 — 글 완료"]').click();
  await page.waitForTimeout(1200);
  ok('R3-2b text_complete(스토리 없음) 셀 → /scene/1', new URL(page.url()).pathname === '/scene/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="나 — 시작 전"]').click();
  await page.waitForTimeout(1200);
  ok('R3-2c not_started 셀 → /section/1', new URL(page.url()).pathname === '/section/1', page.url());
  await ctx.close();
}

// ── 3) 추천 카드 — 첫 미완성 섹션 타깃 + 라우팅 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-3a 추천 카드 노출', await page.getByText('다음 할 일').isVisible().catch(() => false));
  await page.getByText('다음 할 일').click();
  await page.waitForTimeout(1200);
  ok('R3-3b 추천 카드 → /section/2', new URL(page.url()).pathname === '/section/2', page.url());
  await ctx.close();
}

// ── 4) 퀵 버튼 gating + 폰 딥링크 (프리셋 무 → 사이즈 선택) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() })); // 사진 없음
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-4a 사진 없으면 퀵 버튼 숨김', (await page.getByText('폰 배경화면').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-4b 사진 있으면 퀵 버튼 노출', await page.getByText('폰 배경화면').isVisible().catch(() => false));
  await page.getByText('폰 배경화면').click();
  await page.waitForTimeout(1500);
  ok('R3-4c 폰 딥링크 → 편집 헤더 직행', await page.getByText('폰 배경 만들기').first().isVisible().catch(() => false));
  ok('R3-4d choose 뷰 건너뜀', (await page.getByText('완성된 보드, 어디에 둘까?').count()) === 0);
  ok('R3-4e 프리셋 무 → 사이즈 피커', await page.getByText('어떤 기기에 쓸지 사이즈부터 골라줘').isVisible().catch(() => false));
  ok('R3-4f URL 파람 정리', !page.url().includes('device='), page.url());
  await ctx.close();
}
// 프리셋 有 → 바로 편집(피커 없음)
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }, {
    collageDevicePresets: { phone: 'iphone' },
  }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('폰 배경화면').click();
  await page.waitForTimeout(1500);
  ok('R3-4g 프리셋 有 → 피커 건너뜀', (await page.getByText('어떤 기기에 쓸지 사이즈부터 골라줘').count()) === 0);
  ok('R3-4h 템플릿 탭 노출', await page.getByText('폴라로이드').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) /collage?device=desktop 직URL + 보드 보기 링크 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?device=desktop`);
  await page.waitForTimeout(1500);
  ok('R3-5a 직URL → PC 배경 만들기', await page.getByText('PC 배경 만들기').first().isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('그냥 보드로 볼래?').click();
  await page.waitForTimeout(1500);
  ok('R3-5b 보드 보기 링크 → choose 뷰', await page.getByText('완성된 보드, 어디에 둘까?').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.1-r3 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
