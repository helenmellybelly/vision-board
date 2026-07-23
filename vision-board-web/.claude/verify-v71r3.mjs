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
  // v7.5: 미니보드 → 산책길 지도
  ok('R3-1c 산책길 렌더', await page.getByText('참나무 언덕').isVisible().catch(() => false));

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
  await page.waitForTimeout(600);
  // v7.1-r4: 미시작 셀은 양경로 시트로 인터셉트 → 질문 경로 선택 시 /section/1
  await page.getByText('✍️ 질문에 답하며 시작').click();
  await page.waitForTimeout(1200);
  ok('R3-2c not_started 셀 → 시트 → /section/1', new URL(page.url()).pathname === '/section/1', page.url());
  await ctx.close();
}

// ── 3) 추천 카드 — 첫 미완성 섹션 타깃 + 라우팅 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // v7.2: 추천 카드 문장형 — 부캡션 '토리가 여기서 기다려' + 본문 행동 문장
  ok('R3-3a 추천 카드 노출', await page.getByText('토리가 여기서 기다려').isVisible().catch(() => false));
  await page.getByText('이야기부터 시작해볼까?').click();
  await page.waitForTimeout(600);
  // v7.1-r4: 추천 타깃이 미시작이면 양경로 시트 경유
  await page.getByText('✍️ 질문에 답하며 시작').click();
  await page.waitForTimeout(1200);
  ok('R3-3b 추천 카드 → 시트 → /section/2', new URL(page.url()).pathname === '/section/2', page.url());
  await ctx.close();
}

// ── 4) 보드 진입 버튼 gating + 딥링크 (v7.2 단일 버튼 + 한 화면 토글로 재정의) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() })); // 사진 없음
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-4a 사진 없으면 보드 버튼 숨김', (await page.getByText('내 비전보드 보기').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R3-4b 사진 있으면 보드 버튼 노출', await page.getByText('내 비전보드 보기').isVisible().catch(() => false));
  await page.getByText('내 비전보드 보기').click();
  await page.waitForTimeout(800);
  // v7.3: 기본 뷰가 PC — 진입 즉시 PC 탭 활성
  ok('R3-4c 진입 즉시 PC 뷰 (v7.3 기본)', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  // 딥링크는 URL 직접 진입으로 검증 (대시보드 퀵 버튼은 v7.2에서 제거, /finish 진입용으로 유지)
  await page.goto(`${BASE}/collage?device=phone`);
  await page.waitForTimeout(800);
  ok('R3-4d 폰 딥링크 → 폰 탭 활성', await page.getByRole('radio', { name: '📱 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  // v7.3: 프리셋 미선택이면 표준값 자동 선택 — 빈 피커 대신 '기본 폰' 칩이 선택돼 있다
  ok('R3-4e 프리셋 무 → 기본 폰 자동 선택', await page.getByRole('radio', { name: '기본 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  await ctx.close();
}
// 프리셋 有 → 상시 칩 행에서 해당 칩이 선택 상태 (v7.3: '사이즈 바꾸기' 패널 제거)
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }, {
    collageDevicePresets: { phone: 'iphone' },
  }));
  await page.goto(`${BASE}/collage?device=phone`);
  await page.waitForTimeout(1500);
  ok('R3-4f 프리셋 有 → iPhone 칩 선택', await page.getByRole('radio', { name: 'iPhone', exact: true }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('R3-4g 템플릿 탭 노출', await page.getByText('폴라로이드').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) /collage?device=desktop 직URL ──
// R3-5 '그냥 보드로 볼래?' 링크 케이스는 v7.2에서 삭제 — 단일 버튼 진입이 곧 보드 뷰(R3-4c가 대체)
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?device=desktop`);
  await page.waitForTimeout(1500);
  ok('R3-5a 직URL → PC 탭 활성', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
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
