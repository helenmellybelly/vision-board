// v9.0 검증 — 콜라주 그리드 재설계·매트 갤러리·배경색 팔레트·가이드 문구·온보딩 가치 전달
// 계약:
//  ① 리사이즈하면 드래그하지 않은 사진도 재배치된다 (자동 정렬)
//  ② 리사이즈 3연속 후에도 매번 재배치 + 구 '자유 배치 안내' 부재 (자동정렬 불사)
//  ③ 드래그로 자리 맞바꾸기 (스왑)
//  ④ 자유 배치 토글 — 켜면 회전 핸들 등장 + 타 사진 불변, 끄면 그리드 복귀
//  ⑤ 숲(polaroid) → 매트 갤러리 마이그레이션 + 1회 안내
//  ⑥ 배경색 팔레트: 세 템플릿 모두 노출, 다크 선택 시 연도 글자 흰색, 템플릿 바꿔도 유지
//  ⑦ 매트 갤러리 무크롭(object-contain)
//  ⑧ 가이드 문구가 보드 위 알약으로 노출
//  ⑨ /collage에 '미래 일기 읽기' 부재 (대시보드에는 존재)
//  ⑩ 그리드 모드에서 회전 핸들 부재 + '크게/작게' 칩 노출
//  ⑪ 온보딩 Step3 과정 3컷 + 차별점
//  ⑫ PC 실렌더 스크린샷 (육안 리뷰용)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = 'verify-shots';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// 100×300 세로 PNG — 매트 갤러리 무크롭 검증용 (정사각 셀에 넣으면 cover는 위아래를 자른다)
const TALL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="300"><rect width="100" height="300" fill="#3355ff"/></svg>'
  ).toString('base64');

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}
const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const withPhotos = (n = '스토리', imgs = [PIXEL, PIXEL, PIXEL, null, null]) => ({
  status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: `${n}.`,
  uploadedImages: imgs,
});
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
/** 사진 18장(6섹션 × 3장) — 오너가 문제를 겪은 실제 규모 */
const fullBoard = (extra = {}) => {
  const o = {};
  for (let id = 1; id <= 6; id++) o[id] = withPhotos(`일기${id}`);
  return board(o, extra);
};

const browser = await chromium.launch();
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };

async function newPage(seed, viewport = NARROW, extraInit) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  if (seed) {
    await page.addInitScript(
      ({ data, coach }) => {
        // ⚠️ 가드 필수 — reload가 앱 스탬프를 덮어써 위양성이 난다 (R2-2 교훈)
        if (!localStorage.getItem('vision-board-data')) {
          localStorage.setItem('vision-board-data', JSON.stringify(data));
        }
        if (coach) localStorage.setItem('vb-collage-coach-v1', '1');
      },
      { data: seed, coach: extraInit?.coach !== false }
    );
  }
  return { ctx, page };
}
const loadStored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}'));

/** 보드 안 사진들의 좌상단 좌표 시그니처 — 재배치 여부 판정용 */
const rectSig = (bd) =>
  bd.locator('img').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return `${r.left.toFixed(0)},${r.top.toFixed(0)},${r.width.toFixed(0)}`;
    }).join('|')
  );

async function enterEdit(page, bd) {
  await bd.click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(500);
}

