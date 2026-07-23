// v7.6 일회성 캔버스 산출 확인 — WallpaperSheet 프리뷰(canvas.toDataURL)를 픽셀 샘플링해
// 숲 그라디언트(상단 짙은 초록)와 연도 카드 컬러가 실제 내보내기 경로에 반영됐는지 본다.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}
const seed = {
  sections: seedSections({
    1: { status: 'completed', extractedSlots: { keyword: '여유로운' }, sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, null, null] },
  }),
  onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌',
  startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript((data) => {
  localStorage.setItem('vision-board-data', JSON.stringify(data));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, seed);
await page.goto(`${BASE}/collage?view=phone`);
await page.waitForTimeout(1500);
await page.getByText('폰 배경화면 저장').click();
await page.waitForTimeout(4000);

const img = page.locator('img[src^="data:image/jpeg"]').first();
const src = await img.getAttribute('src').catch(() => null);
if (!src) {
  console.log('FAIL 프리뷰 이미지 없음');
  await browser.close();
  process.exit(1);
}
const sample = await page.evaluate(async (dataUrl) => {
  const im = new Image();
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = dataUrl; });
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  const px = (x, y) => [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)];
  return {
    w: im.width, h: im.height,
    top: px(im.width / 2, 2),            // 상단 — deep #1F2E22 근처
    bottom: px(im.width / 2, im.height - 3), // 하단 — light #2A3D2E 근처
    center: px(im.width / 2, im.height / 2), // 중앙 — 연도 카드 #33473A
  };
}, src);

const near = (a, b, tol = 14) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const greenish = (rgb) => rgb[1] > rgb[0] && rgb[1] > rgb[2]; // G 우세 = 초록 계열
console.log(JSON.stringify(sample));
console.log(`${near(sample.top, [31, 46, 34]) ? 'PASS' : 'FAIL'} 상단 딥 포레스트(#1F2E22 근사)`);
console.log(`${near(sample.bottom, [42, 61, 46]) ? 'PASS' : 'FAIL'} 하단 라이트 포레스트(#2A3D2E 근사)`);
console.log(`${near(sample.center, [51, 71, 58]) ? 'PASS' : 'FAIL'} 중앙 연도 카드(#33473A 근사)`);
console.log(`${greenish(sample.top) && greenish(sample.bottom) ? 'PASS' : 'FAIL'} 전반 초록 계열`);
await browser.close();
