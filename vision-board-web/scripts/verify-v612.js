// v6.12 검증 — 온보딩 Act별 페이지 스크롤바 없음 + CTA 가시성 + 배경화면 시트
// node scripts/verify-v612.js (dev/start 서버가 localhost:3000에 떠 있어야 함)
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = '.screenshots';

async function checkNoPageScroll(page, label, results) {
  const r = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }));
  const ok = r.sh <= r.ch + 1;
  results.push(`${label}: scrollH=${r.sh} clientH=${r.ch} → ${ok ? 'OK' : 'FAIL(page scrolls)'}`);
  return ok;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const browser = await chromium.launch();
  const results = [];

  for (const vp of [{ w: 375, h: 667 }, { w: 375, h: 812 }, { w: 768, h: 1024 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const tag = `${vp.w}x${vp.h}`;

    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('vision-board-data'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Act 0
    await checkNoPageScroll(page, `act0 ${tag}`, results);
    await page.screenshot({ path: `${OUT}/v612-act0-${tag}.png` });
    await page.getByText('내 이야기 들려줄게').click();
    await page.waitForTimeout(400);

    // Act 1
    await checkNoPageScroll(page, `act1 ${tag}`, results);
    await page.fill('input[placeholder="이름 또는 닉네임"]', '헬렌');
    await page.getByText('저장', { exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByText('그래 좋아 !').click();
    await page.waitForTimeout(500);

    // Act 2 — 끝까지 탭
    for (let i = 0; i < 7; i++) {
      await page.mouse.click(vp.w / 2, Math.round(vp.h * 0.4));
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(700);
    await checkNoPageScroll(page, `act2-full ${tag}`, results);
    results.push(`act2 CTA visible ${tag}: ${await page.getByText('그 가능성, 꺼내볼게').isVisible()}`);
    const inner = await page.evaluate(() => {
      const el = document.querySelector('.scroll-soft');
      return el ? { sh: el.scrollHeight, ch: el.clientHeight, top: Math.round(el.scrollTop) } : null;
    });
    results.push(`act2 inner scroll ${tag}: ${JSON.stringify(inner)}`);
    await page.screenshot({ path: `${OUT}/v612-act2-${tag}.png` });
    await page.getByText('그 가능성, 꺼내볼게').click();
    await page.waitForTimeout(700);

    // Act 3
    await checkNoPageScroll(page, `act3 ${tag}`, results);
    results.push(`act3 CTA visible ${tag}: ${await page.getByText('와, 기대되는데?').isVisible()}`);
    await page.screenshot({ path: `${OUT}/v612-act3-${tag}.png` });
    await page.getByText('와, 기대되는데?').click();
    await page.waitForTimeout(700);

    // Act 4
    await checkNoPageScroll(page, `act4 ${tag}`, results);
    results.push(`act4 CTA visible ${tag}: ${await page.getByText('오, 그렇구나').isVisible()}`);
    await page.screenshot({ path: `${OUT}/v612-act4-${tag}.png` });
    await page.getByText('오, 그렇구나').click();
    await page.waitForTimeout(400);

    // Act 5
    await checkNoPageScroll(page, `act5 ${tag}`, results);
    results.push(`act5 CTA visible ${tag}: ${await page.getByText('비전보드 시작하기').isVisible()}`);
    await page.screenshot({ path: `${OUT}/v612-act5-${tag}.png` });
    await ctx.close();
  }

  // 콜라주 + 배경화면 시트
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    function dummy(color, n) {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = color; g.fillRect(0, 0, 320, 320);
      g.fillStyle = '#fff'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center';
      g.fillText(String(n), 160, 175);
      return c.toDataURL('image/jpeg', 0.7);
    }
    const colors = ['#6F56C9', '#27804F', '#A8600D', '#356FBE', '#B54E20', '#187A8C'];
    const sections = {};
    for (let id = 1; id <= 6; id++) {
      sections[id] = {
        id, status: 'completed', currentPhase: 4, currentSlotIndex: 0, slots: {},
        images: [null, null, null],
        uploadedImages: [
          dummy(colors[id - 1], id * 10 + 1),
          dummy(colors[id - 1], id * 10 + 2),
          dummy(colors[id - 1], id * 10 + 3),
          null, null,
        ],
      };
    }
    localStorage.setItem('vision-board-data', JSON.stringify({
      sections, onboardingDone: true, userName: '헬렌', boardYear: '2026', startedAt: Date.now(),
    }));
  });
  await page.goto(BASE + '/collage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/v612-collage-375.png`, fullPage: true });

  await page.getByText('배경화면으로 저장').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/v612-wallpaper-all-375.png` });

  await page.getByText('섹션 묶음').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/v612-wallpaper-pairs-375.png` });

  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.getByText('이미지로 저장').click();
  const download = await dl;
  results.push(`wallpaper download: ${download ? download.suggestedFilename() : 'NO DOWNLOAD EVENT'}`);

  await ctx.close();
  await browser.close();
  console.log(results.join('\n'));
})();
