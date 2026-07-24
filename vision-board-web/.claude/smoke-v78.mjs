// v7.8 프로덕션 스모크 — 주요 경로 200 + 첫 보드 조기 개방 CTA·재작성 넛지 실렌더
import { chromium } from 'playwright';

const BASE = 'https://vision-board-web.vercel.app';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

// 1) 주요 경로 200
const routes = ['/', '/dashboard', '/collage', '/finish', '/review', '/onboarding', '/section/1', '/scene/1', '/scenes/1'];
for (const r of routes) {
  const res = await fetch(`${BASE}${r}`);
  ok(`GET ${r}`, res.status === 200, `status=${res.status}`);
}

// 2) 실렌더 — 3섹션 완성 시드
function seed() {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (let id = 1; id <= 3; id++) {
    Object.assign(sections[id], {
      status: 'completed', sceneText: '하루', miniStory: '스토리.',
      extractedSlots: { current: '바쁘게', keyword: '여유로운', want: '여행', feeling: '충만한' },
      uploadedImages: [PIXEL, null, null, null, null],
    });
  }
  return { sections, onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4 };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript((data) => {
  localStorage.setItem('vision-board-data', JSON.stringify(data));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, seed());
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(2000);
ok('대시보드 첫 보드 CTA 실렌더', await page.getByText('첫 보드가 열렸어').isVisible().catch(() => false));
await page.goto(`${BASE}/collage`);
await page.waitForTimeout(1800);
ok('콜라주 첫 보드 완성 CTA 실렌더', await page.getByText('첫 보드 완성하기 🐿️').isVisible().catch(() => false));
await page.goto(`${BASE}/finish`);
await page.waitForTimeout(1500);
ok('/finish 부분 카피 실렌더', await page.getByText('먼저 자란 3가지 영역').isVisible().catch(() => false));
await ctx.close();

// 3) 재작성 넛지 실렌더 — 스탬프 3, 완료 4
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page2 = await ctx2.newPage();
const s2 = seed();
Object.assign(s2.sections[4], s2.sections[1], { id: 4 });
s2.futureDayStory = '미래의 어느 하루.';
s2.storyWrittenAtCount = 3;
await page2.addInitScript((data) => {
  localStorage.setItem('vision-board-data', JSON.stringify(data));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, s2);
await page2.goto(`${BASE}/dashboard`);
await page2.waitForTimeout(2000);
ok('재작성 넛지 실렌더', await page2.getByText('이야기 다시 써줄까?').isVisible().catch(() => false));
await ctx2.close();
await browser.close();

console.log('\n===== v7.8 프로덕션 스모크 =====');
for (const r of results) console.log(r);
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