async function dragHandle(page, handle, dx, dy) {
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + dx, hb.y + hb.height / 2 + dy, { steps: 6 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

// ── ①② 리사이즈 자동 정렬 + 불사 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');

  // 시드 채움률 — 완벽한 6열×3행 타일링도 갭 때문에 bbox의 ~86%가 상한이다(6×257+5×27 기준).
  // 100%를 기대하면 산술적으로 불가능한 단언이 된다
  const seedFill = await bd.locator('img').evaluateAll((els) => {
    if (!els.length) return 0;
    const rs = els.map((e) => e.getBoundingClientRect());
    const x0 = Math.min(...rs.map((r) => r.left));
    const y0 = Math.min(...rs.map((r) => r.top));
    const x1 = Math.max(...rs.map((r) => r.right));
    const y1 = Math.max(...rs.map((r) => r.bottom));
    return rs.reduce((s, r) => s + r.width * r.height, 0) / ((x1 - x0) * (y1 - y0));
  });
  ok('V90-1c 시드 빈틈 없음(bbox의 82%↑)', seedFill >= 0.82, `채움 ${(seedFill * 100).toFixed(0)}%`);

  await enterEdit(page, bd);

  let changes = 0;
  let previewSeen = false;
  for (let i = 0; i < 3; i++) {
    const before = await rectSig(bd);
    const handle = bd.locator('div[aria-label="크기 조절"]').nth(1);
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 130, hb.y + hb.height / 2 + 130, { steps: 6 });
    await page.waitForTimeout(200);
    if ((await page.locator('[data-testid="reflow-preview"]').count()) === 1) previewSeen = true;
    await page.mouse.up();
    await page.waitForTimeout(600);
    if ((await rectSig(bd)) !== before) changes++;
  }
  ok('V90-1a 리사이즈 → 전체 재배치', changes >= 1, `${changes}/3회 변화`);
  ok('V90-1b 드래그 중 고스트 프리뷰', previewSeen);
  ok('V90-2a 자동정렬 불사(3연속)', changes === 3, `${changes}/3`);
  ok('V90-2b 구 자유 배치 안내 부재', (await page.getByText('자동 정렬은 쉬어 갈게').count()) === 0);

  // 편집 후에도 사진끼리 겹치지 않는다 — 그리드 배치의 핵심 불변식
  const maxOverlap = await bd.locator('img').evaluateAll((els) => {
    const rs = els.map((e) => e.getBoundingClientRect());
    let worst = 0;
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const ox = Math.max(0, Math.min(rs[i].right, rs[j].right) - Math.max(rs[i].left, rs[j].left));
        const oy = Math.max(0, Math.min(rs[i].bottom, rs[j].bottom) - Math.max(rs[i].top, rs[j].top));
        const minA = Math.min(rs[i].width * rs[i].height, rs[j].width * rs[j].height);
        if (minA > 0) worst = Math.max(worst, (ox * oy) / minA);
      }
    return worst;
  });
  ok('V90-2c 편집 3회 후에도 무겹침', maxOverlap <= 0.01, `최대 ${(maxOverlap * 100).toFixed(1)}%`);
  await ctx.close();
}

// ── ③ 드래그 스왑 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  await enterEdit(page, bd);
  const boxes = await bd.locator('img').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; })
  );
  const a = boxes[0];
  const b = boxes.find((c) => Math.abs(c.w - a.w) < 2 && (Math.abs(c.x - a.x) > 20 || Math.abs(c.y - a.y) > 20));
  if (a && b) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.waitForTimeout(200);
    const highlighted = (await page.locator('[data-testid="swap-target"]').count()) >= 1;
    await page.mouse.up();
    await page.waitForTimeout(600);
    ok('V90-3a 드래그 중 스왑 대상 표시', highlighted);
    const stored = await loadStored(page);
    const grid = stored.collageDeviceLayouts?.desktop?.mosaic?.grid;
    ok('V90-3b 그리드가 저장된다', !!grid && grid.v === 1 && Array.isArray(grid.bands), grid ? `cols=${grid.cols}` : 'grid 없음');
  } else {
    ok('V90-3a 드래그 중 스왑 대상 표시', false, '동일 크기 대상 없음');
    ok('V90-3b 그리드가 저장된다', false, '전제 실패');
  }
  await ctx.close();
}

// ── ④⑩ 자유 배치 토글 · 회전 핸들 분리 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  await enterEdit(page, bd);
  ok('V90-10a 그리드 모드엔 회전 핸들 없음', (await bd.locator('div[aria-label="회전"]').count()) === 0);

  // 사진 탭 → 크게/작게 칩
  const first = await bd.locator('img').first().boundingBox();
  await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
  await page.waitForTimeout(400);
  ok('V90-10b 크게/작게 칩 노출',
    await page.getByRole('button', { name: '크게' }).isVisible().catch(() => false) &&
    await page.getByRole('button', { name: '작게' }).isVisible().catch(() => false));
  const beforeBump = await rectSig(bd);
  await page.getByRole('button', { name: '크게' }).click();
  await page.waitForTimeout(600);
  ok('V90-10c 크게 → 재배치', (await rectSig(bd)) !== beforeBump);

  const freeBtn = page.getByRole('button', { name: '자유 배치' });
  await freeBtn.click();
  await page.waitForTimeout(600);
  ok('V90-4a 자유 배치 ON → 회전 핸들 등장', (await bd.locator('div[aria-label="회전"]').count()) > 0);
  ok('V90-4b 자유 배치 상태 저장', (await loadStored(page)).collageDeviceLayouts?.desktop?.mosaic?.freeform === true);
  await freeBtn.click();
  await page.waitForTimeout(600);
  ok('V90-4c 자유 배치 OFF → 그리드 복귀', (await bd.locator('div[aria-label="회전"]').count()) === 0);
  ok('V90-4d 그리드 재생성', !!(await loadStored(page)).collageDeviceLayouts?.desktop?.mosaic?.grid);
  await ctx.close();
}

