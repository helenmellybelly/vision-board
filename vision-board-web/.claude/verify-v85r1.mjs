// v8.5 검증 — /diary 인라인 다듬기·헤더 승격·탭 랩·날짜 변경·대시보드 가치 IA·
// 미니멀 혼합 그리드·반자동 리사이즈(고스트 프리뷰·자유 배치 안내)
// 계약: ① /diary 헤더 oneSentence(전 탭)·날짜 탭 수정(targetDate 저장)
// ② 탭바 flex-wrap(overflow-x-auto 부재)·탭 전환 스크롤 리셋
// ③ 전체 탭 인라인 AI 다시 쓰기(확인 배너→모킹 생성→storyPromptVersion=3 스탬프→넛지 접힘)
// ④ 직접 수정하기(보드·섹션) — saveFutureDayStory/saveMiniStory 경유 저장
// ⑤ 섹션 AI 수정 2회 캡(diaryRegenCount) — /scene과 같은 카운터
// ⑥ 대시보드: 북극성 한 문장 + D-day 줄(→/diary), 업그레이드 넛지 → /diary
// ⑦ 미니멀 혼합 그리드 크기 위계 (실렌더)
// ⑧ 반자동 리사이즈: 드래그 중 고스트 프리뷰, 자유 배치 1회 안내
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
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
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}

const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const withPhoto = (n = '스토리') =>
  ({ status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: `${n}.`,
     uploadedImages: [PIXEL, null, null, null, null] });
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
// 완주 시드 — finishCelebrated:true(파티클 억제)·storyPromptVersion:3(넛지 억제)이 기본.
// 넛지를 검증할 땐 storyPromptVersion을 명시적으로 지운다
const finishedBoard = (extra = {}) => {
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto(`일기${id}`);
  return board(overrides, {
    futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.',
    finishCelebrated: true, storyPromptVersion: 3, ...extra,
  });
};

const browser = await chromium.launch();
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };

async function newPage(seed, viewport = NARROW) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
      localStorage.setItem('vb-collage-coach-v1', '1');
    }, seed);
  }
  return { ctx, page };
}
const loadStored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}'));

// ── 1) /diary 헤더 — oneSentence 전 탭 노출 + 날짜 탭 수정 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  ok('V85-1a 헤더 한 문장(전체 탭)', await page.getByText('“여유로운 사람.”').isVisible().catch(() => false));
  const tablist = page.getByRole('tablist', { name: '일기 보기 선택' });
  const cls = (await tablist.getAttribute('class').catch(() => '')) ?? '';
  ok('V85-1b 탭바 랩(가로 스크롤 제거)', cls.includes('flex-wrap') && !cls.includes('overflow-x-auto'), cls.slice(0, 60));
  await page.getByRole('tab', { name: '건강', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V85-1c 헤더 한 문장(섹션 탭)', await page.getByText('“여유로운 사람.”').isVisible().catch(() => false));
  // 날짜 수정 — 탭 → input[type=date] → 저장
  await page.getByRole('button', { name: '일기 날짜 수정' }).click();
  const dateInput = page.locator('input[type="date"]');
  ok('V85-1d 날짜 입력 노출', await dateInput.isVisible().catch(() => false));
  await dateInput.fill('2030-01-01');
  await page.waitForTimeout(400);
  const stored = await loadStored(page);
  ok('V85-1e targetDate 저장', stored.targetDate === '2030-01-01', `targetDate=${stored.targetDate}`);
  // blur로 입력을 닫아야 라벨이 복귀한다
  await page.locator('h1').click();
  await page.waitForTimeout(300);
  ok('V85-1f 날짜 표시 갱신', await page.getByText('2030년 1월 1일').first().isVisible().catch(() => false));
  await ctx.close();
}

// ── 2) 탭 전환 스크롤 리셋 — 긴 본문을 읽다 탭을 바꾸면 맨 위로 ──
{
  const longStory = Array.from({ length: 40 }, (_, i) => `문장 ${i}이 이어진다.`).join(' ');
  const { ctx, page } = await newPage(finishedBoard({ futureDayStory: longStory }));
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole('tab', { name: '건강', exact: true }).click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.scrollY);
  ok('V85-2 탭 전환 스크롤 리셋', before > 100 && after <= 10, `before=${before} after=${after}`);
  await ctx.close();
}

