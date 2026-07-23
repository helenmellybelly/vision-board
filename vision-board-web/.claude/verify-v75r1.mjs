// v7.5 검증 — 대시보드 산책길 지도(WalkPathMap: CTA 우선 배치·상태 4단계·사진 미표시·진행 카피),
// 인트로 시트 산책길 카피, collage 2탭(보드 탭 제거·레거시 정규화·완성 동선 공통화)
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

// ── 1) 대시보드 — CTA가 산책길 지도보다 위 + 상태 4단계 렌더 + 사진 미표시 ──
{
  // 혼합 시드: 1 completed / 2 text_complete / 3 사진만(not_started+사진) / 4~6 미시작
  const { ctx, page } = await newPage(
    doneBoard({ 1: withPhoto(), 2: textComplete(), 3: { uploadedImages: [PIXEL, null, null] } })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);

  // V5-1 재배치: 추천 카드(CTA)가 산책길 지도(참나무 언덕)보다 위
  const ctaBox = await page.getByText('이야기를 들려줄래?').boundingBox().catch(() => null);
  const mapBox = await page.getByText('참나무 언덕').boundingBox().catch(() => null);
  ok('V5-1 CTA가 지도보다 위', !!ctaBox && !!mapBox && ctaBox.y < mapBox.y, `cta=${ctaBox?.y} map=${mapBox?.y}`);

  // V5-2 상태 4단계 — body 텍스트로 이모지 개수 판정 (도착 노드 🌳 포함 2, 출발 🌰 포함 4)
  const body = await page.locator('body').innerText();
  const count = (s) => body.split(s).length - 1;
  ok('V5-2a completed → 🌳 (스테이션+도착=2)', count('🌳') === 2, `🌳=${count('🌳')}`);
  ok('V5-2b text_complete → ✍️ 1개', count('✍️') === 1, `✍️=${count('✍️')}`);
  ok('V5-2c 사진만(미시작) → 📷 1개', count('📷') >= 1, `📷=${count('📷')}`);
  ok('V5-2d 미시작 → 🌰 (출발+3스테이션=4)', count('🌰') >= 4, `🌰=${count('🌰')}`);
  ok('V5-2e 완료 칩', await page.getByText('완료', { exact: true }).first().isVisible().catch(() => false));

  // V5-3 사진 썸네일 부재 — 지도에 업로드 사진(data URL)이 렌더되지 않는다
  ok('V5-3 사진 썸네일 부재', (await page.locator('img[src^="data:image"]').count()) === 0);

  // V5-4 토리 마커 — 추천 스테이션(사진만 담긴 3: 관계, 열린 고리 우선) 버튼 안에
  const toriInStation = await page.locator('button[aria-label*=" — "] img[src*="tori"]').count();
  ok('V5-4 토리 마커 위치(추천 스테이션)', toriInStation === 1, `tori=${toriInStation}`);

  // V5-6 구 카피 부재
  ok('V5-6a 구 캡션 부재(채워졌어)', !body.includes('채워졌어'));
  ok('V5-6b 구 캡션 부재(1칸만 있어도)', !body.includes('1칸만 있어도'));
  await ctx.close();
}

// ── 2) 진행 카피 4분기 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1200);
  ok('V5-5a 시작 전 카피', await page.getByText('토리랑 첫 스테이션부터 걸어보자').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: { uploadedImages: [PIXEL, null, null] } }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1200);
  ok('V5-5b 사진만 담김 → 중간 카피', await page.getByText('산책을 시작했어').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto(), 2: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1200);
  ok('V5-5c 완료 2 → 2/6 스테이션', await page.getByText('2/6 스테이션을 지났어').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(
    doneBoard({ 1: withPhoto(), 2: withPhoto(), 3: withPhoto(), 4: withPhoto(), 5: withPhoto(), 6: withPhoto() })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1200);
  ok('V5-5d 완료 6 → 길 끝에 도착', await page.getByText('길 끝에 도착').isVisible().catch(() => false));
  await ctx.close();
}

// ── 3) 스테이션 탭 라우팅 (aria-label 계약 유지) + 연도 행 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V5-8 연도 행 유지', await page.getByText('연도 바꾸기').isVisible().catch(() => false));
  await page.locator('button[aria-label="나 — 완성"]').click();
  await page.waitForTimeout(1200);
  ok('V5-7a completed 스테이션 → /scenes/1', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="건강 — 시작 전"]').click();
  await page.waitForTimeout(600);
  ok('V5-7b 미시작 스테이션 → 양경로 시트', await page.getByText('건강, 어떻게 시작할까?').isVisible().catch(() => false));
  await ctx.close();
}

// ── 4) 인트로 시트 — 산책길 카피 ──
{
  const { ctx, page } = await newPage(doneBoard({}, { dashboardIntroSeen: false }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V5-9a 인트로 산책길 카피', await page.getByText('6개 스테이션이 있는 산책길이야').isVisible().catch(() => false));
  ok('V5-9b 구 정원 카피 부재', (await page.getByText('6칸짜리 정원').count()) === 0);
  await ctx.close();
}

// ── 5) collage — 2탭·레거시 정규화·완성 동선 공통화 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  ok('V5-10a 뷰 라디오 2개', (await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio').count()) === 2);
  ok('V5-10b 보드 탭 부재', (await page.getByRole('radio', { name: '보드', exact: true }).count()) === 0);
  ok('V5-10c 기본 desktop', new URL(page.url()).search === '?view=desktop', page.url());
  ok('V5-13a 이미지로 저장 부재', (await page.getByText('🖼️ 이미지로 저장').count()) === 0);
  ok('V5-13b PC 배경화면 저장 존재', await page.getByText('PC 배경화면 저장').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?view=board`);
  await page.waitForTimeout(1200);
  const pcChecked = await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false);
  ok('V5-11 레거시 ?view=board → desktop 정규화', pcChecked && new URL(page.url()).search === '?view=desktop', page.url());
  await ctx.close();
}
{
  // 6섹션 완성(스토리 없음) — 기기 뷰에서 완성 CTA 노출
  const { ctx, page } = await newPage(
    doneBoard({ 1: withPhoto(), 2: withPhoto(), 3: withPhoto(), 4: withPhoto(), 5: withPhoto(), 6: withPhoto() })
  );
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  ok('V5-12a 기기 뷰 완성 CTA', await page.getByText('내 비전보드 완성하기').isVisible().catch(() => false));
  await ctx.close();
}
{
  // futureDayStory 있음 — 기기 뷰에서 이야기 블록 노출
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }, { futureDayStory: '미래의 어느 하루.' }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  ok('V5-12b 기기 뷰 이야기 블록', await page.getByText('미래의 하루 이야기').first().isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.5-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
