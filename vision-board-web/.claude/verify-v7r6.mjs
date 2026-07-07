// v7.0-r6 검증 — dead code 정리: slots 레거시 v4 백필, 미사용 API 삭제, review/finish extractedSlots 전환
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

// ── 1) v4 백필: extractedSlots 없이 구 slots만 있는 레거시 → extractedSlots 생성 ──
{
  const { ctx, page } = await newPage({
    sections: seedSections({
      1: {
        status: 'text_complete',
        slots: {
          1: { text: '바쁘게 사는 사람', isDeferred: false },
          2: { text: '여유로운', isDeferred: false },
          3: { text: '혼자 여행', isDeferred: false },
          5: { text: '충만한', isDeferred: false },
        },
        // extractedSlots 없음 = 순수 레거시
      },
    }),
    onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌', startedAt: Date.now(),
    // schemaVersion 없음
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const board = await readBoard(page);
  const ex = board?.sections?.[1]?.extractedSlots;
  ok('R6-1a v4 백필: current', ex?.current === '바쁘게 사는 사람');
  ok('R6-1b v4 백필: keyword', ex?.keyword === '여유로운');
  ok('R6-1c v4 백필: want/feeling', ex?.want === '혼자 여행' && ex?.feeling === '충만한');
  ok('R6-1d schemaVersion 4', board?.schemaVersion === 4, `v=${board?.schemaVersion}`);
  // 백필 결과가 /review에 렌더 (구 slots 직접 읽기 제거 후에도)
  await page.goto(`${BASE}/review`);
  await page.waitForTimeout(1500);
  ok('R6-1e review에 백필 답변 렌더', await page.getByText('바쁘게 사는 사람').isVisible().catch(() => false));
  ok('R6-1f 캐논 라벨(방향 키워드)', (await page.getByText('방향 키워드').count()) > 0);
  // extractedSlots 있는 사용자 대상 무해성 — 재로드
  await page.reload();
  await page.waitForTimeout(1200);
  const board2 = await readBoard(page);
  ok('R6-1g 재로드 무해성', board2?.sections?.[1]?.extractedSlots?.keyword === '여유로운');
  await ctx.close();
}

// ── 2) 삭제된 API 라우트 404 ──
{
  const { ctx, page } = await newPage(null);
  const r1 = await page.goto(`${BASE}/api/image/generate`);
  ok('R6-2a /api/image/generate 404', r1?.status() === 404, `status=${r1?.status()}`);
  const r2 = await page.goto(`${BASE}/api/image/describe-one`);
  ok('R6-2b /api/image/describe-one 404', r2?.status() === 404, `status=${r2?.status()}`);
  await ctx.close();
}

// ── 3) finish 키워드 칩 — extractedSlots 기반 렌더 회귀 ──
{
  const sections = seedSections();
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      ...sections[id],
      status: 'completed',
      extractedSlots: { current: '지금', keyword: `키워드${id}`, want: '원해', feeling: '기분' },
      sceneText: '하루', miniStory: '스토리.',
      uploadedImages: [null, null, null, null, null],
    };
  }
  const { ctx, page } = await newPage({
    sections, onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌',
    startedAt: Date.now(), schemaVersion: 4,
  });
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1500);
  ok('R6-3 finish 키워드 칩(extractedSlots)', await page.getByText('키워드1').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r6 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