// ── 3) 전체 탭 인라인 AI 다시 쓰기 — 확인 배너 → 생성 → 스탬프 → 넛지 접힘 ──
{
  const { ctx, page } = await newPage(finishedBoard({ storyPromptVersion: undefined }));
  await page.route('**/api/story', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ story: '새로 쓴 미래의 하루.' }) })
  );
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  ok('V85-3a 업그레이드 넛지(구 이야기)', await page.getByText('이야기 짓는 솜씨가 늘었어').isVisible().catch(() => false));
  await page.getByText('🔄 AI로 다시 쓰기').click();
  await page.waitForTimeout(300);
  ok('V85-3b 확인 배너', await page.getByText('지금 이야기를 처음부터 새로 쓸까?').isVisible().catch(() => false));
  await page.getByRole('button', { name: '새로 쓰기', exact: true }).click();
  await page.waitForTimeout(1500);
  ok('V85-3c 새 이야기 렌더', await page.getByText('새로 쓴 미래의 하루.').isVisible().catch(() => false));
  const stored = await loadStored(page);
  ok('V85-3d saveFutureDayStory 스탬프', stored.futureDayStory === '새로 쓴 미래의 하루.' && stored.storyPromptVersion === 3,
    `v=${stored.storyPromptVersion}`);
  ok('V85-3e 넛지 접힘(버전 스탬프)', (await page.getByText('이야기 짓는 솜씨가 늘었어').count()) === 0);
  ok('V85-3f /finish 미이동(인라인)', page.url().includes('/diary'), page.url());
  await ctx.close();
}

// ── 4) 전체 탭 직접 수정하기 — textarea 저장 → saveFutureDayStory 경유 ──
{
  const { ctx, page } = await newPage(finishedBoard({ storyPromptVersion: undefined }));
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  await page.getByText('✍️ 직접 수정하기').click();
  const ta = page.locator('textarea');
  ok('V85-4a 인라인 textarea', await ta.isVisible().catch(() => false));
  await ta.fill('손으로 고친 하루.');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V85-4b 수정 본문 렌더', await page.getByText('손으로 고친 하루.').isVisible().catch(() => false));
  const stored = await loadStored(page);
  ok('V85-4c 저장 경로 스탬프(직접 수정도 최신본)', stored.futureDayStory === '손으로 고친 하루.' && stored.storyPromptVersion === 3,
    `v=${stored.storyPromptVersion}`);
  await ctx.close();
}

// ── 5) 섹션 탭 다듬기 — AI 수정 2회 캡(/scene 공유 카운터) + 직접 수정 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.route('**/api/story/section', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ story: '다시 그린 건강한 하루.' }) })
  );
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: '건강', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V85-5a AI로 수정하기 노출(캡 미달)', await page.getByText('🔄 AI로 수정하기').isVisible().catch(() => false));
  await page.getByText('🔄 AI로 수정하기').click();
  await page.waitForTimeout(1500);
  ok('V85-5b 섹션 일기 갱신', await page.getByText('다시 그린 건강한 하루.').isVisible().catch(() => false));
  const stored = await loadStored(page);
  ok('V85-5c saveMiniStory + regen 카운트', stored.sections?.[2]?.miniStory === '다시 그린 건강한 하루.' && stored.sections?.[2]?.diaryRegenCount === 1,
    `regen=${stored.sections?.[2]?.diaryRegenCount}`);
  // 직접 수정
  await page.getByText('✍️ 직접 수정하기').click();
  await page.locator('textarea').fill('손으로 고친 건강.');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  const stored2 = await loadStored(page);
  ok('V85-5d 섹션 직접 수정 저장', stored2.sections?.[2]?.miniStory === '손으로 고친 건강.');
  await ctx.close();
}
{
  // 캡 도달 시드 — AI 수정 비노출 + 안내 카피
  const seed = finishedBoard();
  seed.sections[2].diaryRegenCount = 2;
  const { ctx, page } = await newPage(seed);
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: '건강', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V85-5e 캡 도달: AI 수정 비노출', (await page.getByText('🔄 AI로 수정하기').count()) === 0);
  ok('V85-5f 캡 안내 카피', await page.getByText('새로 쓰기는 여기까지').isVisible().catch(() => false));
  ok('V85-5g 직접 수정은 유지', await page.getByText('✍️ 직접 수정하기').isVisible().catch(() => false));
  await ctx.close();
}

