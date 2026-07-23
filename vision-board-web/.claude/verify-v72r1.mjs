// v7.2 검증 — 온보딩 카피, 정원 맵 대시보드, collage 한 화면 통합, scenes 시트 X, 섹션 명칭
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

// ── 1) 온보딩 스텝1 새 카피 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1500);
  ok('V2-1a 이름 질문(새 카피)', (await page.getByText('너를 뭐라고 불러주면 좋을까?').count()) > 0);
  ok('V2-1b 여정 예고 문장 제거', (await page.getByText('그다음엔 우리 같이').count()) === 0);
  ok('V2-1c 구 도입부(그 전에) 제거', (await page.getByText('그 전에 —').count()) === 0);
  await ctx.close();
}

// ── 2) 대시보드 정원 맵 (온보딩 완료 시드) ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const seedCount = await page.getByText('🌱').count();
  ok('V2-2a 미시작 칸 씨앗 🌱', seedCount >= 1, `count=${seedCount}`);
  ok('V2-2b 추천 카드 부캡션(토리 대기)', await page.getByText('토리가 여기서 기다려').isVisible().catch(() => false));
  ok('V2-2c 추천 카드 문장형(섹션1 명칭)', await page.getByText('원하는 내 모습, 이야기부터 시작해볼까?').isVisible().catch(() => false));
  ok('V2-2e 사진 없음 → 보드 버튼 숨김', (await page.getByText('내 비전보드 보기').count()) === 0);
  await ctx.close();
}
// 첫 진입 시트 — 진행 방식 안내 (dashboardIntroSeen: false)
{
  const { ctx, page } = await newPage(doneBoard({}, { dashboardIntroSeen: false }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // v7.4: '순서는 네 마음' → 코어 경로 라이트('먼저 마음 가는 세 칸부터')로 교체
  ok('V2-2d-1 첫 진입 시트: 코어 경로', await page.getByText('먼저 마음 가는 세 칸부터').isVisible().catch(() => false));
  ok('V2-2d-2 첫 진입 시트: 질문 추천', await page.getByText('먼저 찾아보는 걸 추천해').isVisible().catch(() => false));
  await ctx.close();
}
// 사진 1장 시드 → 단일 버튼 + 구 UI 부재
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V2-2f-1 보드 버튼 노출', await page.getByText('내 비전보드 보기').isVisible().catch(() => false));
  ok('V2-2f-2 구 퀵 버튼 부재', (await page.getByText('폰 배경화면').count()) === 0);
  ok('V2-2f-3 구 보드 링크 부재', (await page.getByText('그냥 보드로 볼래?').count()) === 0);
  await ctx.close();
}

// ── 3) collage 통합 화면 (사진 시드) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  // v7.3: 기본 뷰가 PC
  ok('V2-3a-1 진입 즉시 PC 탭 활성 (v7.3 기본)', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V2-3a-2 choose 뷰 부재', (await page.getByText('완성된 보드, 어디에 둘까?').count()) === 0);

  // 폰 탭 → 표준 프리셋 자동 선택 + 상시 칩 행 (v7.3)
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(800);
  ok('V2-3b 폰 탭 → 기본 폰 자동 선택', await page.getByRole('radio', { name: '기본 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));

  // 다른 칩 탭 → 즉시 적용 + 같은 화면에 저장 버튼
  await page.getByRole('radio', { name: 'iPhone', exact: true }).click();
  await page.waitForTimeout(800);
  ok('V2-3c-1 칩 탭 → 즉시 적용 (라벨 캡션)', await page.getByText('iPhone 일반·Pro').isVisible().catch(() => false));
  ok('V2-3c-2 같은 화면에 저장 버튼', await page.getByText('폰 배경화면 저장').isVisible().catch(() => false));

  // v7.3: '사이즈 바꾸기' 패널 제거 — 칩이 상시 노출
  ok('V2-3d-1 사이즈 바꾸기 패널 부재', (await page.getByText('사이즈 바꾸기').count()) === 0);
  ok('V2-3d-2 칩 상시 노출 (Galaxy S)', (await page.getByRole('radio', { name: 'Galaxy S' }).count()) > 0);

  // 보드 탭 복귀 → 템플릿 셀렉터 + 보드 안내
  await page.getByRole('radio', { name: '보드' }).click();
  await page.waitForTimeout(500);
  ok('V2-3f-1 보드 복귀 → 템플릿 셀렉터', await page.getByText('폴라로이드').isVisible().catch(() => false));
  ok('V2-3f-2 보드 안내 카피', await page.getByText('위 탭에서 폰·PC를 고르면').isVisible().catch(() => false));
  await ctx.close();
}
// 딥링크 직접 진입 → PC 탭 활성
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?device=desktop`);
  await page.waitForTimeout(1200);
  ok('V2-3e 딥링크 → PC 탭 활성', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  await ctx.close();
}

// ── 4) scenes 저장 시트 X (사진 먼저 시드: 답변 없이 /scenes/1) ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label*="비전보드에 담기"], button[aria-label="샘플 사진 담기"]').first().click();
  await page.waitForFunction(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data') ?? '{}');
    return !!b?.sections?.[1]?.uploadedImages?.[0];
  }, undefined, { timeout: 20000 }).catch(() => {});
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1500);
  ok('V2-4a 저장 → 사진 넛지 시트', await page.getByText('🌰 사진 담았어!').isVisible().catch(() => false));
  await page.getByLabel('닫기', { exact: true }).click();
  await page.waitForTimeout(500);
  ok('V2-4b-1 X 클릭 → 시트 닫힘', (await page.getByText('🌰 사진 담았어!').count()) === 0);
  ok('V2-4b-2 같은 페이지 유지', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}

// ── 5) 섹션 명칭 — 미시작 셀 탭 → 양경로 시트 제목 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="나 — 시작 전"]').click();
  await page.waitForTimeout(600);
  ok('V2-5a 시트 제목 = 원하는 내 모습', await page.getByText('원하는 내 모습, 어떻게 시작할까?').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.2-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
