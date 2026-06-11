// v6.14 검증 — 팔레트 대비, font-display 페어링, 온보딩 카피·무스크롤, /board 2열×3행 무스크롤,
// 콜라주 템플릿 4종 + 커스텀 드래그 편집, 배경화면 모바일/PC
// node scripts/verify-v614.js (start 서버가 localhost:3000에 떠 있어야 함)
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT = '.screenshots';

// ── 0. 정적 검증 (서버 불필요) ──

// 팔레트 대비 — lib/colors.ts 파싱 후 크림·흰색 4.5:1, 틴트 위 메인 4.1:1
function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function checkPalette(results) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'colors.ts'), 'utf8');
  const [mainBlock, tintBlock] = src.split('SECTION_LIGHT_COLORS');
  const mains = [...mainBlock.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
  const tints = [...tintBlock.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
  if (mains.length !== 6 || tints.length !== 6) {
    results.push(`palette parse: mains=${mains.length} tints=${tints.length} → FAIL`);
    return;
  }
  mains.forEach((hex, i) => {
    const cream = contrast(hex, '#FAF9F7');
    const white = contrast(hex, '#FFFFFF');
    const onTint = contrast(hex, tints[i]);
    const ok = cream >= 4.5 && white >= 4.5 && onTint >= 4.1;
    results.push(
      `palette[${i}] ${hex}: cream=${cream.toFixed(2)} white=${white.toFixed(2)} onTint=${onTint.toFixed(2)} → ${ok ? 'OK' : 'FAIL'}`
    );
  });
}

// 타이포그래피 가드 — text-display는 반드시 font-display와 페어링
function checkTypographyGuard(results) {
  try {
    execSync(`node "${path.join(__dirname, 'check-typography.js')}"`, { stdio: 'pipe' });
    results.push('typography guard: OK');
  } catch (e) {
    results.push(`typography guard: FAIL\n${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`);
  }
}

// ── 브라우저 헬퍼 ──

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
    const colors = ['#7757D9', '#15814E', '#A86208', '#2B71C9', '#C24A1F', '#0A7C8B'];
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
  const results = [];

  checkPalette(results);
  checkTypographyGuard(results);

  const browser = await chromium.launch();

  // ── 폰트: 주요 페이지 h1이 Gowun Batang인지 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    for (const route of ['/welcome', '/dashboard']) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const font = await page.evaluate(() => {
        const el = document.querySelector('h1');
        return el ? getComputedStyle(el).fontFamily.slice(0, 50) : null;
      });
      const ok = font && font.includes('Gowun Batang');
      results.push(`h1 font ${route}: ${font} → ${ok ? 'OK' : 'FAIL'}`);
    }
    await ctx.close();
  }

  // ── 온보딩: 3뷰포트 × Act 0~5 무스크롤 + v6.14 카피 ──
  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 1280, h: 720 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const tag = `${vp.w}x${vp.h}`;

    await page.goto(BASE + '/onboarding', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('vision-board-data'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await checkNoPageScroll(page, `act0 ${tag}`, results);
    await page.getByText('내 이야기 들려줄게').click();
    await page.waitForTimeout(400);

    await checkNoPageScroll(page, `act1 ${tag}`, results);
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
    await checkNoPageScroll(page, `act2-full ${tag}`, results);
    await page.getByText('그 가능성, 꺼내볼게').click();
    await page.waitForTimeout(700);

    await checkNoPageScroll(page, `act3 ${tag}`, results);
    await page.getByText('와, 기대되는데?').click();
    await page.waitForTimeout(700);

    // Act 4 — 결구 격상(명조체) + 서브텍스트 ≤2줄 + 무스크롤
    await checkNoPageScroll(page, `act4 ${tag}`, results);
    const closer = await page.evaluate(() => {
      const els = [...document.querySelectorAll('p')];
      const el = els.find((p) => p.textContent.trim() === '그게 비전보드의 힘이야.');
      if (!el) return null;
      return getComputedStyle(el).fontFamily.slice(0, 50);
    });
    results.push(`act4 결구 격상 ${tag}: ${closer} → ${closer && closer.includes('Gowun Batang') ? 'OK' : 'FAIL'}`);
    const descLines = await page.evaluate(() => {
      const els = [...document.querySelectorAll('p')];
      const el = els.find((p) => p.textContent.includes('흔들려도 원하는 방향으로'));
      if (!el) return null;
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return { sh: el.scrollHeight, lh, lines: el.scrollHeight / lh };
    });
    const descOk = descLines && descLines.lines <= 2.2;
    results.push(`act4 서브텍스트 ≤2줄 ${tag}: ${JSON.stringify(descLines)} → ${descOk ? 'OK' : 'FAIL'}`);
    const act4Inner = await page.evaluate(() => {
      const el = document.querySelector('.scroll-soft');
      return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null;
    });
    const act4NoInnerScroll = act4Inner && act4Inner.sh <= act4Inner.ch + 1;
    results.push(`act4 inner scroll ${tag}: ${JSON.stringify(act4Inner)} → ${act4NoInnerScroll ? 'OK' : 'FAIL(내부 스크롤)'}`);
    await page.screenshot({ path: `${OUT}/v614-act4-${tag}.png` });
    await page.getByText('오, 그렇구나').click();
    await page.waitForTimeout(400);

    await checkNoPageScroll(page, `act5 ${tag}`, results);
    await ctx.close();
  }

  // ── /board: 3뷰포트 무스크롤 + 2열 확인 ──
  for (const vp of [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 1280, h: 720 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const tag = `${vp.w}x${vp.h}`;
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    await page.goto(BASE + '/board', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await checkNoPageScroll(page, `board ${tag}`, results);
    // 2열 단언 — 첫 두 섹션 셀의 y가 같고 x가 다르면 한 줄에 2개
    const grid = await page.evaluate(() => {
      const cells = document.querySelectorAll('main > div.grid > div');
      if (cells.length < 2) return null;
      const a = cells[0].getBoundingClientRect();
      const b = cells[1].getBoundingClientRect();
      return { count: cells.length, sameRow: Math.abs(a.top - b.top) < 2, diffCol: a.left !== b.left };
    });
    const gridOk = grid && grid.count === 6 && grid.sameRow && grid.diffCol;
    results.push(`board 2열 ${tag}: ${JSON.stringify(grid)} → ${gridOk ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${OUT}/v614-board-${tag}.png` });
    await ctx.close();
  }

  // ── /collage: 템플릿 4종 + 커스텀 드래그 편집 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    await page.goto(BASE + '/collage', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const templateGroup = page.getByRole('radiogroup', { name: '콜라주 템플릿' });
    for (const t of ['폴라로이드', '모자이크', '미니멀']) {
      await templateGroup.getByRole('radio', { name: t }).click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/v614-collage-${t}.png` });
      results.push(`collage template ${t}: rendered`);
    }

    // 커스텀 — 배치 편집 → 드래그 → localStorage 반영
    await templateGroup.getByRole('radio', { name: '내 배치' }).click();
    await page.waitForTimeout(600);
    await page.getByText('배치 편집').click();
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('vision-board-data'));
      return d.collageLayout ? JSON.stringify(d.collageLayout.items['1-0']) : null;
    });
    const photo = page.locator('div[style*="z-index"]').first();
    const box = await photo.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('vision-board-data'));
      return d.collageLayout ? JSON.stringify(d.collageLayout.items['1-0']) : null;
    });
    const dragOk = after && before !== after;
    results.push(`collage custom drag: before=${before} after=${after} → ${dragOk ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${OUT}/v614-collage-custom.png` });
    await ctx.close();
  }

  // ── 배경화면: 모바일/PC 세그먼트 + 미리보기 비율 + 파일명 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await seedBoard(page);
    await page.goto(BASE + '/collage', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.getByText('배경화면으로 저장').click();
    await page.waitForTimeout(2500);

    // 모바일 미리보기 — 세로 비율
    const mobilePreview = await page.evaluate(() => {
      const img = document.querySelector('img[alt="배경화면 미리보기"]');
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    const mobileOk = mobilePreview && mobilePreview.w === 1170 && mobilePreview.h === 2532;
    results.push(`wallpaper mobile preview: ${JSON.stringify(mobilePreview)} → ${mobileOk ? 'OK' : 'FAIL'}`);

    // PC 전환 — 16:9
    await page.getByRole('radiogroup', { name: '배경화면 기기' }).getByRole('radio', { name: /PC 배경화면/ }).click();
    await page.waitForTimeout(2500);
    const pcPreview = await page.evaluate(() => {
      const img = document.querySelector('img[alt="배경화면 미리보기"]');
      return img ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    });
    const pcOk = pcPreview && pcPreview.w === 1920 && pcPreview.h === 1080;
    results.push(`wallpaper PC preview: ${JSON.stringify(pcPreview)} → ${pcOk ? 'OK' : 'FAIL'}`);
    await page.screenshot({ path: `${OUT}/v614-wallpaper-pc-polaroid.png` });

    await page.getByRole('radiogroup', { name: '배경화면 스타일' }).getByRole('radio', { name: '미니멀' }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/v614-wallpaper-pc-minimal.png` });

    await page.getByText('섹션 묶음').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/v614-wallpaper-pc-pairs.png` });

    const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.getByText('이미지로 저장').click();
    const download = await dl;
    const name = download ? download.suggestedFilename() : null;
    results.push(`wallpaper PC download: ${name} → ${name && name.includes('-pc') ? 'OK' : 'FAIL'}`);
    await ctx.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.includes('FAIL'));
  console.log(fails.length ? `\n❌ ${fails.length} FAIL` : '\n✅ ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
