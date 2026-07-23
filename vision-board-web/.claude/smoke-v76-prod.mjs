// v7.6 프로덕션 스모크 — 주요 경로 200 + 신규 카피 실렌더 확인 (배포 검증용 일회성)
import { chromium } from 'playwright';

const BASE = 'https://vision-board-web.vercel.app';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

// 1) 경로 200
for (const path of ['/', '/dashboard', '/collage', '/onboarding/1', '/section/1', '/scene/1', '/scenes/1', '/review', '/finish']) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  ok(`GET ${path}`, res.status === 200 || (res.status >= 300 && res.status < 400), `status=${res.status}`);
}

// 2) 실렌더 — 신규 카피·숲 테마
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const seedSections = (withPhoto1 = false) => {
  const sections = {};
  for (let id = 1; id <= 6; id++) sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  if (withPhoto1) {
    // 콜라주 템플릿 셀렉터는 사진이 있어야 노출 — 섹션 1에 사진 1장 시드
    sections[1] = { ...sections[1], status: 'completed', extractedSlots: { keyword: '여유로운' }, sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, null, null] };
  }
  return sections;
};
const baseSeed = { onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4 };
const seed = { ...baseSeed, sections: seedSections() };
const photoSeed = { ...baseSeed, sections: seedSections(true) };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript((d) => {
  localStorage.setItem('vision-board-data', JSON.stringify(d));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, seed);

await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(2500);
ok('대시보드: 여기서 시작 라벨', await page.getByText('여기서 시작').isVisible().catch(() => false));
const mapBg = await page.locator('div[style*="linear-gradient"]').first().evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');
ok('대시보드: 숲 그라디언트', mapBg.includes('rgb(31, 46, 34)'), mapBg.slice(0, 60));

await page.goto(`${BASE}/section/1`);
await page.waitForTimeout(2500);
ok('섹션1: 세트 예시 노출', await page.getByText('회사 다니면서 퇴근 후엔').isVisible().catch(() => false));
ok('섹션1: 다른 예시 보기', await page.getByText('다른 예시 보기').isVisible().catch(() => false));

const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page2 = await ctx2.newPage();
await page2.addInitScript((d) => {
  localStorage.setItem('vision-board-data', JSON.stringify(d));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, photoSeed);
await page2.goto(`${BASE}/collage`);
await page2.waitForTimeout(2500);
ok('콜라주: 숲 템플릿 라벨', await page2.getByText('숲', { exact: true }).first().isVisible().catch(() => false));
const body = await page2.locator('body').innerText();
ok('콜라주: 구 라벨(폴라로이드) 부재', !body.includes('폴라로이드'));

await browser.close();

console.log('\n===== v7.6 프로덕션 스모크 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
process.exit(failCount ? 1 : 0);