// ── ⑤ 숲 → 매트 갤러리 마이그레이션 ──
{
  const legacy = fullBoard({
    collageTemplate: 'polaroid',
    collageLayouts: { polaroid: { items: { '1-0': { x: 0.1, y: 0.2, w: 0.3, z: 1 } }, aspect: 4 / 5, edited: true } },
    collageDeviceLayouts: { phone: { polaroid: { items: {}, aspect: 9 / 19.5, edited: true } } },
  });
  const { ctx, page } = await newPage(legacy, WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const stored = await loadStored(page);
  ok('V90-5a 템플릿 polaroid → matte', stored.collageTemplate === 'matte', String(stored.collageTemplate));
  ok('V90-5b polaroid 배치 키 소멸',
    !stored.collageLayouts?.polaroid && !stored.collageDeviceLayouts?.phone?.polaroid);
  ok('V90-5c 전환 안내 1회 노출', await page.getByText("배경색도 골라봐", { exact: false }).isVisible().catch(() => false));
  ok('V90-5d 숲 라벨 부재', (await page.getByText('숲', { exact: true }).count()) === 0);
  await page.reload();
  await page.waitForTimeout(1800);
  ok('V90-5e 안내는 1회만', (await page.getByText("배경색도 골라봐", { exact: false }).count()) === 0);
  await ctx.close();
}

// ── ⑥ 배경색 팔레트 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  const palette = page.getByRole('radiogroup', { name: '보드 배경색' });
  ok('V90-6a 팔레트 노출(모자이크)', await palette.isVisible().catch(() => false));
  ok('V90-6b 스와치 8개', (await palette.getByRole('radio').count()) === 8);

  await palette.getByRole('radio', { name: '잉크' }).click();
  await page.waitForTimeout(600);
  const bg = await bd.evaluate((e) => getComputedStyle(e).backgroundColor);
  ok('V90-6c 보드 배경 변경', bg === 'rgb(28, 27, 25)', bg);
  ok('V90-6d 저장', (await loadStored(page)).collageBgColor === '#1C1B19');
  const yearColor = await bd.locator('text=/^2029$/').first().evaluate((e) => getComputedStyle(e).color).catch(() => '');
  ok('V90-6e 다크 배경 → 연도 글자 흰색', yearColor === 'rgb(255, 255, 255)', yearColor);

  // 템플릿을 바꿔도 색이 따라온다
  await page.getByRole('radio', { name: /매트 갤러리/ }).click();
  await page.waitForTimeout(900);
  const bg2 = await bd.evaluate((e) => getComputedStyle(e).backgroundColor);
  ok('V90-6f 템플릿 변경해도 색 유지', bg2 === 'rgb(28, 27, 25)', bg2);
  ok('V90-6g 팔레트는 매트에서도 노출', await palette.isVisible().catch(() => false));
  await page.getByRole('radio', { name: /미니멀/ }).click();
  await page.waitForTimeout(900);
  ok('V90-6h 미니멀에서도 팔레트 노출', await palette.isVisible().catch(() => false));
  await ctx.close();
}

