// v7.4-r1 검증 — 재생성 2회 제한, 완료 시트 세션 분할 카피, pathSheet 3연속 생략,
// 다중 업로드, 슬롯 유예("나중에 답할게"), 부분 가치·코어 경로 카피, 개화 카피 부재,
// 진행바 분모 완화, 질문 정비(S3·S5), scene 가이드 접힘
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PIXEL_BUF = Buffer.from(PIXEL.split(',')[1], 'base64');
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

// ── 1) 일기 재생성 2회 제한 ──
{
  // 2회 소진 상태 — 재생성 버튼 대신 직접 수정 유도
  const { ctx, page } = await newPage(
    doneBoard({ 1: textComplete({ sceneText: '하루', miniStory: '테스트 스토리.', diaryRegenCount: 2 }) })
  );
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V4-1a 제한 후 다시쓰기 버튼 부재', (await page.getByText('하루 다시 쓰기').count()) === 0);
  ok('V4-1b 제한 후 더담기 버튼 부재', (await page.getByText('더 담고 싶은 장면이 있어요').count()) === 0);
  // 유도 카피에도 '직접 수정하기' 문구가 있어 다중 매칭 — first()로 확인 (strict mode)
  ok('V4-1c 직접 수정 유지', await page.getByText('직접 수정하기').first().isVisible().catch(() => false));
  ok('V4-1d 유도 카피', await page.getByText('네 손으로 다듬는 게 제일 정확해').isVisible().catch(() => false));
  await ctx.close();
}
{
  // 미소진 상태 — 재생성 버튼 노출
  const { ctx, page } = await newPage(
    doneBoard({ 1: textComplete({ sceneText: '하루', miniStory: '테스트 스토리.' }) })
  );
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V4-1e 미소진 시 다시쓰기 노출', await page.getByText('하루 다시 쓰기').isVisible().catch(() => false));
  await ctx.close();
}

// ── 2) /scenes 저장 → 완료 시트: 세션 분할 카피 + 다음 스테이션 직행 ──
{
  const { ctx, page } = await newPage(
    doneBoard({ 1: textComplete({ sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, null, null, null, null] }) })
  );
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V4-2a 완료 시트 세션 분할 카피', await page.getByText('오늘은 여기까지도 충분해').isVisible().catch(() => false));
  const nextBtn = page.getByText(/다음: .+ 이어가기/);
  ok('V4-2b 다음 스테이션 버튼', await nextBtn.isVisible().catch(() => false));
  await nextBtn.click();
  await page.waitForTimeout(1200);
  ok('V4-2c 다음 미완성 섹션 직행', new URL(page.url()).pathname === '/section/2', page.url());
  await ctx.close();
}

// ── 3) pathSheet: 3연속 같은 선택이면 시트 생략 직행 ──
{
  const { ctx, page } = await newPage(doneBoard({}, { pathChoice: { kind: 'photo', streak: 3 } }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('이야기부터 시작해볼까?').click();
  await page.waitForTimeout(1200);
  ok('V4-3a 3연속 photo → 시트 생략 /scenes 직행', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}
{
  // streak < 3 — 시트는 뜨고, 직전 선택(photo)이 주 버튼으로 프리하이라이트
  const { ctx, page } = await newPage(doneBoard({}, { pathChoice: { kind: 'photo', streak: 1 } }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('이야기부터 시작해볼까?').click();
  await page.waitForTimeout(800);
  ok('V4-3b streak<3 → 시트 노출', await page.getByText('어떻게 시작할까?').isVisible().catch(() => false));
  await ctx.close();
}

// ── 4) 다중 업로드 — multiple 입력 + 2장 한 번에 담기 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete({ sceneText: '하루', miniStory: '스토리.' }) }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  ok('V4-4a multiple 입력 3개', (await page.locator('input[type="file"][multiple]').count()) === 3);
  ok('V4-4b 다중 선택 안내 카피', await page.getByText('여러 장을 한 번에 골라도 돼').isVisible().catch(() => false));
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: PIXEL_BUF },
    { name: 'b.png', mimeType: 'image/png', buffer: PIXEL_BUF },
  ]);
  await page.waitForTimeout(2000);
  const slot1 = await page.locator('img[alt="image 1"]').count();
  const slot2 = await page.locator('img[alt="image 2"]').count();
  ok('V4-4c 2장 → 슬롯 1·2 채움', slot1 === 1 && slot2 === 1, `slot1=${slot1} slot2=${slot2}`);
  await ctx.close();
}

// ── 5) 슬롯 유예 — 나중에 답할게 → 리뷰 회수 동선 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  const deferBtn = page.getByText('이 질문은 나중에 답할게');
  ok('V4-5a 유예 버튼 노출', await deferBtn.isVisible().catch(() => false));
  // current·want·feeling 3개 유예 → keyword 질문 도달
  for (let i = 0; i < 3; i++) {
    await page.getByText('이 질문은 나중에 답할게').click();
    await page.waitForTimeout(500);
  }
  ok('V4-5b 유예 마커 렌더', (await page.getByText('나중에 답할게 🌰').count()) >= 1);
  ok('V4-5c keyword는 유예 불가', (await page.getByText('이 질문은 나중에 답할게').count()) === 0);
  // keyword 답변 → 리뷰 카드에 유예 슬롯 노출
  await page.locator('textarea').first().fill('여유로운');
  await page.getByText('다 썼어').click();
  await page.waitForTimeout(1000);
  ok('V4-5d 리뷰: 유예 슬롯 표시', (await page.getByText('나중에 답하기로 했어').count()) >= 1);
  ok('V4-5e 리뷰: 지금 쓰기 회수 동선', (await page.getByText('지금 쓰기').count()) >= 1);
  ok('V4-5f 진행 버튼 노출', await page.getByText('이 답들로 미래의 하루 그려보기').isVisible().catch(() => false));
  await ctx.close();
}
{
  // /review 페이지 — 유예 슬롯 '—' 대신 유예 카피
  const { ctx, page } = await newPage(
    doneBoard({ 1: { status: 'text_complete', extractedSlots: { keyword: '여유로운' }, deferredSlots: ['current', 'want', 'feeling'] } })
  );
  await page.goto(`${BASE}/review`);
  await page.waitForTimeout(1500);
  ok('V4-5g /review 유예 표시', (await page.getByText('나중에 답하기로 했어').count()) >= 3);
  await ctx.close();
}

