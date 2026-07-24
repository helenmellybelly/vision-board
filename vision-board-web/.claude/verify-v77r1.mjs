// v7.7 검증 — 미니보드 숲 정합(흰 폴라로이드 제거), 상태 아이콘 재매핑(💬/📷=다음 행동)+title 툴팁,
// 산책길 완료 구간 실선, 질문 예시 5세트(전환기형·관계공동체형), 토리 코치마크 승격, walkCaption 넛지
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

async function newPage(seed, { suppressCoach = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript(
      ({ data, suppress }) => {
        if (!localStorage.getItem('vision-board-data')) {
          localStorage.setItem('vision-board-data', JSON.stringify(data));
        }
        if (suppress) localStorage.setItem('vb-collage-coach-v1', '1');
      },
      { data: seed, suppress: suppressCoach }
    );
  }
  return { ctx, page };
}

// ── 1) 완료 시트 미니보드 — 흰 폴라로이드 부재 + 숲 타일 (v7.6 잔존 구버전 수정) ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, PIXEL, PIXEL, null, null] }),
  }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V7-1a 완료 시트 노출', await page.getByText('방금 이 칸이 채워졌어').isVisible().catch(() => false));
  ok('V7-1b 흰 폴라로이드 프레임 부재', (await page.locator('.bg-white.p-1').count()) === 0);
  // 미니보드 placeholder 칸 = FOREST.card(#33473A) 숲 타일
  const forestTiles = await page
    .evaluate(() =>
      [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).backgroundColor === 'rgb(51, 71, 58)').length
    )
    .catch(() => 0);
  ok('V7-1c 미니보드 숲 타일(#33473A)', forestTiles >= 1, `tiles=${forestTiles}`);
  await ctx.close();
}

// ── 2) 산책길 상태 아이콘 재매핑 — 💬 답하는 중 / 📷 사진 차례 / ✍️ 퇴역 + title 툴팁 ──
{
  // 혼합 시드: 1 completed / 2 text_complete / 3 사진만 / 4 in_progress / 5~6 미시작
  const { ctx, page } = await newPage(
    doneBoard({
      1: withPhoto(),
      2: textComplete(),
      3: { uploadedImages: [PIXEL, null, null] },
      4: { status: 'in_progress' },
    })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  const count = (s) => body.split(s).length - 1;
  ok('V7-2a in_progress → 💬 1개', count('💬') === 1, `💬=${count('💬')}`);
  ok('V7-2b ✍️ 퇴역(부재)', count('✍️') === 0, `✍️=${count('✍️')}`);
  ok('V7-2c text_complete·사진만 → 📷 2개', count('📷') >= 2, `📷=${count('📷')}`);
  // title 툴팁 — 상태별 "다음 행동" 문구 (aria-label 계약과 별개)
  const titleInProgress = await page.locator('button[aria-label="일·성장 — 진행 중"]').getAttribute('title').catch(() => null);
  ok('V7-2d 진행 중 title(답하는 중)', titleInProgress === '일·성장 — 지금 질문에 답하는 중이야', titleInProgress ?? 'null');
  const titleTextDone = await page.locator('button[aria-label="건강 — 글 완료"]').getAttribute('title').catch(() => null);
  ok('V7-2e 글 완료 title(사진 차례)', titleTextDone === '건강 — 글은 완성! 이제 사진 담을 차례야', titleTextDone ?? 'null');
  const titleDone = await page.locator('button[aria-label="나 — 완성"]').getAttribute('title').catch(() => null);
  ok('V7-2f 완성 title(나무)', titleDone === '나 — 완성! 나무가 자랐어', titleDone ?? 'null');
  // aria-label 계약 가드 — `${label} — ${STATUS_LABEL}` 6버튼 유지
  ok('V7-2g aria-label 계약 유지(6개)', (await page.locator('button[aria-label*=" — "]').count()) === 6);
  await ctx.close();
}

// ── 3) 사진 먼저 경로 퇴행 가드 — not_started+사진은 📷 유지 (🌰로 안 돌아간다) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: { uploadedImages: [PIXEL, null, null] } }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  const count = (s) => body.split(s).length - 1;
  ok('V7-3a 사진만 → 📷 유지', count('📷') >= 1, `📷=${count('📷')}`);
  const titlePhotoOnly = await page.locator('button[aria-label="나 — 시작 전"]').getAttribute('title').catch(() => null);
  ok('V7-3b 사진만 title(이야기도 들려줘)', titlePhotoOnly === '나 — 사진은 담아뒀어. 이야기도 들려줘!', titlePhotoOnly ?? 'null');
  await ctx.close();
}

