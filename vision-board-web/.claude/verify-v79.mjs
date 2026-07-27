// v7.9 검증 — 로그아웃 이동·계정 버튼 가시성·대시보드 다크 CTA 상호배타·/admin 가드
// 계약: 대시보드의 다크 풀폭 CTA(마일스톤 묶음)는 어떤 상태에서도 동시에 1개만 렌더된다.
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
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
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
      localStorage.setItem('vb-collage-coach-v1', '1');
    }, seed);
  }
  return { ctx, page };
}

// ── 1) allTextDone + stale: 재작성 넛지 억제, '다 됐다' CTA만 (v7.9 중복 수정 핵심) ──
{
  const overrides = {};
  for (let id = 1; id <= 4; id++) overrides[id] = withPhoto();
  for (let id = 5; id <= 6; id++) overrides[id] = textComplete();
  const { ctx, page } = await newPage(
    board(overrides, { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 3, oneSentence: '여유로운 사람.' })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V9-1a 재작성 넛지 부재(allTextDone)', (await page.getByText('이야기 다시 써줄까?').count()) === 0);
  ok('V9-1b /review CTA 단독 노출', await page.getByText('다 됐다, 이제 미래의 하루를 그리러 가자').isVisible().catch(() => false));
  ok('V9-1c 첫 보드 CTA 부재(스토리 있음)', (await page.getByText('첫 보드가 열렸어').count()) === 0);
  await ctx.close();
}

// ── 2) 회귀 가드: 4/6 완료(5·6 미시작) + stale → 재작성 넛지는 계속 노출 ──
{
  const overrides = {};
  for (let id = 1; id <= 4; id++) overrides[id] = withPhoto();
  const { ctx, page } = await newPage(
    board(overrides, { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 3, oneSentence: '여유로운 사람.' })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V9-2a 재작성 넛지 유지(부분 보드)', await page.getByText('이야기 다시 써줄까?').isVisible().catch(() => false));
  ok('V9-2b /review CTA 부재(allTextDone 아님)', (await page.getByText('다 됐다, 이제').count()) === 0);
  await ctx.close();
}

// ── 3) 게스트 계정 버튼: aria-label '계정' 유지 + 시트 로그인 유도 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1200);
  const trigger = page.getByRole('button', { name: '계정', exact: true });
  ok('V9-3a 게스트 계정 버튼 렌더', await trigger.isVisible().catch(() => false));
  await trigger.click();
  ok('V9-3b 시트: Google 로그인 버튼', await page.getByRole('button', { name: 'Google로 로그인', exact: true }).isVisible().catch(() => false));
  ok('V9-3c 시트: 로그아웃 부재(게스트)', (await page.getByText('로그아웃').count()) === 0);
  await ctx.close();
}

// ── 4) /admin: 비로그인 404 (존재 은닉) ──
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(`${BASE}/admin`);
  ok('V9-4 /admin 비로그인 404', res?.status() === 404, `status=${res?.status()}`);
  await ctx.close();
}

await browser.close();
console.log('\n===== v7.9 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
