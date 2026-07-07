// v7.0-r2 검증 — /scene+/moment 통합·ProcessBar 4단계·situationText 병합 마이그레이션(v2)
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
  return {
    status: 'text_complete',
    slots: {
      1: { text: '바쁘게 사는 사람', isDeferred: false },
      2: { text: '여유로운', isDeferred: false },
      3: { text: '혼자 여행', isDeferred: false },
      5: { text: '충만한', isDeferred: false },
    },
    extractedSlots: { ...FULL_EXTRACTED },
    ...extra,
  };
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

const doneBoard = (overrides) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(),
});

// ── 1) ProcessBar 4단계 라벨 + '미래 스토리' 부재 ──
{
  const { ctx, page } = await newPage(doneBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R2-1a 4단계: 꿈 꺼내기', await page.getByText('꿈 꺼내기').first().isVisible().catch(() => false));
  ok('R2-1b 4단계: 하루 그리기', await page.getByText('하루 그리기').first().isVisible().catch(() => false));
  ok('R2-1c 4단계: 사진 담기', await page.getByText('사진 담기').first().isVisible().catch(() => false));
  ok('R2-1d 구 3단계(미래 스토리) 부재', (await page.getByText('미래 스토리').count()) === 0);
  await ctx.close();
}

// ── 2) /scene 통합 페이지: 질문 1개 + 칩 탭 → 입력 append ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('R2-2a 통합 질문 렌더', await page.getByText('그날의 하루, 어디서 뭘 하고 있어?').isVisible().catch(() => false));
  ok('R2-2b 구 순간 질문 부재', (await page.getByText('어떤 장면들이 눈에 들어와').count()) === 0);
  ok('R2-2c 순간 보태기 칩 안내', await page.getByText('이런 순간을 보태도 좋아').isVisible().catch(() => false));
  const chip = page.getByText('통창 있는 내 서재');
  ok('R2-2d 섹션 칩 렌더', await chip.isVisible().catch(() => false));
  await chip.click();
  await page.waitForTimeout(300);
  const textarea = page.locator('textarea');
  const val = await textarea.first().inputValue().catch(() => '');
  ok('R2-2e 칩 탭 → textarea append', val.includes('통창 있는 내 서재'), `value="${val.slice(0, 30)}"`);
  await page.screenshot({ path: `${OUT}/v7r2-scene-write.png`, fullPage: true });
  await ctx.close();
}

// ── 3) 제출 → 같은 페이지에서 스토리 로딩/결과 (API 키 없으면 재시도 UI) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  // 스토리 API를 목 응답으로 인터셉트 — 키 유무와 무관하게 UI 흐름 검증
  let payload = null;
  await page.route('**/api/story/section', async (route) => {
    payload = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ story: '아침 햇살이 창을 넘는다. **커피를 내리는 손이 느긋하다.** 오늘 하루, 나쁘지 않았다.' }),
    });
  });
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1200);
  await page.locator('textarea').first().fill('카페 창가에서 책 읽는 하루');
  await page.getByText('다 썼어').click();
  await page.waitForTimeout(1500);
  // v7.0-r3에서 카드 헤더가 '이 삶의 하루' 라벨 → 일기 날짜로 바뀜 — 스토리 본문으로 확인
  ok('R2-3a 같은 페이지에서 스토리 카드', await page.getByText('커피를 내리는 손이 느긋하다').isVisible().catch(() => false));
  ok('R2-3b 다음 CTA(이미지 만들기)', await page.getByText('비전보드 이미지 만들기').isVisible().catch(() => false));
  ok('R2-3c payload에 situationText 없음', payload !== null && !('situationText' in payload));
  ok('R2-3d payload에 sceneText 포함', payload?.sceneText === '카페 창가에서 책 읽는 하루');
  const board = await readBoard(page);
  ok('R2-3e sceneText·miniStory 저장', !!board?.sections?.[1]?.sceneText && !!board?.sections?.[1]?.miniStory);
  await page.screenshot({ path: `${OUT}/v7r2-scene-story.png`, fullPage: true });
  await ctx.close();
}

