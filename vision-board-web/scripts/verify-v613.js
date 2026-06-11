// v6.13 검증 — 이름 입력칸 단일 보더, 타입 토큰, Act4 카피·무스크롤, /board 데스크톱 무스크롤, 배경화면 디자인 2종
// node scripts/verify-v613.js (dev/start 서버가 localhost:3000에 떠 있어야 함)
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

function seedBoard(page) {
  return page.evaluate(() => {
    function dummy(color, n) {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = color; g.fillRect(0, 0, 320, 320);
      g.fillStyle = '#fff'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center';
      g.fillText(String(n), 160, 175);
      return c.toDataURL('image/jpeg', 0.7);
    }
    const colors = ['#7868A9', '#4F7A5F', '#996826', '#5273A3', '#B05A36', '#3D7B87'];
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
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const browser = await chromium.launch();
  const results = [];

  // ── 온보딩: 3뷰포트 × Act 0~5 무스크롤 + v6.13 픽스 확인 ──
  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 1280, h: 720 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const tag = `${vp.w}x${vp.h}`;

    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('vision-board-data'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Act 0
    await checkNoPageScroll(page, `act0 ${tag}`, results);
    await page.getByText('내 이야기 들려줄게').click();
    await page.waitForTimeout(400);

    // Act 1 — 이름 입력칸: 포커스 시 outline 없어야 함 (이중선 버그)
    await checkNoPageScroll(page, `act1 ${tag}`, results);
    const inputStyle = await page.evaluate(() => {
      const el = document.querySelector('input[placeholder="이름 또는 닉네임"]');
      if (!el) return null;
      el.focus();
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
    });
    const outlineOk = inputStyle && (inputStyle.outlineStyle === 'none' || inputStyle.outlineWidth === '0px');
    results.push(`act1 input focus outline ${tag}: ${JSON.stringify(inputStyle)} → ${outlineOk ? 'OK(단일 보더)' : 'FAIL(이중선)'}`);
    await page.screenshot({ path: `${OUT}/v613-act1-input-${tag}.png` });
    await page.fill('input[placeholder="이름 또는 닉네임"]', '헬렌');
    await page.getByText('저장', { exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByText('그래 좋아 !').click();
    await page.waitForTimeout(500);

    // Act 2 — 끝까지 탭 + 도토리 말풍선이 Pretendard인지 확인
    for (let i = 0; i < 7; i++) {
      await page.mouse.click(vp.w / 2, Math.round(vp.h * 0.4));
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(700);
    await checkNoPageScroll(page, `act2-full ${tag}`, results);
    const acornFont = await page.evaluate(() => {
      const el = document.querySelector('.scroll-soft p');
      return el ? getComputedStyle(el).fontFamily.slice(0, 40) : null;
    });
    results.push(`act2 acorn bubble font ${tag}: ${acornFont} → ${acornFont && acornFont.includes('Pretendard') ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${OUT}/v613-act2-${tag}.png` });
    await page.getByText('그 가능성, 꺼내볼게').click();
    await page.waitForTimeout(700);

    // Act 3
    await checkNoPageScroll(page, `act3 ${tag}`, results);
    await page.getByText('와, 기대되는데?').click();
    await page.waitForTimeout(700);

    // Act 4 — 카피 확인 + 내부 스크롤 없음
    await checkNoPageScroll(page, `act4 ${tag}`, results);
    results.push(`act4 새 카피 ${tag}: ${await page.getByText('원하는 것이 뚜렷해지는 순간').isVisible()}`);
    results.push(`act4 리드인 제거 ${tag}: ${(await page.getByText('이게 왜 효과 있는지').count()) === 0 ? 'OK' : 'FAIL(남아있음)'}`);
    results.push(`act4 CTA visible ${tag}: ${await page.getByText('오, 그렇구나').isVisible()}`);
    const act4Inner = await page.evaluate(() => {
      const el = document.querySelector('.scroll-soft');
      return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null;
    });
    const act4NoInnerScroll = act4Inner && act4Inner.sh <= act4Inner.ch + 1;
    results.push(`act4 inner scroll ${tag}: ${JSON.stringify(act4Inner)} → ${act4NoInnerScroll ? 'OK' : 'FAIL(내부 스크롤)'}`);
    await page.screenshot({ path: `${OUT}/v613-act4-${tag}.png` });
    await page.getByText('오, 그렇구나').click();
    await page.waitForTimeout(400);

    // Act 5
    await checkNoPageScroll(page, `act5 ${tag}`, results);
    results.push(`act5 CTA visible ${tag}: ${await page.getByText('비전보드 시작하기').isVisible()}`);
    await ctx.close();
  }

  // ── /board 데스크톱 1280×720 — 페이지 무스크롤 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    await page.goto(BASE + '/board', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await checkNoPageScroll(page, 'board 1280x720', results);
    await page.screenshot({ path: `${OUT}/v613-board-1280.png` });
    await ctx.close();
  }

  // ── 배경화면 디자인 2종 — 폴라로이드/미니멀 × 모아담기/섹션묶음 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    await page.goto(BASE + '/collage', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.getByText('배경화면으로 저장').click();
    await page.waitForTimeout(2500);
    results.push(`wallpaper style segment: 폴라로이드=${await page.getByText('폴라로이드').isVisible()} 미니멀=${await page.getByText('미니멀', { exact: true }).isVisible()}`);
    await page.screenshot({ path: `${OUT}/v613-wallpaper-all-polaroid.png` });

    await page.getByText('미니멀', { exact: true }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/v613-wallpaper-all-minimal.png` });

    await page.getByText('섹션 묶음').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/v613-wallpaper-pairs-minimal.png` });

    const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.getByText('이미지로 저장').click();
    const download = await dl;
    results.push(`wallpaper minimal download: ${download ? download.suggestedFilename() : 'NO DOWNLOAD EVENT'}`);
    await ctx.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.includes('FAIL'));
  console.log(fails.length ? `\n❌ ${fails.length} FAIL` : '\n✅ ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
