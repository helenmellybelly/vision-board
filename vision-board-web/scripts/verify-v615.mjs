// v6.15 시각 검증 — 온보딩 Act4 간격 / 보드 정사각 슬롯 / 리뷰 버튼 분기 / 콜라주 편집·스티커·배경화면
// 실행: node scripts/verify-v615.mjs (사전에 npx next start -p 3456)
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3456';
const OUT = 'verify-shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x720', width: 1280, height: 720 },
];

// 색 사각형 data URL — 업로드 사진 대용
function makeSeedScript() {
  return `(() => {
    const sq = (c) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 80;
      const x = cv.getContext('2d');
      x.fillStyle = c; x.fillRect(0, 0, 80, 80);
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(8, 8, 30, 30);
      return cv.toDataURL('image/png');
    };
    const imgs = ['#7868A9','#4F7A5F','#996826','#5273A3','#B05A36','#3D7B87'].map(sq);
    const sec = (id, extra) => Object.assign({
      id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [null,null,null], uploadedImages: [null,null,null,null,null],
    }, extra);
    const board = {
      sections: {
        1: sec(1, { status: 'text_complete',
          slots: { 1:{text:'지금의 나는 바쁘다',isDeferred:false}, 2:{text:'여유',isDeferred:false}, 3:{text:'아침 러닝',isDeferred:false}, 5:{text:'개운함',isDeferred:false} },
          sceneText: '새벽 6시, 한강을 달린다.', miniStory: '아침을 여는 사람',
          uploadedImages: [imgs[0], imgs[1], imgs[2], null, null] }),
        2: sec(2, { uploadedImages: [imgs[3], null, null, null, null] }), // 글 없이 사진만 — '작성하기' 검증
        3: sec(3, { uploadedImages: [imgs[4], imgs[5], null, null, null] }),
        4: sec(4, {}), 5: sec(5, {}), 6: sec(6, {}),
      },
      onboardingDone: true, userName: '테스트', startedAt: Date.now(),
      onboardingStep: 4, boardYear: '2026',
      collageTemplate: 'custom', // v6.14 잔재 — 마이그레이션 검증
      collageLayout: { items: { '1-0': { x: 0.1, y: 0.1, w: 0.3, z: 1 } } },
    };
    localStorage.setItem('vision-board-data', JSON.stringify(board));
  })()`;
}

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/reset').catch(() => {});
  await page.goto(BASE + '/welcome');
  await page.evaluate(makeSeedScript());

  // 1) 온보딩 Act 4
  await page.goto(BASE + '/onboarding');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/onboarding-act4-${vp.name}.png` });
  const obScroll = await page.evaluate(() => {
    const el = document.querySelector('.overflow-y-auto');
    return el ? el.scrollHeight - el.clientHeight : 0;
  });
  results.push(`[${vp.name}] onboarding act4 inner-scroll overflow: ${obScroll}px`);

  // 2) 보드
  await page.goto(BASE + '/board');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/board-${vp.name}.png` });
  const slotRatio = await page.evaluate(() => {
    const el = document.querySelector('.aspect-square');
    if (!el) return 'no slot';
    const r = el.getBoundingClientRect();
    return (r.width / r.height).toFixed(2);
  });
  results.push(`[${vp.name}] board slot w/h ratio: ${slotRatio} (1.00 = 정사각)`);

  // 3) 리뷰 — 버튼 분기
  await page.goto(BASE + '/review');
  await page.waitForTimeout(600);
  const editBtns = await page.getByText('수정하러 가기 →').count();
  const writeBtns = await page.getByText('작성하기 →').count();
  results.push(`[${vp.name}] review buttons — 수정하러 가기: ${editBtns}, 작성하기: ${writeBtns} (기대: 1, 5)`);
  await page.screenshot({ path: `${OUT}/review-${vp.name}.png`, fullPage: true });

  // 4) 콜라주 — 마이그레이션 + 편집 + 스티커
  await page.goto(BASE + '/collage');
  await page.waitForTimeout(900);
  const migrated = await page.evaluate(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data'));
    return `template=${b.collageTemplate}, legacyLayout=${b.collageLayout ? 'remains!' : 'cleared'}, layouts=${Object.keys(b.collageLayouts || {}).join('/') || 'none'}`;
  });
  results.push(`[${vp.name}] migration: ${migrated}`);
  console.log(`[${vp.name}] migration: ${migrated}`);
  await page.screenshot({ path: `${OUT}/collage-view-${vp.name}.png` });

  // 보드 탭 → 편집 모드 (정중앙은 연도 카드 버튼이라 좌상단 사진 영역을 탭)
  const emptyState = await page.getByText('아직 담긴 사진이 없어').isVisible().catch(() => false);
  console.log(`[${vp.name}] collage empty-state: ${emptyState}`);
  const boardEl = page.getByTestId('collage-board');
  await boardEl.tap({ position: { x: 40, y: 120 } });
  await page.waitForTimeout(400);
  const toolbarVisible = await page.getByText('+ 문구').isVisible().catch(() => false);
  results.push(`[${vp.name}] tap-to-edit toolbar: ${toolbarVisible}`);
  await page.screenshot({ path: `${OUT}/collage-edit-${vp.name}.png` });

  // 스티커 시트
  if (toolbarVisible) {
    await page.getByText('+ 문구').tap();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/collage-sticker-sheet-${vp.name}.png` });
    await page.getByText('될 일은 된다').first().tap();
    await page.getByText('보드에 붙이기').tap();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/collage-sticker-added-${vp.name}.png` });
    await page.getByText('완료').tap();
    await page.waitForTimeout(300);
  }

  // 템플릿 전환 보존 확인 (390만)
  if (vp.name === '390x844') {
    for (const t of ['모자이크', '미니멀']) {
      await page.getByRole('radio', { name: t }).tap();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/collage-${t}-${vp.name}.png` });
    }
    await page.getByRole('radio', { name: '폴라로이드' }).tap();
    await page.waitForTimeout(500);
    const stickerKept = await page.evaluate(() => {
      const b = JSON.parse(localStorage.getItem('vision-board-data'));
      const st = b.collageLayouts?.polaroid?.stickers || {};
      return Object.values(st).map((s) => s.text).join(', ');
    });
    results.push(`[${vp.name}] polaroid stickers after switch: ${stickerKept}`);
  }

  // 5) 배경화면 — 폰/PC 미리보기
  await page.getByText('폰 배경화면 저장').tap();
  await page.waitForSelector('img[alt="배경화면 미리보기"]', { timeout: 15000 }).catch(() => results.push(`[${vp.name}] WALLPAPER MOBILE PREVIEW TIMEOUT`));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wallpaper-mobile-${vp.name}.png` });
  await page.getByText('닫기').tap();
  await page.getByText('PC 배경화면 저장').tap();
  await page.waitForSelector('img[alt="배경화면 미리보기"]', { timeout: 15000 }).catch(() => results.push(`[${vp.name}] WALLPAPER PC PREVIEW TIMEOUT`));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wallpaper-pc-${vp.name}.png` });

  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
