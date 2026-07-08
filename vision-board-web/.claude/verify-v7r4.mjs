// v7.0-r4 검증 — 이미지 소스 재편: 업로드 우선·큐레이션 갤러리·AI 묘사 lazy 힌트화·Unsplash 검색 접힘
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [],
    };
  }
  for (const [id, extra] of Object.entries(overrides)) {
    Object.assign(sections[id], extra);
  }
  return sections;
}

const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };

function textComplete(extra = {}) {
  return { status: 'text_complete', slots: {}, extractedSlots: { ...FULL_EXTRACTED }, ...extra };
}

const PIXEL_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PIXEL = `data:image/png;base64,${PIXEL_B64}`;

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
    }, seed);
  }
  return { ctx, page };
}

const readBoard = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? 'null'));

const doneBoard = (overrides) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(),
});

const SCENES_SEED = () => doneBoard({
  1: textComplete({ sceneText: '카페의 하루', miniStory: '완성된 스토리.' }),
});

// ── 1) 마운트 시 /api/image/describe 미호출 + 재배치 확인 ──
{
  const { ctx, page } = await newPage(SCENES_SEED());
  let describeCalled = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/image/describe')) describeCalled++;
  });
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(2500);
  ok('R4-1a 마운트 시 describe 미호출 (lazy)', describeCalled === 0, `calls=${describeCalled}`);
  ok('R4-1b 직접 사진 올리기 버튼 (1순위, v7.3 리네임)', await page.getByText('직접 사진 올리기').isVisible().catch(() => false));
  ok('R4-1c 샘플 갤러리 섹션', await page.getByText('샘플에서 고르기').isVisible().catch(() => false));
  ok('R4-1d 카테고리 칩(운동·건강)', await page.getByText('운동·건강').isVisible().catch(() => false));
  ok('R4-1e 더 찾아보기 접힘 (검색 인풋 미노출)', !(await page.getByPlaceholder('검색어 (영어가 결과가 좋아)').isVisible().catch(() => false)));
  ok('R4-1f 구 필수 묘사 스텝 헤더 부재', (await page.getByText('네 하루에서 순간 3개를 골라봤어').count()) === 0);
  ok('R4-1g Unsplash 어트리뷰션', await page.getByText('Photos from').first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r4-scenes-top.png`, fullPage: true });
  await ctx.close();
}

// ── 2) 카테고리 칩 전환 → 갤러리 교체 ──
{
  const { ctx, page } = await newPage(SCENES_SEED());
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  // 섹션1(나)의 기본 카테고리는 자연·휴식 — 여행·자유로 전환
  const before = await page.locator('.flex.gap-2.overflow-x-auto img').first().getAttribute('src').catch(() => '');
  await page.getByText('여행·자유').click();
  await page.waitForTimeout(800);
  const after = await page.locator('.flex.gap-2.overflow-x-auto img').first().getAttribute('src').catch(() => '');
  ok('R4-2 카테고리 전환 → 사진 교체', !!before && !!after && before !== after);
  await ctx.close();
}

// ── 3) 큐레이션 사진 탭 → 슬롯 저장 + download 핑 ──
{
  const { ctx, page } = await newPage(SCENES_SEED());
  let downloadPing = 0;
  await page.route('**/api/image/proxy**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PIXEL_B64, 'base64') });
  });
  await page.route('**/api/unsplash?download=**', async (route) => {
    downloadPing++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label*="담기"]').first().click();
  await page.waitForTimeout(2000);
  const board = await readBoard(page);
  const slot0 = board?.sections?.[1]?.uploadedImages?.[0] ?? '';
  ok('R4-3a 큐레이션 탭 → 슬롯 base64 저장', slot0.startsWith('data:image/'), slot0.slice(0, 22));
  ok('R4-3b Unsplash download 핑 발생', downloadPing >= 1, `pings=${downloadPing}`);
  ok('R4-3c 담았어 피드백', await page.getByText('✓ 담았어').first().isVisible().catch(() => false));
  await ctx.close();
}

// ── 4) 슬롯 가득 찼을 때 안내 (PICK_NOTICES.full) ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({
      sceneText: '하루', miniStory: '스토리.',
      uploadedImages: [PIXEL, PIXEL, PIXEL, null, null],
    }),
  }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label*="담기"]').first().click();
  await page.waitForTimeout(800);
  ok('R4-4 3장 가득 → 안내 노출', await page.getByText('사진 3장이 가득 찼어').first().isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) 더 찾아보기 펼침 → AI 힌트 lazy + 키워드 검색 연결 ──
{
  const { ctx, page } = await newPage(SCENES_SEED());
  let describeCalled = 0;
  let searchQuery = '';
  await page.route('**/api/image/describe', async (route) => {
    describeCalled++;
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ descriptions: ['창가에서 커피 마시는 아침', '한강을 달리는 오후', '책상 위 노트북과 노트'] }),
    });
  });
  await page.route('**/api/image/keywords', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ keywords: ['morning coffee window', 'river running', 'cozy desk'] }),
    });
  });
  await page.route('**/api/unsplash?q=**', async (route) => {
    searchQuery = new URL(route.request().url()).searchParams.get('q') ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ photos: [] }) });
  });
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('더 찾아보기').click();
  await page.waitForTimeout(500);
  ok('R4-5a 펼침 → 검색 인풋 노출', await page.getByPlaceholder('검색어 (영어가 결과가 좋아)').isVisible().catch(() => false));
  ok('R4-5b 펼쳐도 힌트는 버튼 대기 (자동 호출 없음)', describeCalled === 0);
  await page.getByText('토리에게 힌트 받기').click();
  await page.waitForTimeout(1200);
  ok('R4-5c 힌트 요청 발생', describeCalled === 1);
  ok('R4-5d 묘사 3개 렌더', await page.getByText('한강을 달리는 오후').isVisible().catch(() => false));
  const kwBtn = page.getByText('이 키워드로 검색').first();
  ok('R4-5e 키워드 검색 버튼', await kwBtn.isVisible().catch(() => false));
  await kwBtn.click();
  await page.waitForTimeout(1000);
  ok('R4-5f 키워드로 검색 실행', searchQuery === 'morning coffee window', `q=${searchQuery}`);
  // v7.3: URL 입력이 ① 직접 올리기 아래 토글로 이동 — 토글 열고 확인
  await page.getByText('이미지 주소(URL)로 담기').click();
  await page.waitForTimeout(400);
  ok('R4-5g URL 붙여넣기 인풋 (① 토글)', await page.getByPlaceholder('이미지 URL 주소 붙여넣기').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r4-scenes-more.png`, fullPage: true });
  await ctx.close();
}

// ── 6) 3장 저장 → 완료 시트 회귀 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({
      sceneText: '하루', miniStory: '스토리.',
      uploadedImages: [PIXEL, PIXEL, PIXEL, null, null],
    }),
  }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('R4-6a 완료 시트', await page.getByText(/완성! \d\/6이야/).isVisible().catch(() => false));
  ok('R4-6b 다음 섹션 CTA', await page.getByText(/다음: .+ 이어가기/).isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r4 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
