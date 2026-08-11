// 캔버스 산출 확인 (v9.0 재작성) — WallpaperSheet 프리뷰(canvas.toDataURL)를 픽셀 샘플링해
// DOM과 canvas의 락스텝을 확인한다.
//
// 구 버전은 숲(polaroid) 그라디언트·중앙 연도 카드를 검증했지만 v9.0에서 둘 다 삭제됐다.
// 이제 검증할 것은 (1) 사용자가 고른 배경색이 내보내기에 그대로 반영되는가,
// (2) 어두운 배경에서 타이틀 글자색이 자동 반전되는가, (3) 매트 갤러리의 흰 매트 카드가 그려지는가.
// 이 셋이 어긋나면 "화면과 저장 이미지가 다르다"가 된다.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
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
    1: { status: 'completed', extractedSlots: { keyword: '여유로운' }, sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, PIXEL, PIXEL] },
  }),
  onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌',
  startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(),
  // 기본값이 아닌 템플릿 + 다크 배경 — 두 축이 모두 캔버스에 도달하는지 본다
  collageTemplate: 'matte',
  collageBgColor: '#1C1B19',
};

const results = [];
const ok = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript((data) => {
  localStorage.setItem('vision-board-data', JSON.stringify(data));
  localStorage.setItem('vb-collage-coach-v1', '1');
}, seed);
await page.goto(`${BASE}/collage?view=phone`);
await page.waitForTimeout(1800);

// DOM 배경색 — canvas와 대조할 기준
const domBg = await page
  .locator('[data-testid="collage-board"][data-view="phone"]')
  .evaluate((el) => getComputedStyle(el).backgroundColor)
  .catch(() => '');
ok('DOM 보드 배경 = 잉크', domBg === 'rgb(28, 27, 25)', domBg);

await page.getByText('폰 배경화면 저장').click();
await page.waitForTimeout(4500);

const src = await page.locator('img[src^="data:image/jpeg"]').first().getAttribute('src').catch(() => null);
if (!src) {
  console.log('FAIL 프리뷰 이미지 없음 (저장 시트가 안 열렸거나 렌더 실패)');
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
  // 타이틀 밴드 스캔 — 다크 배경이면 글자가 밝게 떠야 한다.
  // ⚠️ 밴드 y는 minDim 비례(padTop 0.32×짧은변)라 세로로 긴 화면에선 높이 대비 ~15~19%다.
  // 한 줄만 찍으면 글자 사이를 지나칠 수 있어 범위를 훑는다
  let brightest = 0;
  for (let y = Math.round(im.height * 0.13); y < im.height * 0.21; y += 2) {
    for (let x = 0; x < im.width; x += 3) {
      const [r, gg, b] = px(x, y);
      brightest = Math.max(brightest, (r + gg + b) / 3);
    }
  }
  // 흰 매트 카드 존재 — 전체를 성기게 훑어 near-white 픽셀 비율
  let white = 0;
  let total = 0;
  for (let y = Math.round(im.height * 0.25); y < im.height * 0.95; y += 7) {
    for (let x = 0; x < im.width; x += 7) {
      const [r, gg, b] = px(x, y);
      total++;
      if (r > 235 && gg > 235 && b > 235) white++;
    }
  }
  return { w: im.width, h: im.height, corner: px(2, 2), brightest, whiteRatio: white / Math.max(1, total) };
}, src);

const near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
ok('캔버스 배경 = DOM 배경(잉크 #1C1B19)', near(sample.corner, [28, 27, 25]), `rgb(${sample.corner.join(',')})`);
ok('다크 배경 → 타이틀 자동 반전(밝은 글자)', sample.brightest > 180, `최대 밝기 ${Math.round(sample.brightest)}`);
ok('매트 카드(흰색) 렌더', sample.whiteRatio > 0.02, `흰 픽셀 ${(sample.whiteRatio * 100).toFixed(1)}%`);
ok('해상도 = 선택 프리셋(1170×2532)', sample.w === 1170 && sample.h === 2532, `${sample.w}×${sample.h}`);

await browser.close();
for (const r of results) console.log(r);
const fail = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - fail.length} PASS / ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
