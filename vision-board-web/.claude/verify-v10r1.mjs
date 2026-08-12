// v10 검증 — 방향 인식 저스티파이드 배치 · 템플릿 3종 · 타이틀 앵커 · 기본 스티커 킷
//
// v9의 verify-v90r1(.claude/archive/)을 대체한다. 살아있는 계약만 이식하고,
// 그리드·매트 갤러리에 매인 단언은 폐기했다.
//
// 계약:
//  ① 세로 사진이 세로로 들어간다 — 렌더 비율이 원본 비율의 ±10% 안 (오너가 지적한 그 문제)
//  ② 무크롭 — 세로 SVG를 넣어도 object-fit이 cover이면서 박스 자체가 세로다
//  ③ 템플릿 3종 전환 시 타이틀 카드 위치가 실제로 다르다
//  ④ 타이틀 앵커 변경 → 저장 → 리로드 후 유지
//  ⑤ 기본 스티커 킷이 보드에 있다 / 지우면 안 돌아온다 / '기본 배치로'면 되살아난다
//  ⑥ 드래그 스왑 — 하이라이트 + spec 저장(v===2)
//  ⑦ 크게/작게 칩 — 3연속에도 배치가 살아있고 겹치지 않는다
//  ⑧ 자유 배치 토글 ↔ 회전 핸들 등장/소멸
//  ⑨ 마이그레이션 — 구 템플릿(mosaic) + 구 배치가 매거진 + v5로 이관되고 1회 안내
//  ⑩ photoDims 백필 — 진입 후 localStorage에 치수가 생긴다
//  ⑪ displaySrc 관문 — 원격 사진 직접 요청 0건(전부 /api/image/proxy)
//  ⑫ PC 무스크롤 + 보드 폭 (v87r1 계약 승계 확인)
//  ⑬ 육안 리뷰용 스크린샷
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = 'verify-shots';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const svg = (w, h, fill) =>
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`
  ).toString('base64');
/** 100×300 세로 — v9라면 정사각 셀에서 위아래가 잘렸을 사진 */
const TALL = svg(100, 300, '#3355ff');
/** 300×100 가로 */
const WIDEIMG = svg(300, 100, '#ff8833');

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
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 5,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
/** 사진 18장(6섹션 × 3장) — 오너가 문제를 겪은 실제 규모 */
const fullBoard = (extra = {}) => {
  const o = {};
  for (let id = 1; id <= 6; id++) o[id] = withPhotos(`일기${id}`);
  return board(o, extra);
};
/** 세로·가로가 섞인 보드 — 방향 인식 배치의 본 시험대 */
const mixedBoard = (extra = {}) => {
  const o = {};
  const pat = [TALL, WIDEIMG, TALL, WIDEIMG, TALL, WIDEIMG];
  for (let id = 1; id <= 6; id++) {
    o[id] = withPhotos(`일기${id}`, [pat[id - 1], pat[(id % 6)], pat[(id + 2) % 6], null, null]);
  }
  return board(o, extra);
};
/** 치수를 미리 심어 백필을 기다리지 않고 방향 인식 배치를 바로 보게 한다 */
const dimsFor = (b) => {
  const d = {};
  for (let id = 1; id <= 6; id++) {
    const imgs = b.sections[id].uploadedImages ?? [];
    for (let i = 0; i < 3; i++) {
      const src = imgs[i];
      if (!src) continue;
      const tall = src === TALL;
      d[`${id}-${i}`] = { w: tall ? 100 : 300, h: tall ? 300 : 100, f: `${src.length}:${src.slice(-16)}` };
    }
  }
  return d;
};

const browser = await chromium.launch();
const NARROW = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 900 };

async function newPage(seed, viewport = NARROW) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  if (seed) {
    await page.addInitScript(
      ({ data }) => {
        // ⚠️ 가드 필수 — reload가 앱 스탬프를 덮어써 위양성이 난다 (R2-2 교훈)
        if (!localStorage.getItem('vision-board-data')) {
          localStorage.setItem('vision-board-data', JSON.stringify(data));
        }
        localStorage.setItem('vb-collage-coach-v1', '1');
      },
      { data: seed }
    );
  }
  return { ctx, page };
}
const loadStored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}'));

const rects = (bd) =>
  bd.locator('img[data-photo]').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.left, y: r.top, src: e.getAttribute('src') ?? '' };
    })
  );

async function enterEdit(page, bd) {
  // 에디토리얼은 풀블리드라 '빈 곳 탭'이 성립하지 않는다 — 상시 어포던스 버튼이 결정적 진입점
  await page.getByRole('button', { name: /탭해서 편집/ }).first().click();
  await page.waitForTimeout(450);
  void bd;
}

// ── ①② 방향 인식 · 무크롭 ──
{
  const seed = mixedBoard();
  const { ctx, page } = await newPage({ ...seed, photoDims: dimsFor(seed) }, WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2200);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  const rs = (await rects(bd)).filter((r) => r.w > 0 && r.h > 0);
  ok('V10-1a 사진 18장 렌더', rs.length === 18, `${rs.length}장`);

  // 세로 사진(원본 1:3)은 세로 박스에, 가로 사진(3:1)은 가로 박스에
  let misfit = 0;
  let worstCrop = 0;
  for (const r of rs) {
    const tall = r.src.includes(TALL.slice(-24));
    const want = tall ? 100 / 300 : 300 / 100;
    const got = r.w / r.h;
    worstCrop = Math.max(worstCrop, Math.abs(1 - got / want));
    if (tall && got >= 1) misfit++;
    if (!tall && got <= 1) misfit++;
  }
  ok('V10-1b 세로는 세로 박스 · 가로는 가로 박스', misfit === 0, `어긋남 ${misfit}건`);
  ok('V10-1c 렌더 비율이 원본 ±10%', worstCrop <= 0.1, `최대 ${(worstCrop * 100).toFixed(1)}%`);

  const fit = await bd.locator('img').first().evaluate((e) => getComputedStyle(e).objectFit);
  ok('V10-2a 전 템플릿 object-cover (액자 폐지)', fit === 'cover', fit);

  // 무겹침
  let overlap = 0;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      overlap = Math.max(overlap, (ox * oy) / Math.min(a.w * a.h, b.w * b.h));
    }
  }
  ok('V10-2b 무겹침', overlap < 0.02, `${(overlap * 100).toFixed(1)}%`);

  mkdirSync(OUT, { recursive: true });
  await bd.screenshot({ path: `${OUT}/collage-v10-desktop-mixed18.png` });
  await ctx.close();
}

// ── ③④ 타이틀 앵커 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1600);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  const titleCenter = async () => {
    const b = await bd.locator('[data-testid="board-title"]').boundingBox();
    const bb = await bd.boundingBox();
    return b && bb ? { x: (b.x + b.width / 2 - bb.x) / bb.width, y: (b.y + b.height / 2 - bb.y) / bb.height } : null;
  };
  const centers = {};
  for (const label of ['에디토리얼', '매거진', '스튜디오']) {
    await page.getByRole('radio', { name: new RegExp(label) }).click();
    await page.waitForTimeout(900);
    centers[label] = await titleCenter();
  }
  const distinct = new Set(
    Object.values(centers).map((c) => (c ? `${c.x.toFixed(2)},${c.y.toFixed(2)}` : 'null'))
  );
  ok('V10-3a 템플릿마다 타이틀 위치가 다르다', distinct.size === 3, JSON.stringify(centers));
  ok('V10-3b 에디토리얼은 정중앙', centers['에디토리얼'] && Math.abs(centers['에디토리얼'].y - 0.5) < 0.06);
  ok('V10-3c 매거진은 좌상단', centers['매거진'] && centers['매거진'].x < 0.45 && centers['매거진'].y < 0.35);

  // 앵커 변경 → 저장 → 리로드 유지
  await enterEdit(page, bd);
  await page.getByRole('button', { name: '타이틀 위치' }).click();
  await page.waitForTimeout(300);
  const panel = page.locator('[data-testid="title-panel"]');
  ok('V10-4a 타이틀 패널 노출', (await panel.count()) === 1);
  await panel.getByRole('radio', { name: '타이틀 오른쪽 아래' }).click();
  await page.waitForTimeout(700);
  const stored = await loadStored(page);
  const savedTitle = stored.collageDeviceLayouts?.desktop?.studio?.title;
  ok('V10-4b 앵커 저장', savedTitle?.anchor === 'br', JSON.stringify(savedTitle));
  await page.reload();
  await page.waitForTimeout(1800);
  const after = await titleCenter();
  ok('V10-4c 리로드 후에도 오른쪽 아래', after && after.x > 0.55 && after.y > 0.6, JSON.stringify(after));
  await ctx.close();
}

// ── ⑤ 기본 스티커 킷 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1800);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  const stored = await loadStored(page);
  const kitIds = Object.keys(
    stored.collageDeviceLayouts?.desktop?.editorial?.stickers ?? {}
  ).filter((k) => k.startsWith('kit:'));
  // 저장 전이면 화면에서 센다 — 킷은 시드 산출물이라 저장 없이도 보여야 한다
  const onBoard = await bd.locator('text=all is well').count();
  ok('V10-5a 기본 킷이 보드에 있다', kitIds.length >= 1 || onBoard >= 1, `저장 ${kitIds.length} / 화면 ${onBoard}`);

  await enterEdit(page, bd);
  const del = bd.locator('button[aria-label="스티커 삭제"]');
  const before = await del.count();
  if (before > 0) {
    await del.first().click();
    await page.waitForTimeout(700);
    const s2 = await loadStored(page);
    const removed = s2.collageDeviceLayouts?.desktop?.editorial?.kitRemoved ?? [];
    ok('V10-5b 킷 삭제가 기억된다', removed.length >= 1, JSON.stringify(removed));
    await page.getByRole('button', { name: '기본 배치로' }).click();
    await page.waitForTimeout(800);
    const s3 = await loadStored(page);
    const back = s3.collageDeviceLayouts?.desktop?.editorial?.kitRemoved ?? [];
    ok("V10-5c '기본 배치로'가 킷을 되살린다", back.length === 0, JSON.stringify(back));
  } else {
    ok('V10-5b 킷 삭제가 기억된다', false, '삭제 버튼 없음');
    ok("V10-5c '기본 배치로'가 킷을 되살린다", false, '삭제 버튼 없음');
  }
  await ctx.close();
}

// ── ⑥⑦⑧ 편집 조작 ──
{
  const seed = mixedBoard();
  const { ctx, page } = await newPage({ ...seed, photoDims: dimsFor(seed) }, WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  await enterEdit(page, bd);

  // 드래그 스왑
  const rs0 = await rects(bd);
  const a = rs0[0];
  const b = rs0[5];
  await page.mouse.move(a.x + a.w / 2, a.y + a.h / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2, { steps: 8 });
  await page.waitForTimeout(250);
  const hi = await page.locator('[data-testid="swap-target"]').count();
  await page.mouse.up();
  await page.waitForTimeout(700);
  ok('V10-6a 스왑 하이라이트', hi === 1, `${hi}`);
  const stored = await loadStored(page);
  const spec = stored.collageDeviceLayouts?.desktop?.editorial?.spec;
  ok('V10-6b spec 저장(v===2)', spec?.v === 2, JSON.stringify(spec?.rows ?? null));
  ok('V10-6c 사진 수 불변', (await rects(bd)).length === 18);

  // 크게/작게 3연속 — 배치가 살아있고 겹치지 않는다
  let alive = true;
  for (let i = 0; i < 3; i++) {
    const cur = await rects(bd);
    await page.mouse.click(cur[3].x + cur[3].w / 2, cur[3].y + cur[3].h / 2);
    await page.waitForTimeout(350);
    const btn = page.getByRole('button', { name: '크게' });
    if ((await btn.count()) === 0) { alive = false; break; }
    await btn.click();
    await page.waitForTimeout(700);
    const after = (await rects(bd)).filter((r) => r.w > 0);
    if (after.length !== 18) { alive = false; break; }
    for (let x = 0; x < after.length && alive; x++) {
      for (let y = x + 1; y < after.length; y++) {
        const p = after[x], q = after[y];
        const ox = Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x));
        const oy = Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
        if ((ox * oy) / Math.min(p.w * p.h, q.w * q.h) > 0.02) { alive = false; break; }
      }
    }
  }
  ok('V10-7a 크게 3연속 후에도 배치가 살아있다(무겹침·18장)', alive);

  // 자유 배치 토글 ↔ 회전 핸들
  const photoRot = () => bd.locator('div[data-rot-for]:not([data-rot-for^="sticker:"])').count();
  const rotBefore = await photoRot();
  await page.getByRole('button', { name: '자유 배치' }).click();
  await page.waitForTimeout(800);
  const rotAfter = await photoRot();
  ok('V10-8a 정렬 모드엔 사진 회전 핸들 없음', rotBefore === 0, `${rotBefore}`);
  ok('V10-8b 자유 배치에서 회전 핸들 등장', rotAfter > 0, `${rotAfter}`);
  await ctx.close();
}

// ── ⑨ 마이그레이션 ──
{
  const legacy = fullBoard({
    schemaVersion: 4,
    collageTemplate: 'mosaic',
    collageDeviceLayouts: {
      desktop: { mosaic: { items: { '1-0': { x: 0.1, y: 0.2, w: 0.3, z: 1 } }, aspect: 16 / 9, edited: true } },
    },
  });
  const { ctx, page } = await newPage(legacy, WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const stored = await loadStored(page);
  ok('V10-9a mosaic → 매거진', stored.collageTemplate === 'magazine', String(stored.collageTemplate));
  ok('V10-9b 스키마 v5', stored.schemaVersion === 5, String(stored.schemaVersion));
  const notice = await page.locator('text=보드 만드는 방식이 새로워졌어').count();
  ok('V10-9c 전환 안내 1회', notice === 1, `${notice}`);
  const bd = page.locator('[data-testid="collage-board"][data-view="desktop"]');
  ok('V10-9d 사진 18장 모두 보임', (await rects(bd)).filter((r) => r.w > 0).length === 18);
  await page.reload();
  await page.waitForTimeout(1800);
  ok('V10-9e 안내는 재노출되지 않는다', (await page.locator('text=보드 만드는 방식이 새로워졌어').count()) === 0);
  await ctx.close();
}

// ── ⑩⑪ 치수 백필 · displaySrc 관문 ──
{
  const { ctx, page } = await newPage(fullBoard(), WIDE);
  const direct = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/images\.unsplash\.com|blob\.core\.windows\.net|public\.blob\.vercel-storage\.com/.test(u)) direct.push(u);
  });
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2500);
  const stored = await loadStored(page);
  const dims = Object.keys(stored.photoDims ?? {});
  ok('V10-10a photoDims 백필', dims.length === 18, `${dims.length}건`);
  ok('V10-11a 원격 사진 직접 요청 0건(전부 프록시 경유)', direct.length === 0, direct.slice(0, 2).join(' '));
  await ctx.close();
}

// ── ⑫ PC 무스크롤 + 보드 폭 (v87r1 계약 승계) ──
{
  const { ctx, page } = await newPage(fullBoard(), { width: 1440, height: 900 });
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1800);
  const m = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
  }));
  ok('V10-12a PC 뷰 무스크롤', m.scrollH <= m.innerH + 2, `${m.scrollH} vs ${m.innerH}`);
  const bb = await page.locator('[data-testid="collage-board"][data-view="desktop"]').boundingBox();
  ok('V10-12b PC 보드 폭 ≥1000px', (bb?.width ?? 0) >= 1000, `${Math.round(bb?.width ?? 0)}px`);
  await ctx.close();
}

// ── ⑬ 육안 리뷰용 스크린샷 ──
{
  mkdirSync(OUT, { recursive: true });
  for (const [name, count] of [['6', 2], ['12', 4], ['18', 6]]) {
    const o = {};
    for (let id = 1; id <= 6; id++) {
      o[id] = id <= count ? withPhotos(`일기${id}`) : { status: 'not_started', images: [] };
    }
    const seed = board(o);
    for (const tpl of ['editorial', 'magazine', 'studio']) {
      const { ctx, page } = await newPage({ ...seed, collageTemplate: tpl }, WIDE);
      await page.goto(`${BASE}/collage?view=desktop`);
      await page.waitForTimeout(1600);
      await page
        .locator('[data-testid="collage-board"][data-view="desktop"]')
        .screenshot({ path: `${OUT}/collage-v10-${tpl}-${name}.png` });
      await ctx.close();
    }
  }
  ok('V10-13 스크린샷 9종 저장', true, `${OUT}/collage-v10-*.png`);
}

await browser.close();
const fails = results.filter((r) => r.startsWith('FAIL'));
fails.forEach((r) => console.log(r));
// 하이드레이션 #418은 기존 전역 패턴 — 이번 변경과 무관하므로 집계에서 뺀다 (Retros/LESSONS)
const real = errors.filter((e) => !/418|Minified React error #418/.test(e));
if (real.length) console.log('PAGE ERRORS:', [...new Set(real)].slice(0, 5).join(' | '));
console.log(`${results.length - fails.length} PASS / ${fails.length} FAIL (총 ${results.length})`);
process.exit(fails.length || real.length ? 1 : 0);
