import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = 'verify-shots';
fs.mkdirSync(OUT, { recursive: true });

// 1px 컬러 PNG dataURL 생성 대신 — canvas로 섹션별 색 사각형 이미지 생성
const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];

const browser = await chromium.launch();

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('saved', name);
}

for (const [label, viewport] of [['mobile', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 800 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();

  // ── 온보딩 Act 0 (영상)
  await page.goto(`${BASE}/onboarding`);
  await page.waitForTimeout(1500);
  await shoot(page, `onboarding-act0-${label}`);

  // ── Act 3 (비전보드란? + 예시 이미지) — localStorage로 점프
  await page.evaluate(() => {
    const raw = localStorage.getItem('vision-board-data');
    const data = raw ? JSON.parse(raw) : {};
    data.userName = '테스터';
    data.onboardingStep = 3;
    localStorage.setItem('vision-board-data', JSON.stringify(data));
  });
  await page.reload();
  await page.waitForTimeout(1200);
  await shoot(page, `onboarding-act3-${label}`);

  // ── Act 4 (막연함vs선명함 + 좋은 이유)
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('vision-board-data'));
    data.onboardingStep = 4;
    localStorage.setItem('vision-board-data', JSON.stringify(data));
  });
  await page.reload();
  await page.waitForTimeout(1200);
  await shoot(page, `onboarding-act4-${label}`);

  // ── /board (콜라주) — 섹션별 더미 이미지 주입
  await page.goto(`${BASE}/board`);
  await page.evaluate((colors) => {
    function colorDataUrl(color) {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const g = c.getContext('2d');
      g.fillStyle = color; g.fillRect(0, 0, 200, 200);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = 'bold 28px sans-serif';
      g.fillText('photo', 60, 108);
      return c.toDataURL('image/jpeg', 0.7);
    }
    const raw = localStorage.getItem('vision-board-data');
    const data = raw ? JSON.parse(raw) : { sections: {} };
    if (!data.sections) data.sections = {};
    for (let id = 1; id <= 6; id++) {
      const sec = data.sections[id] ?? { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, slots: {}, images: [null, null, null] };
      sec.uploadedImages = [colorDataUrl(colors[id - 1]), colorDataUrl(colors[(id) % 6]), null, null, null];
      data.sections[id] = sec;
    }
    localStorage.setItem('vision-board-data', JSON.stringify(data));
  }, COLORS);
  await page.reload();
  await page.waitForTimeout(1200);
  await shoot(page, `board-collage-${label}`);

  // 연도 수정 동작 확인 (모바일에서만 1회)
  if (label === 'mobile') {
    const yearBtn = page.getByTitle('연도 수정');
    await yearBtn.scrollIntoViewIfNeeded();
    await yearBtn.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('2029');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await shoot(page, 'board-collage-year-edited');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')).boardYear);
    console.log('boardYear saved as:', saved);
  }

  // ── section 채팅 (아바타 + 입력창)
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await shoot(page, `section-chat-${label}`);

  await ctx.close();
}

await browser.close();
console.log('done');