// ── 4) 산책길 완료 구간 실선 — 걸어온 길은 다져지고, 안 걸은 길은 점선 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const dash = await page
    .locator('svg[viewBox="0 0 100 100"] path')
    .evaluateAll((els) => els.map((el) => el.getAttribute('stroke-dasharray')));
  const solid = dash.filter((d) => d === null).length;
  const dashed = dash.filter((d) => d !== null).length;
  ok('V7-4a 완료 구간 실선 1개(출발→나)', solid === 1, `solid=${solid}`);
  ok('V7-4b 미완 구간 점선 6개 잔존', dashed === 6, `dashed=${dashed}`);
  await ctx.close();
}
{
  // 전부 미시작 — 실선 0, 전 구간 점선 (회귀 가드)
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const dash = await page
    .locator('svg[viewBox="0 0 100 100"] path')
    .evaluateAll((els) => els.map((el) => el.getAttribute('stroke-dasharray')));
  ok('V7-4c 미시작 보드 → 전 구간 점선(7)', dash.length === 7 && dash.every((d) => d !== null), `paths=${dash.length}`);
  await ctx.close();
}

// ── 5) 질문 예시 5세트 — 전환기형·관계공동체형 로테이션 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  const rotate = page.getByText('다른 예시 보기');
  await rotate.click();
  await page.waitForTimeout(200);
  await rotate.click();
  await page.waitForTimeout(200);
  await rotate.click();
  await page.waitForTimeout(300);
  ok('V7-5a 세트 3 = 전환기형', await page.getByText('10년 다닌 회사를 그만두고').isVisible().catch(() => false));
  await rotate.click();
  await page.waitForTimeout(300);
  ok('V7-5b 세트 4 = 관계공동체형', await page.getByText('주중엔 팀원들 챙기고').isVisible().catch(() => false));
  await rotate.click();
  await page.waitForTimeout(300);
  ok('V7-5c 5회 클릭 → 세트 0 랩', await page.getByText('회사 다니면서 퇴근 후엔').isVisible().catch(() => false));
  await ctx.close();
}

// ── 6) 토리 코치마크 승격 — 발화자 구도 (내용·1회 노출 로직 유지) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }), { suppressCoach: false });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  const dialog = page.locator('[role="dialog"][aria-label="콜라주 편집 안내"]');
  ok('V7-6a 코치마크 토리 아바타', (await dialog.locator('img[src*="tori-profile-bust"]').count()) === 1);
  ok('V7-6b 발화자 라벨(정원사 토리)', await dialog.getByText('정원사 토리').isVisible().catch(() => false));
  ok('V7-6c 타이틀 유지', await dialog.getByText('이 보드, 직접 꾸밀 수 있어').isVisible().catch(() => false));
  ok('V7-6d 3항목 유지(비율 안내)', await dialog.getByText('기기 사이즈를 고르면').isVisible().catch(() => false));
  await ctx.close();
}

// ── 7) walkCaption 넛지 — "차분히 한 칸" 가치 카피 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V7-7a 넛지 카피(서두르지 않아도 돼)', await page.getByText('서두르지 않아도 돼').isVisible().catch(() => false));
  ok('V7-7b 기존 진행 캡션 유지(1/6)', await page.getByText('1/6 스테이션을 지났어').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.7-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
