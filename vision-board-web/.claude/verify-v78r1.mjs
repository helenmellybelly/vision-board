// v7.8 검증 — 첫 보드 마일스톤(임계값 3): /finish·최종 스토리 조기 개방(대시보드·콜라주·완료 시트),
// storyWrittenAtCount 스탬프, "이야기 다시 써줄까" 재작성 넛지(기존 데이터 비노출 가드), 6/6 상향 카피
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
const completedN = (n) => {
  const o = {};
  for (let id = 1; id <= n; id++) o[id] = withPhoto();
  return o;
};

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

// ── 1) 임계값 미달(2 completed) — 조기 개방 CTA 부재 ──
{
  const { ctx, page } = await newPage(doneBoard(completedN(2)));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V8-1a 대시보드 첫 보드 CTA 부재(2/6)', (await page.getByText('첫 보드가 열렸어').count()) === 0);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1200);
  ok('V8-1b 콜라주 완성 CTA 부재(2/6)', (await page.getByText('보드 완성하기').count()) === 0);
  await ctx.close();
}

// ── 2) 임계값 도달(3 completed, 스토리 없음) — 조기 개방 ──
{
  const { ctx, page } = await newPage(doneBoard(completedN(3)));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V8-2a 대시보드 첫 보드 CTA 노출(3/6)', await page.getByText('첫 보드가 열렸어').isVisible().catch(() => false));
  ok('V8-2b 추천 카드 병행 유지', await page.getByText('토리가 여기서 기다려').isVisible().catch(() => false));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1200);
  ok('V8-2c 콜라주 첫 보드 완성 CTA', await page.getByText('첫 보드 완성하기 🐿️').isVisible().catch(() => false));
  ok('V8-2d 부분 상태 micro 카피', await page.getByText('지금 자란 나무들로 첫 이야기를 써줄게').isVisible().catch(() => false));
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1200);
  ok('V8-2e /finish 부분 헤딩(첫 보드가 열렸어)', await page.getByText('첫 보드가 열렸어.').isVisible().catch(() => false));
  ok('V8-2f /finish 부분 카피(먼저 자란 3가지)', await page.getByText('먼저 자란 3가지 영역').isVisible().catch(() => false));
  await ctx.close();
}

// ── 3) allTextDone이면 /review CTA가 우선 — 첫 보드 CTA 중첩 방지 ──
{
  const { ctx, page } = await newPage(
    doneBoard({ ...completedN(3), 4: textComplete(), 5: textComplete(), 6: textComplete() })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V8-3a /review CTA 노출', await page.getByText('미래의 하루를 그리러 가자').isVisible().catch(() => false));
  ok('V8-3b 첫 보드 CTA 부재(중첩 방지)', (await page.getByText('첫 보드가 열렸어').count()) === 0);
  await ctx.close();
}

// ── 4) 6/6 — 기존 계약 불변 ──
{
  const { ctx, page } = await newPage(doneBoard(completedN(6)));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1200);
  ok('V8-4a 6/6 라벨 불변(내 비전보드 완성하기)', await page.getByText('내 비전보드 완성하기 🐿️').isVisible().catch(() => false));
  ok('V8-4b 6/6 micro 불변', await page.getByText('완성하면 미래의 하루 이야기를 써줄게.').isVisible().catch(() => false));
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1200);
  ok('V8-4c /finish 6/6 헤딩 불변(다 됐어)', await page.getByText('다 됐어.').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) 스탬프 기록 + 첫 보드 완성 화면 — /api/story 모킹으로 E2E ──
{
  const { ctx, page } = await newPage(doneBoard(completedN(3)));
  await page.route('**/api/story', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ story: '나는 여유로운 하루를 산다.' }) })
  );
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1200);
  await page.getByText('한 문장 써보기 →').click();
  await page.locator('textarea').fill('여유롭게 사는 사람.');
  await page.getByText('이 문장으로 할게 →').click();
  await page.waitForTimeout(1500);
  ok('V8-5a 모의 스토리 렌더', await page.getByText('나는 여유로운 하루를 산다.').isVisible().catch(() => false));
  const stamp = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')).storyWrittenAtCount);
  ok('V8-5b storyWrittenAtCount=3 스탬프', stamp === 3, `stamp=${stamp}`);
  await page.getByText('비전보드 완성 →').click();
  await page.waitForTimeout(800);
  ok('V8-5c 첫 비전보드 완성 타이틀', await page.getByText('헬렌의 첫 비전보드가 완성됐어 🐿️').isVisible().catch(() => false));
  ok('V8-5d 6/6 상향 카피(완전한 보드)', await page.getByText('완전한 보드').isVisible().catch(() => false));
  await ctx.close();
}

// ── 6) 재작성 넛지 — 스토리 후 보드가 자람(스탬프 3, 완료 4) ──
{
  const { ctx, page } = await newPage(
    doneBoard(completedN(4), { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 3, oneSentence: '여유로운 사람.' })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V8-6a 대시보드 재작성 넛지', await page.getByText('보드가 더 자랐네 — 이야기 다시 써줄까?').isVisible().catch(() => false));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1200);
  ok('V8-6b 콜라주 재작성 넛지 라벨', await page.getByText('보드가 자랐네 — 다시 써줄까? →').isVisible().catch(() => false));
  await ctx.close();
}

// ── 7) 기존 데이터 가드 — 스탬프 없는 futureDayStory는 넛지 비노출 ──
{
  const { ctx, page } = await newPage(
    doneBoard(completedN(4), { futureDayStory: '미래의 어느 하루.', oneSentence: '여유로운 사람.' })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V8-7a 대시보드 넛지 부재(구 데이터)', (await page.getByText('이야기 다시 써줄까?').count()) === 0);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1200);
  ok('V8-7b 콜라주 라벨 유지(다시 쓰러 가기)', await page.getByText('다시 쓰러 가기 →').isVisible().catch(() => false));
  await ctx.close();
}

// ── 8) 완료 시트 — 3번째 나무가 자란 순간 첫 보드 CTA ──
{
  const { ctx, page } = await newPage(doneBoard({
    ...completedN(2),
    3: textComplete({ sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, PIXEL, PIXEL, null, null] }),
  }));
  await page.goto(`${BASE}/scenes/3`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V8-8a 완료 시트(완성! 3/6)', await page.getByText('완성! 3/6이야').isVisible().catch(() => false));
  ok('V8-8b 첫 보드 CTA 노출', await page.getByText('🎉 첫 보드가 열렸어 — 미래의 하루 들으러 가기 →').isVisible().catch(() => false));
  ok('V8-8c 다음 이어가기 병행 유지', await page.getByText('이어가기 →').isVisible().catch(() => false));
  await ctx.close();
}
{
  // 2번째 완성 — 완료 시트에 첫 보드 CTA 부재 (경계 가드)
  const { ctx, page } = await newPage(doneBoard({
    ...completedN(1),
    2: textComplete({ sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, null, null, null, null] }),
  }));
  await page.goto(`${BASE}/scenes/2`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V8-8d 완료 시트(완성! 2/6)', await page.getByText('완성! 2/6이야').isVisible().catch(() => false));
  ok('V8-8e 첫 보드 CTA 부재(2/6)', (await page.getByText('첫 보드가 열렸어').count()) === 0);
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.8-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
