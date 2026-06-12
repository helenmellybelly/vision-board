// v6.16 검증 — Act 4 간격 확대 후 3뷰포트 무스크롤 + 초기 팔레트 복원 확인
// node scripts/verify-v616.js (start 서버가 localhost:3000에 떠 있어야 함)
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
  const results = [];
  const browser = await chromium.launch();

  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 1280, h: 720 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const tag = `${vp.w}x${vp.h}`;

    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('vision-board-data'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.getByText('내 이야기 들려줄게').click();
    await page.waitForTimeout(400);
    await page.fill('input[placeholder="이름 또는 닉네임"]', '헬렌');
    await page.getByText('저장', { exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByText('그래 좋아 !').click();
    await page.waitForTimeout(500);
    for (let i = 0; i < 7; i++) {
      await page.mouse.click(vp.w / 2, Math.round(vp.h * 0.4));
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(700);
    await page.getByText('그 가능성, 꺼내볼게').click();
    await page.waitForTimeout(700);
    await page.getByText('와, 기대되는데?').click();
    await page.waitForTimeout(700);

    // Act 4 — 페이지·내부 무스크롤 + 간격 측정
    await checkNoPageScroll(page, `act4 ${tag}`, results);
    const act4Inner = await page.evaluate(() => {
      const el = document.querySelector('.scroll-soft');
      return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null;
    });
    const innerOk = act4Inner && act4Inner.sh <= act4Inner.ch + 1;
    results.push(`act4 inner scroll ${tag}: ${JSON.stringify(act4Inner)} → ${innerOk ? 'OK' : 'FAIL(내부 스크롤)'}`);

    // 간격 실측: 이미지 카드 ↔ 핵심 메시지, 핵심 메시지 ↔ 좋은 이유 블록
    const gaps = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('p')];
      const msg = ps.find((p) => p.textContent.includes('뇌는 그쪽으로 움직이기'));
      const reasons = ps.find((p) => p.textContent.trim() === '비전보드를 하면 좋은 이유');
      const power = ps.find((p) => p.textContent.trim() === '그게 비전보드의 힘이야.');
      const dots = document.querySelector('[aria-hidden="true"]');
      if (!msg || !reasons || !power || !dots) return null;
      return {
        cardToMsg: Math.round(msg.parentElement.getBoundingClientRect().top - dots.getBoundingClientRect().bottom),
        powerToReasons: Math.round(reasons.getBoundingClientRect().top - power.getBoundingClientRect().bottom),
      };
    });
    results.push(`act4 gaps ${tag}: ${JSON.stringify(gaps)} (카드→메시지, 힘→좋은이유)`);
    await page.screenshot({ path: `${OUT}/v616-act4-${tag}.png` });

    // Act 5 — 새 팔레트 그리드 확인 스크린샷
    await page.getByText('오, 그렇구나').click();
    await page.waitForTimeout(400);
    await checkNoPageScroll(page, `act5 ${tag}`, results);
    if (tag === '390x844') await page.screenshot({ path: `${OUT}/v616-act5-${tag}.png` });
    await ctx.close();
  }

  // 팔레트 적용 확인 — Act 5 그리드 첫 영역(나)이 #8B5CF6인지
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT}/v616-landing.png`, fullPage: true });
    await ctx.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.includes('FAIL'));
  console.log(`\n${fails.length === 0 ? '✅ ALL OK' : `❌ ${fails.length} FAIL`}`);
})();
