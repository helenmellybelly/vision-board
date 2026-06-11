// UI 검증용 스크린샷 — node scripts/screenshot-review.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const OUT = '.screenshots';
const widths = [375, 768];

const pages = [
  { name: 'landing', path: '/', full: true },
  { name: 'onboarding', path: '/onboarding', full: false },
  { name: 'dashboard', path: '/dashboard', full: true, seed: true },
];

(async () => {
  const fs = require('fs');
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const browser = await chromium.launch();
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 812 } });
    const page = await ctx.newPage();
    for (const p of pages) {
      if (p.seed) {
        // 온보딩 완료 상태로 만들어 대시보드 리다이렉트 방지
        await page.goto(BASE);
        await page.evaluate(() => {
          const raw = localStorage.getItem('visionBoard');
          const board = raw ? JSON.parse(raw) : {};
          board.onboardingDone = true;
          board.userName = '헬렌';
          localStorage.setItem('visionBoard', JSON.stringify(board));
        });
      }
      await page.goto(BASE + p.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${p.name}-${w}.png`, fullPage: p.full });
      console.log(`saved ${p.name}-${w}.png`);
    }
    await ctx.close();
  }
  await browser.close();
})();