// ── 4) 마이그레이션 v2: situationText 병합 (miniStory 없음 → sceneText에 합침) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections({
      1: textComplete({ sceneText: '카페의 하루', situationText: '창가의 순간' }),
      2: textComplete({ sceneText: '러닝의 하루', situationText: '새벽 공기', miniStory: '이미 완성된 스토리.' }),
    }),
    onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌', startedAt: Date.now(),
    // schemaVersion 없음 = 레거시
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const board = await readBoard(page);
  const s1 = board?.sections?.[1];
  const s2 = board?.sections?.[2];
  ok('R2-4a 스토리 없으면 sceneText 병합', s1?.sceneText === '카페의 하루\n창가의 순간', `sceneText="${s1?.sceneText}"`);
  ok('R2-4b situationText 제거(1)', s1?.situationText === undefined || s1?.situationText === null);
  ok('R2-4c 스토리 있으면 병합 안 함', s2?.sceneText === '러닝의 하루', `sceneText="${s2?.sceneText}"`);
  ok('R2-4d situationText 제거(2)', s2?.situationText === undefined || s2?.situationText === null);
  // 이후 라운드가 버전을 올리므로 >=2로 확인 (v2 병합 실행 여부는 R2-4a~d가 보장)
  ok('R2-4e schemaVersion 기록(>=2)', (board?.schemaVersion ?? 0) >= 2, `v=${board?.schemaVersion}`);
  // 병합 텍스트가 /scene 입력에 프리필되는지 (중간 이탈자 입력 보존)
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1200);
  const val = await page.locator('textarea').first().inputValue().catch(() => '');
  ok('R2-4f 병합 텍스트 입력 프리필', val === '카페의 하루\n창가의 순간', `value="${val}"`);
  // 2회 로드 무해성
  await page.reload();
  await page.waitForTimeout(1200);
  const board2 = await readBoard(page);
  ok('R2-4g 재로드 후 이중 병합 없음', board2?.sections?.[1]?.sceneText === '카페의 하루\n창가의 순간');
  await ctx.close();
}

// ── 5) /moment 스텁 — v7.1에서 철거됨 (배포 1사이클 유예 종료), 404 확인으로 대체 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  const res = await page.goto(`${BASE}/moment/1`);
  ok('R2-5 /moment/1 스텁 철거 (404)', res?.status() === 404, `status=${res?.status()}`);
  await ctx.close();
}

// ── 6) 라우팅 회귀: 대시보드 카드 분기 (text_complete + miniStory → /scenes) ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루', miniStory: '스토리 완성.' }),
  }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('나 자신').click();
  await page.waitForTimeout(1500);
  ok('R2-6a 스토리 있는 카드 → /scenes/1', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('나 자신').click();
  await page.waitForTimeout(1500);
  ok('R2-6b 스토리 없는 text_complete 카드 → /scene/1', new URL(page.url()).pathname === '/scene/1', page.url());
  await ctx.close();
}

// ── 7) 기존 miniStory 사용자 /scene 재방문 → 결과 화면 (스토리 카드 + CTA) ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '카페의 하루', miniStory: '완성된 **스토리**다.' }),
  }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('R2-7a 재방문 시 스토리 카드', await page.getByText('완성된').isVisible().catch(() => false));
  ok('R2-7b 하루 다시 쓰기 링크', await page.getByText('하루 다시 쓰기').isVisible().catch(() => false));
  ok('R2-7c CTA', await page.getByText('비전보드 이미지 만들기').isVisible().catch(() => false));
  await ctx.close();
}

// ── 8) /review CTA 회귀 — getNextIncompleteRoute가 /scene을 가리킨다 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete(), 2: textComplete(), 3: textComplete(),
    4: textComplete(), 5: textComplete(), 6: textComplete(),
  }));
  await page.goto(`${BASE}/review`);
  await page.waitForTimeout(1500);
  await page.getByText('미래의 하루 그리기 시작').click();
  await page.waitForTimeout(1500);
  ok('R2-8 /review CTA → /scene/1', new URL(page.url()).pathname === '/scene/1', page.url());
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r2 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
