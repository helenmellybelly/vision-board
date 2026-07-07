// v6.18 2차 검증 — 템플릿별 폰/PC 시드 + 온보딩 Act4 카드 컬러
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5CYII='.replace('5CYII=', '5ErkJggg==');

function seedBoard() {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [], uploadedImages: [PNG, PNG, PNG],
    };
  }
  return {
    sections, onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
    boardYear: '2026', collageTemplate: 'polaroid',
  };
}

const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.addInitScript((data) => {
  if (!localStorage.getItem('vision-board-data')) {
    localStorage.setItem('vision-board-data', JSON.stringify(data));
  }
  localStorage.setItem('vb-collage-coach-v1', '1');
}, seedBoard());

await page.goto(`${BASE}/collage`);
await page.waitForTimeout(600);

for (const tpl of ['폴라로이드', '모자이크', '미니멀']) {
  await page.getByRole('radio', { name: tpl }).click();
  await page.waitForTimeout(400);
  for (const tab of ['폰 배경', 'PC 배경']) {
    await page.getByRole('radio', { name: tab }).click();
    await page.waitForTimeout(500);
    const slug = `${tpl === '폴라로이드' ? 'pol' : tpl === '모자이크' ? 'mos' : 'min'}-${tab === '폰 배경' ? 'phone' : 'pc'}`;
    await page.screenshot({ path: `${OUT}/seed-${slug}.png` });
  }
  await page.getByRole('radio', { name: '보드', exact: true }).click();
  await page.waitForTimeout(300);
}

// ── 온보딩 Act 4 — onboardingStep 저장값으로 바로 복원 ──
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
await p2.addInitScript(() => {
  localStorage.setItem(
    'vision-board-data',
    JSON.stringify({
      sections: {}, onboardingDone: false, userName: '헬렌',
      startedAt: Date.now(), onboardingStep: 4,
    })
  );
});
await p2.goto(`${BASE}/onboarding`);
await p2.waitForTimeout(1500);
const found = await p2
  .getByText('삶의 방향을 잡아줘')
  .isVisible()
  .catch(() => false);
if (found) {
  const card = await p2.evaluate(() => {
    const titles = ['원하는 삶을 현실로 믿게 해줘', '삶의 방향을 잡아줘', '되고 싶은 나를 그려줘'];
    return titles.map((t) => {
      const el = [...document.querySelectorAll('p')].find((p) => p.textContent === t);
      if (!el) return null;
      const cardDiv = el.closest('div.rounded-xl') ?? el.parentElement.parentElement;
      const emoji = cardDiv.querySelector('span')?.textContent ?? '';
      return {
        title: getComputedStyle(el).color,
        bg: getComputedStyle(cardDiv).backgroundColor,
        emoji,
      };
    });
  });
  const exp = [
    { title: 'rgb(143, 92, 246)', bg: 'rgb(242, 237, 247)', emoji: '🧠' },
    { title: 'rgb(16, 198, 193)', bg: 'rgb(233, 244, 239)', emoji: '🎯' },
    { title: 'rgb(245, 158, 11)', bg: 'rgb(249, 242, 231)', emoji: '🌱' },
  ];
  card.forEach((c, i) => {
    if (!c) return ok(`onboarding card ${i + 1}`, false, 'not found');
    ok(
      `onboarding card ${i + 1} color/emoji`,
      c.title === exp[i].title && c.bg === exp[i].bg && c.emoji === exp[i].emoji,
      JSON.stringify(c)
    );
  });
  await p2.screenshot({ path: `${OUT}/onboarding-act4.png` });
} else {
  ok('onboarding Act4 reached', false, 'could not reach cards');
  await p2.screenshot({ path: `${OUT}/onboarding-stuck.png` });
}

await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