// ── 6) 완주 대시보드 가치 IA — 북극성 한 문장 + D-day 줄(→/diary) + 넛지 → /diary ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V85-6a 북극성 한 문장', await page.getByText('“여유로운 사람.”').isVisible().catch(() => false));
  const ddayBtn = page.getByRole('button', { name: /그 하루까지 \d+일/ });
  ok('V85-6b D-day 줄', await ddayBtn.isVisible().catch(() => false));
  await ddayBtn.click();
  await page.waitForTimeout(800);
  ok('V85-6c D-day 탭 → /diary', page.url().includes('/diary'), page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(finishedBoard({ storyPromptVersion: undefined }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('이야기 짓는 솜씨가 늘었어').click();
  await page.waitForTimeout(800);
  ok('V85-6d 대시보드 넛지 → /diary(구 /finish 아님)', page.url().includes('/diary'), page.url());
  await ctx.close();
}

// ── 7) 미니멀 혼합 그리드 — 크기 위계 실렌더 (폰 n=5: 히어로 ≥ 1.8× 최소 셀) ──
{
  const overrides = {};
  for (let id = 1; id <= 5; id++) overrides[id] = withPhoto(`일기${id}`);
  const { ctx, page } = await newPage(board(overrides, { collageTemplate: 'minimal' }), NARROW);
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(2000);
  const widths = await page
    .locator('[data-testid="collage-board"][data-view="phone"] img')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  const maxW = Math.max(...widths);
  const minW = Math.min(...widths);
  ok('V85-7 미니멀 크기 위계(n=5)', widths.length === 5 && maxW >= minW * 1.8,
    `max=${maxW.toFixed(0)} min=${minW.toFixed(0)}`);
  await ctx.close();
}

// ── 8) 반자동 리사이즈 — 드래그 중 고스트 프리뷰, 자유 배치 1회 안내 ──
{
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto(`일기${id}`);
  const { ctx, page } = await newPage(board(overrides), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  const handle = bd.locator('div[aria-label="크기 조절"]').nth(1);
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2 + 120, { steps: 6 });
  await page.waitForTimeout(200);
  ok('V85-8a 드래그 중 고스트 프리뷰', (await page.locator('[data-testid="reflow-preview"]').count()) === 1);
  await page.mouse.up();
  await page.waitForTimeout(600);
  ok('V85-8b 놓으면 프리뷰 제거', (await page.locator('[data-testid="reflow-preview"]').count()) === 0);
  await ctx.close();
}
{
  // v9.0 계약 반전 — 구 V85-8c/8d는 "그리드 역산 실패 시 자유 배치 안내"를 단언했다.
  // 이제 배치의 진실 원천이 명시적 grid라 역산 실패 자체가 없어졌고, 안내 토스트도 삭제됐다.
  // 대신 단언할 것: 레거시 자유 좌표 배치에서도 리사이즈가 자동 정렬로 살아난다(불사 계약).
  const overrides = { 1: { ...withPhoto('일기1'), uploadedImages: [PIXEL, PIXEL, PIXEL, null, null] } };
  const phoneAspect = 9 / 19.5;
  const freeform = {
    items: {
      '1-0': { x: 0.05, y: 0.3, w: 0.2, z: 1 },
      '1-1': { x: 0.4, y: 0.45, w: 0.33, z: 2 },
      '1-2': { x: 0.1, y: 0.65, w: 0.41, z: 3 },
    },
    aspect: phoneAspect,
    edited: true,
  };
  const { ctx, page } = await newPage(
    board(overrides, {
      collageDevicePresets: { phone: 'phone' },
      collageDeviceLayouts: { phone: { editorial: freeform } },
      schemaVersion: 5,
    }),
    NARROW
  );
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="phone"]');
  const rectsOf = () =>
    bd.locator('img[data-photo]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top.toFixed(1)).join('|'));
  const before = await rectsOf();
  // v10 에디토리얼은 풀블리드라 '빈 곳 탭'이 없다 — 상시 어포던스 버튼이 결정적 진입점
  await page.getByRole('button', { name: /탭해서 편집/ }).first().click();
  await page.waitForTimeout(600);
  const handle = bd.locator('div[aria-label="크기 조절"]').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  ok('V85-8c 자유 배치 안내 폐기', (await page.getByText('자동 정렬은 쉬어 갈게').count()) === 0);
  ok('V85-8d 레거시 배치도 자동 정렬', (await rectsOf()) !== before);
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.5 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