// ── 6) 부분 가치·코어 경로 카피 + 개화 카피 부재 + 분모 완화 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // v7.5: 산책길 카피로 교체 — 완료 1섹션이면 '1/6 스테이션을 지났어'
  ok('V4-6a 산책길 진행 캡션(1스테이션)', await page.getByText('1/6 스테이션을 지났어').isVisible().catch(() => false));
  ok('V4-6b 보드 버튼 부제(배경화면)', await page.getByText('지금 담긴 사진만으로도 배경화면까지').isVisible().catch(() => false));
  const bodyText = await page.locator('body').innerText();
  ok('V4-6c 개화 카피 부재', !bodyText.includes('피었') && !bodyText.includes('피어나'), '');
  await ctx.close();
}
{
  // 텍스트 2섹션 완료 — 진행바 초반 구간 분모 생략
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete(), 2: textComplete() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V4-6d 진행바 분모 생략(2칸 채워짐)', await page.getByText('2칸 채워짐', { exact: true }).isVisible().catch(() => false));
  ok('V4-6e 2/6 표기 부재', (await page.getByText('2/6 채워짐').count()) === 0);
  await ctx.close();
}
{
  // v7.5: 보드 뷰 제거 — 레거시 ?view=board는 desktop으로 흡수, 저장 버튼이 곧 부분 가치
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?view=board`);
  await page.waitForTimeout(1800);
  ok('V4-6f 레거시 board → PC 뷰 저장 버튼', await page.getByText('PC 배경화면 저장').isVisible().catch(() => false));
  ok('V4-6g 구 보드 뷰 카피 부재', (await page.getByText('지금 이대로도 폰·PC 배경화면으로 저장할 수 있어').count()) === 0);
  await ctx.close();
}

// ── 7) 질문 정비 — S3 현재 인식 / S5 양방향 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/3`);
  await page.waitForTimeout(1500);
  ok('V4-7a S3 current 교체', (await page.getByText('요즘 소중한 사람들과의 시간은 어때?').count()) > 0);
  ok('V4-7b 구 유산 질문 부재(본문)', (await page.getByText('어떤 사람으로 기억됐으면 좋겠어?').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/5`);
  await page.waitForTimeout(1500);
  ok('V4-7c S5 current 양방향', (await page.getByText('요즘 돈이랑 네 사이는 어때?').count()) > 0);
  await ctx.close();
}

// ── 8) /scene 가이드 카드 접힘 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V4-8a 가이드 요약줄 노출', await page.getByText('이렇게 쓰면 일기가 진짜같아져').isVisible().catch(() => false));
  ok('V4-8b 본문 기본 접힘', !(await page.getByText('순간 2~3개면 충분해').isVisible().catch(() => false)));
  await page.getByText('이렇게 쓰면 일기가 진짜같아져').click();
  await page.waitForTimeout(400);
  ok('V4-8c 펼치면 본문 노출', await page.getByText('순간 2~3개면 충분해').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.4-r1 검증 결과 =====');
for (const r of results) console.log(r);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of errors) console.log(' ', e);
}
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
process.exit(failCount > 0 ? 1 : 0);