// ── ⑦ 매트 갤러리 무크롭 ──
{
  const o = {};
  for (let id = 1; id <= 6; id++) o[id] = withPhotos(`일기${id}`, [TALL, TALL, TALL, null, null]);
  const { ctx, page } = await newPage(board(o, { collageTemplate: 'matte' }), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2200);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  const fit = await bd.locator('img').first().evaluate((e) => getComputedStyle(e).objectFit);
  ok('V90-7a 매트 갤러리 object-contain', fit === 'contain', fit);
  await page.getByRole('radio', { name: /모자이크/ }).click();
  await page.waitForTimeout(900);
  const fit2 = await bd.locator('img').first().evaluate((e) => getComputedStyle(e).objectFit);
  ok('V90-7b 모자이크는 object-cover', fit2 === 'cover', fit2);
  await ctx.close();
}

// ── ⑧⑨ 가이드 문구 · 미래 일기 링크 ──
{
  const { ctx, page } = await newPage(fullBoard({ futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.', finishCelebrated: true, storyPromptVersion: 3 }), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const hint = page.locator('[data-testid="board-hint"]');
  ok('V90-8a 가이드 문구 노출', await hint.isVisible().catch(() => false));
  ok('V90-8b 감상 모드 문구', (await hint.textContent())?.includes('사진을 탭하면 크게 보여'));
  // 보드보다 위에 있어야 시선에 걸린다
  const hy = (await hint.boundingBox())?.y ?? 0;
  const by = (await page.locator('[data-testid="collage-board"][data-view="desktop"]').boundingBox())?.y ?? 0;
  ok('V90-8c 문구가 보드 위에 위치', hy < by, `hint=${hy.toFixed(0)} board=${by.toFixed(0)}`);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  await enterEdit(page, bd);
  ok('V90-8d 편집 모드 문구 교체', (await hint.textContent())?.includes('자리를 바꾸고'));

  ok('V90-9a /collage 일기 링크 부재', (await page.getByText('📖 미래 일기 읽기').count()) === 0);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V90-9b 대시보드 일기 링크는 유지', await page.getByText('📖 미래 일기 읽기 →').isVisible().catch(() => false));
  await ctx.close();
}

// ── ⑪ 온보딩 Step3 가치 전달 ──
{
  const { ctx, page } = await newPage(null, NARROW);
  await page.goto(`${BASE}/onboarding/3`);
  await page.waitForTimeout(1500);
  ok('V90-11a 비전보드 정의 유지', await page.getByText('너만의 지도').isVisible().catch(() => false));
  ok('V90-11b 차별점 한 줄', await page.getByText('질문에 답하면 토리가 같이 만들어').isVisible().catch(() => false));
  const cuts = ['답하면', '담으면', '저장하면'];
  let seen = 0;
  for (const c of cuts) if (await page.getByText(c, { exact: true }).isVisible().catch(() => false)) seen++;
  ok('V90-11c 과정 3컷', seen === 3, `${seen}/3`);
  ok('V90-11d 결과 요약', await page.getByText('폰·PC 배경화면으로 저장', { exact: false }).isVisible().catch(() => false));
  ok('V90-11e CTA 도달 가능', await page.getByRole('button', { name: /비전보드 시작하기/ }).isVisible().catch(() => false));
  await ctx.close();
}

// ── ⑫ 육안 리뷰용 스크린샷 ──
{
  mkdirSync(OUT, { recursive: true });
  for (const [n, secs] of [[6, 2], [12, 4], [18, 6]]) {
    const o = {};
    for (let id = 1; id <= 6; id++) o[id] = id <= secs ? withPhotos(`일기${id}`) : { status: 'not_started' };
    const { ctx, page } = await newPage(board(o), { width: 1600, height: 1000 });
    await page.goto(`${BASE}/collage?view=desktop`);
    await page.waitForTimeout(2200);
    await page.locator('[data-testid="collage-board"][data-view="desktop"]')
      .screenshot({ path: `${OUT}/collage-v90-desktop-${n}.png` }).catch(() => {});
    await ctx.close();
  }
  ok('V90-12 스크린샷 저장', true, `${OUT}/collage-v90-desktop-{6,12,18}.png`);
}

await browser.close();
for (const r of results) console.log(r);
const fail = results.filter((r) => r.startsWith('FAIL'));
if (errors.length) console.log(`\n페이지 에러 ${errors.length}건:\n` + [...new Set(errors)].slice(0, 8).join('\n'));
console.log(`\n${results.length - fail.length} PASS / ${fail.length} FAIL (총 ${results.length})`);
process.exit(fail.length ? 1 : 0);
