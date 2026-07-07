// v7.0-r3 검증 — 스토리 일기 형식(날짜 헤더·탭 수정)·targetDate 도입·boardYear 흡수(v3)
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

const doneBoard = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), ...extra,
});

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ── 1) targetDate 미설정 → 일기 헤더에 기본(+3년) 날짜 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '카페의 하루', miniStory: '아침이 **느긋하다**. 오늘 하루, 나쁘지 않았다.' }),
  }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  const expectYear = String(new Date().getFullYear() + 3);
  ok('R3-1a 일기 헤더 기본 날짜(+3년)', await page.getByText(`${expectYear}년`).isVisible().catch(() => false));
  ok('R3-1b 요일 포함 포맷', await page.getByText(/요일/).first().isVisible().catch(() => false));
  ok('R3-1c 기존 miniStory 원형 렌더', await page.getByText('느긋하다').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r3-diary-header.png`, fullPage: true });
  await ctx.close();
}

// ── 2) 레거시 boardYear → targetDate 마이그레이션(v3) ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루', miniStory: '원형 스토리.' }),
  }, { boardYear: '2028' /* schemaVersion 없음 = 레거시 */ }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const board = await readBoard(page);
  ok('R3-2a targetDate 연도 승계', board?.targetDate?.startsWith('2028-'), `targetDate=${board?.targetDate}`);
  ok('R3-2b boardYear 제거', board?.boardYear === undefined || board?.boardYear === null);
  ok('R3-2c schemaVersion 3', board?.schemaVersion === 3, `v=${board?.schemaVersion}`);
  ok('R3-2d miniStory 원형 보존', board?.sections?.[1]?.miniStory === '원형 스토리.');
  await ctx.close();
}

// ── 3) 날짜 탭 편집 → 저장·전 섹션 공유 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루1', miniStory: '스토리 하나.' }),
    2: textComplete({ sceneText: '하루2', miniStory: '스토리 둘.' }),
  }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  await page.getByLabel('일기 날짜 수정').click();
  await page.waitForTimeout(300);
  await page.locator('input[type="date"]').fill('2030-01-02');
  await page.locator('input[type="date"]').blur();
  await page.waitForTimeout(500);
  ok('R3-3a 편집 후 헤더 갱신', await page.getByText('2030년 1월 2일').isVisible().catch(() => false));
  const board = await readBoard(page);
  ok('R3-3b targetDate 저장', board?.targetDate === '2030-01-02', `targetDate=${board?.targetDate}`);
  await page.goto(`${BASE}/scene/2`);
  await page.waitForTimeout(1200);
  ok('R3-3c 다른 섹션 일기도 같은 날짜', await page.getByText('2030년 1월 2일').isVisible().catch(() => false));
  await ctx.close();
}

// ── 4) 스토리 생성 payload에 targetDate·keyword 포함 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }, { targetDate: '2031-05-05' }));
  let payload = null;
  await page.route('**/api/story/section', async (route) => {
    payload = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ story: '목 스토리 **한 줄**.' }),
    });
  });
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1200);
  await page.locator('textarea').first().fill('한강을 따라 달리는 아침');
  await page.getByText('다 썼어').click();
  await page.waitForTimeout(1500);
  ok('R3-4a payload.targetDate 포함', payload?.targetDate === '2031-05-05', `targetDate=${payload?.targetDate}`);
  ok('R3-4b payload keyword 포함', payload?.extractedSlots?.keyword === '여유로운');
  ok('R3-4c 생성 후 일기 헤더 표시', await page.getByText('2031년 5월 5일').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) 콜라주 중앙 연도 = targetDate 연도 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루', miniStory: '스토리.', status: 'completed', uploadedImages: [PIXEL, null, null, null, null] }),
  }, { targetDate: '2031-05-05' }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  // v7.0-r5부터 선택 화면이 먼저 — 보드 뷰로 들어가 중앙 연도 확인
  await page.getByText('그냥 보드로 보기').click().catch(() => {});
  await page.waitForTimeout(1200);
  ok('R3-5 콜라주 연도 = targetDate 연도', await page.getByText('2031').first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r3-collage-year.png`, fullPage: true });
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r3 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
