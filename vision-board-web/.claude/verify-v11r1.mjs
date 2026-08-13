// v11 검증 — 타이틀 커스터마이즈 (표시 요소 · 가로 배치 · 투명 배경 · 크기 · 자유 드래그 · 전역/기기별 분리)
//
// v10r1의 V10-3a~4c(템플릿별 타이틀 위치 · 앵커 저장·유지)는 그대로 살아 있다.
// 여기서는 v11이 새로 연 축만 본다.
//
// 계약:
//  ① 타이틀 시트 — 툴바 '타이틀'로 열리고, 라디오 6종의 접근 이름과 44px 터치 타깃
//  ② 표시 요소 — '연도만'이면 라벨이 사라지고 카드가 낮아진다 / '숨기기'면 타이틀 자체가 없다
//  ③ 가로 배치 — 라벨과 연도의 세로 중심이 같고 카드가 가로로 길어진다
//  ④ 배경 — 투명은 알파 0 + 글자 그림자, 반투명은 중간 알파. **backdrop-filter는 어떤 경우에도 none**
//  ⑤ 자유 드래그 — 글자를 끌면 title.pos가 저장되고 리로드해도 유지된다 / 보드 밖으로 끌어도 경계 안
//  ⑥ ⤡ 리사이즈 — 카드가 커지고 collageTitle.scale이 오른다
//     ⚠️ 타이틀 핸들의 표식은 `data-title-resize`다. `data-resize-for`(=items 항목 핸들)에 끼면
//        기존 스위트의 사진 핸들 셀렉터가 타이틀을 집는다(V85-8d 실측)
//  ⑦ 전역/기기별 분리 — 모양은 폰↔PC 공유, 위치는 각자
//  ⑧ '기본 배치로' — 위치는 템플릿 기본으로, 모양(전역)은 유지
//  ⑨ 사진 접근성 — 편집 모드에서 타이틀 **카드**는 사진 탭을 막지 않는다(글자만 잡는다)
//  ⑩ 레거시 무회귀 — v10 형식(title:{anchor,style})이 렌더를 깨지 않고 스타일이 전역으로 승격된다
//  ⑪ 모바일 크기 — 390×844 폰 뷰에서 글자가 읽을 수 있는 크기
//  ⑫ canvas 락스텝 — 저장 미리보기 캔버스의 카드 중심 픽셀이 화면과 맞는다
//  ⑬ 육안 리뷰용 스크린샷 (⚠️ Read로 열어봐야 검증 완료)
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
const TALL = svg(100, 300, '#3355ff');
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
const fullBoard = (extra = {}) => {
  const o = {};
  for (let id = 1; id <= 6; id++) o[id] = withPhotos(`일기${id}`);
  return board(o, extra);
};
const mixedBoard = (extra = {}) => {
  const o = {};
  const pat = [TALL, WIDEIMG, TALL, WIDEIMG, TALL, WIDEIMG];
  for (let id = 1; id <= 6; id++) {
    o[id] = withPhotos(`일기${id}`, [pat[id - 1], pat[id % 6], pat[(id + 2) % 6], null, null]);
  }
  return board(o, extra);
};
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

async function newPage(seed, viewport = WIDE) {
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

const boardOf = (page, view = 'desktop') =>
  page.locator(`[data-testid="collage-board"][data-view="${view}"]`);
const titleBox = (bd) => bd.locator('[data-testid="board-title"]').boundingBox();

// 에디토리얼은 풀블리드라 '빈 곳 탭'이 성립하지 않는다 — 상시 어포던스 버튼이 결정적 진입점
async function enterEdit(page) {
  await page.getByRole('button', { name: /탭해서 편집/ }).first().click();
  await page.waitForTimeout(450);
}
async function openTitleSheet(page) {
  await page.getByRole('button', { name: '타이틀 설정' }).click();
  await page.waitForTimeout(300);
  return page.locator('[data-testid="title-sheet"]');
}
async function closeSheet(page) {
  await page.getByRole('button', { name: '닫기' }).last().click();
  await page.waitForTimeout(350);
}
/** 시트를 열어 라디오 하나를 고르고 닫는다 */
async function pickTitle(page, group, option) {
  const sheet = await openTitleSheet(page);
  // ⚠️ exact 필수 — '투명'이 '불투명'·'반투명'의 부분 문자열이라 strict mode 위반이 난다
  await sheet.getByRole('radiogroup', { name: group }).getByRole('radio', { name: option, exact: true }).click();
  await page.waitForTimeout(450);
  await closeSheet(page);
}

// ── ①② 시트 · 표시 요소 ──
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1600);
  const bd = boardOf(page);
  await enterEdit(page);

  const sheet = await openTitleSheet(page);
  ok('V11-1a 타이틀 시트 노출', (await sheet.count()) === 1);
  const groups = ['타이틀 표시', '타이틀 스타일', '타이틀 배치', '타이틀 배경'];
  const found = [];
  for (const g of groups) found.push(await sheet.getByRole('radiogroup', { name: g }).count());
  ok('V11-1b 라디오 그룹 4종', found.every((n) => n === 1), JSON.stringify(found));
  ok('V11-1c 크기 슬라이더', (await sheet.getByRole('slider', { name: '타이틀 크기' }).count()) === 1);
  ok('V11-1d 위치 9칸', (await sheet.getByRole('radiogroup', { name: '타이틀 위치' }).getByRole('radio').count()) === 9);
  // 모바일 터치 타깃 — 44px
  const hs = await sheet.getByRole('radiogroup', { name: '타이틀 표시' }).getByRole('radio').evaluateAll(
    (els) => els.map((e) => e.getBoundingClientRect().height)
  );
  ok('V11-1e 터치 타깃 ≥ 44px', hs.every((h) => h >= 44), JSON.stringify(hs.map((h) => Math.round(h))));
  await closeSheet(page);

  const allBox = await titleBox(bd);
  await pickTitle(page, '타이틀 표시', '연도만');
  const yearOnly = await titleBox(bd);
  const labelGone = !(await bd.locator('[data-testid="board-title"]').innerText()).includes('VISION');
  ok('V11-2a 연도만 — 라벨 소멸', labelGone);
  ok('V11-2b 연도만 — 카드 높이 감소', yearOnly && allBox && yearOnly.height < allBox.height - 1,
    `${allBox?.height?.toFixed(0)} → ${yearOnly?.height?.toFixed(0)}`);

  await pickTitle(page, '타이틀 표시', '숨기기');
  ok('V11-2c 숨기기 — 타이틀 없음', (await bd.locator('[data-testid="board-title"]').count()) === 0);

  await pickTitle(page, '타이틀 표시', '전체');
  ok('V11-2d 되돌리기', (await bd.locator('[data-testid="board-title"]').count()) === 1);
  await ctx.close();
}

// ── ③ 가로 배치 ──
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1600);
  const bd = boardOf(page);
  await enterEdit(page);
  await pickTitle(page, '타이틀 스타일', '밴드');

  const vBox = await titleBox(bd);
  await pickTitle(page, '타이틀 배치', '가로');
  const hBox = await titleBox(bd);
  ok('V11-3a 가로 배치 — 카드가 넓어지고 낮아진다',
    hBox && vBox && hBox.width > vBox.width && hBox.height < vBox.height,
    `${vBox?.width?.toFixed(0)}×${vBox?.height?.toFixed(0)} → ${hBox?.width?.toFixed(0)}×${hBox?.height?.toFixed(0)}`);

  const cys = await bd.locator('[data-testid="board-title"] > span').evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; })
  );
  ok('V11-3b 두 줄의 세로 중심 일치', cys.length === 2 && Math.abs(cys[0] - cys[1]) <= 2,
    JSON.stringify(cys.map((v) => Math.round(v))));
  await ctx.close();
}

// ── ④ 배경 ──
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1600);
  const bd = boardOf(page);
  await enterEdit(page);

  const read = () =>
    bd.locator('[data-testid="board-title"]').evaluate((el) => {
      const cs = getComputedStyle(el);
      const span = el.querySelector('span');
      return {
        bg: cs.backgroundColor,
        backdrop: cs.backdropFilter,
        shadow: span ? getComputedStyle(span).textShadow : 'none',
      };
    });
  const alphaOf = (rgb) => {
    const m = /rgba?\(([^)]+)\)/.exec(rgb);
    if (!m) return 1;
    const parts = m[1].split(',').map((s) => Number(s.trim()));
    return parts.length === 4 ? parts[3] : 1;
  };

  await pickTitle(page, '타이틀 배경', '불투명');
  const solid = await read();
  await pickTitle(page, '타이틀 배경', '반투명');
  const soft = await read();
  await pickTitle(page, '타이틀 배경', '투명');
  const clear = await read();

  ok('V11-4a 불투명 — 알파 ≥ 0.9', alphaOf(solid.bg) >= 0.9, solid.bg);
  ok('V11-4b 반투명 — 알파 0.4~0.85', alphaOf(soft.bg) >= 0.4 && alphaOf(soft.bg) <= 0.85, soft.bg);
  ok('V11-4c 투명 — 알파 0', alphaOf(clear.bg) === 0, clear.bg);
  ok('V11-4d 투명 — 글자 그림자 있음', clear.shadow !== 'none' && clear.shadow !== '', clear.shadow);
  ok('V11-4e 불투명·반투명 — 그림자 없음', solid.shadow === 'none' && soft.shadow === 'none');
  // ⚠️ canvas로 재현 불가 — 화면과 저장 이미지가 갈라지는 지점이라 계약으로 못박는다
  ok('V11-4f backdrop-filter 금지',
    [solid, soft, clear].every((s) => s.backdrop === 'none' || s.backdrop === ''),
    JSON.stringify([solid.backdrop, soft.backdrop, clear.backdrop]));
  await ctx.close();
}

// ── ⑤⑥⑨ 자유 드래그 · 리사이즈 · 사진 접근성 ──
{
  const seed = mixedBoard();
  const { ctx, page } = await newPage({ ...seed, photoDims: dimsFor(seed) });
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page);
  await enterEdit(page);

  // ⑨ 카드는 사진 탭을 막지 않는다 — 카드 안쪽이지만 글자가 없는 지점을 찍는다
  {
    const t = await titleBox(bd);
    const spans = await bd.locator('[data-testid="board-title"] > span').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })
    );
    // 카드 좌상단 안쪽 — 글자·핸들과 겹치지 않는 지점
    const px = t.x + 4;
    const py = t.y + 4;
    const onText = spans.some((s) => px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h);
    const hit = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el?.getAttribute('data-testid') ?? el?.tagName ?? 'none';
    }, [px, py]);
    ok('V11-9 카드 여백은 클릭을 삼키지 않는다', !onText && hit !== 'board-title', `hit=${hit}`);
  }

  // ⑤ 글자를 끌어 이동
  const before = await titleBox(bd);
  const span = bd.locator('[data-testid="board-title"] > span').first();
  const sb = await span.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2 - 160, sb.y + sb.height / 2 - 90, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await titleBox(bd);
  ok('V11-5a 드래그로 타이틀이 움직인다',
    after && before && Math.abs(after.x - before.x) > 60,
    `${before?.x?.toFixed(0)} → ${after?.x?.toFixed(0)}`);
  const stored1 = await loadStored(page);
  const pos = stored1.collageDeviceLayouts?.desktop?.editorial?.title?.pos;
  ok('V11-5b title.pos 저장', !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y), JSON.stringify(pos));

  await page.reload();
  await page.waitForTimeout(1800);
  const bd2 = boardOf(page);
  const afterReload = await titleBox(bd2);
  ok('V11-5c 리로드 후 위치 유지',
    afterReload && after && Math.abs(afterReload.x - after.x) < 8 && Math.abs(afterReload.y - after.y) < 8,
    `${after?.x?.toFixed(0)},${after?.y?.toFixed(0)} → ${afterReload?.x?.toFixed(0)},${afterReload?.y?.toFixed(0)}`);

  // 보드 밖으로 끌어도 경계 안
  await enterEdit(page);
  const sb2 = await bd2.locator('[data-testid="board-title"] > span').first().boundingBox();
  await page.mouse.move(sb2.x + sb2.width / 2, sb2.y + sb2.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb2.x - 900, sb2.y - 900, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const bb = await bd2.boundingBox();
  const clamped = await titleBox(bd2);
  ok('V11-5d 보드 밖으로 끌어도 경계 안',
    clamped && clamped.x >= bb.x - 1 && clamped.y >= bb.y - 1 &&
      clamped.x + clamped.width <= bb.x + bb.width + 1 && clamped.y + clamped.height <= bb.y + bb.height + 1,
    JSON.stringify({ t: [clamped?.x, clamped?.y], b: [bb.x, bb.y] }));

  // ⑥ ⤡ 리사이즈
  const beforeResize = await titleBox(bd2);
  const h = bd2.locator('[data-title-resize]');
  const hbb = await h.boundingBox();
  await page.mouse.move(hbb.x + hbb.width / 2, hbb.y + hbb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hbb.x + hbb.width / 2 + 120, hbb.y + hbb.height / 2 + 70, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const afterResize = await titleBox(bd2);
  ok('V11-6a 핸들 드래그로 카드가 커진다',
    afterResize && beforeResize && afterResize.width > beforeResize.width + 4,
    `${beforeResize?.width?.toFixed(0)} → ${afterResize?.width?.toFixed(0)}`);
  const stored2 = await loadStored(page);
  ok('V11-6b collageTitle.scale 저장(>1)',
    (stored2.collageTitle?.scale ?? 1) > 1, JSON.stringify(stored2.collageTitle));
  await ctx.close();
}

// ── ⑦ 전역/기기별 분리 ──
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(1800);
  await enterEdit(page);
  // 폰에서 모양(스타일)과 위치(앵커)를 각각 바꾼다
  await pickTitle(page, '타이틀 스타일', '라인');
  const sheet = await openTitleSheet(page);
  await sheet.getByRole('radiogroup', { name: '타이틀 위치' }).getByRole('radio', { name: '타이틀 왼쪽 아래' }).click();
  await page.waitForTimeout(450);
  await closeSheet(page);

  const s1 = await loadStored(page);
  ok('V11-7a 스타일은 전역에 저장', s1.collageTitle?.style === 'line', JSON.stringify(s1.collageTitle));
  ok('V11-7b 위치는 폰 배치에 저장',
    s1.collageDeviceLayouts?.phone?.editorial?.title?.anchor === 'bl',
    JSON.stringify(s1.collageDeviceLayouts?.phone?.editorial?.title));
  ok('V11-7c PC 위치는 건드리지 않는다',
    !s1.collageDeviceLayouts?.desktop?.editorial?.title?.anchor,
    JSON.stringify(s1.collageDeviceLayouts?.desktop?.editorial?.title ?? null));

  // PC 뷰로 가면 스타일은 따라오고 위치는 템플릿 기본(정중앙)
  await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio', { name: /PC/ }).click();
  await page.waitForTimeout(1400);
  const bdD = boardOf(page, 'desktop');
  const bbD = await bdD.boundingBox();
  const tD = await titleBox(bdD);
  const cyD = (tD.y + tD.height / 2 - bbD.y) / bbD.height;
  ok('V11-7d PC도 같은 스타일(라인 = 한 줄)',
    (await bdD.locator('[data-testid="board-title"] > span').evaluateAll((els) => {
      const cs = els.map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
      return cs.length === 2 && Math.abs(cs[0] - cs[1]) <= 2;
    })));
  ok('V11-7e PC 위치는 템플릿 기본(정중앙)', Math.abs(cyD - 0.5) < 0.08, cyD.toFixed(3));
  await ctx.close();
}

// ── ⑧ '기본 배치로' ──
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1600);
  await enterEdit(page);
  await pickTitle(page, '타이틀 배경', '투명');
  const sheet = await openTitleSheet(page);
  await sheet.getByRole('radiogroup', { name: '타이틀 위치' }).getByRole('radio', { name: '타이틀 오른쪽 아래' }).click();
  await page.waitForTimeout(450);
  await closeSheet(page);

  await page.getByRole('button', { name: '기본 배치로' }).click();
  await page.waitForTimeout(900);
  const s = await loadStored(page);
  ok('V11-8a 모양(전역)은 유지', s.collageTitle?.bg === 'clear', JSON.stringify(s.collageTitle));
  const bd = boardOf(page);
  const bb = await bd.boundingBox();
  const t = await titleBox(bd);
  const cy = (t.y + t.height / 2 - bb.y) / bb.height;
  ok('V11-8b 위치는 템플릿 기본(정중앙)으로', Math.abs(cy - 0.5) < 0.08, cy.toFixed(3));
  await ctx.close();
}

// ── ⑩ 레거시 무회귀 ──
{
  const legacy = fullBoard({
    collageTemplate: 'editorial',
    collageDeviceLayouts: {
      desktop: { editorial: { items: {}, title: { anchor: 'tr', style: 'bold' } } },
    },
  });
  const { ctx, page } = await newPage(legacy);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(1800);
  const bd = boardOf(page);
  ok('V11-10a 렌더 정상', (await bd.locator('[data-testid="board-title"]').count()) === 1);
  ok('V11-10b 사진 18장 유지', (await bd.locator('img[data-photo]').count()) === 18);
  const s = await loadStored(page);
  ok('V11-10c v10 스타일이 전역으로 승격', s.collageTitle?.style === 'bold', JSON.stringify(s.collageTitle));
  const bb = await bd.boundingBox();
  const t = await titleBox(bd);
  ok('V11-10d 저장된 앵커(우상단) 유지',
    (t.x + t.width / 2 - bb.x) / bb.width > 0.55 && (t.y + t.height / 2 - bb.y) / bb.height < 0.35);
  await ctx.close();
}

// ── ⑪ 모바일 크기 ──
{
  const { ctx, page } = await newPage(fullBoard(), NARROW);
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(1800);
  const bd = boardOf(page, 'phone');
  const sizes = await bd.locator('[data-testid="board-title"] > span').evaluateAll((els) =>
    els.map((e) => parseFloat(getComputedStyle(e).fontSize))
  );
  const bb = await bd.boundingBox();
  ok('V11-11a 폰 뷰 라벨 ≥ 11px', Math.min(...sizes) >= 11, `${JSON.stringify(sizes.map((s) => s.toFixed(1)))} (보드 ${bb.width.toFixed(0)}px)`);
  ok('V11-11b 폰 뷰 연도 ≥ 20px', Math.max(...sizes) >= 20, JSON.stringify(sizes.map((s) => s.toFixed(1))));
  // 글자가 카드 밖으로 넘치지 않는다
  const overflow = await bd.locator('[data-testid="board-title"]').evaluate((el) => {
    const b = el.getBoundingClientRect();
    return [...el.querySelectorAll('span')].some((s) => {
      const r = s.getBoundingClientRect();
      return r.left < b.left - 1 || r.right > b.right + 1;
    });
  });
  ok('V11-11c 글자가 카드 안', !overflow);
  // 폰 뷰 육안 — 오너가 "모바일에서 너무 작다"고 지적한 화면 그대로
  mkdirSync(OUT, { recursive: true });
  for (const [tpl, label] of [['editorial', '에디토리얼'], ['magazine', '매거진'], ['studio', '스튜디오']]) {
    await page.getByRole('radio', { name: new RegExp(label) }).click();
    await page.waitForTimeout(900);
    await bd.screenshot({ path: `${OUT}/title-v11-phone-${tpl}.png` });
  }
  await ctx.close();
}

// ── ⑫ canvas 락스텝 + ⑬ 스크린샷 ──
{
  mkdirSync(OUT, { recursive: true });
  const seed = mixedBoard();
  const { ctx, page } = await newPage({ ...seed, photoDims: dimsFor(seed) });
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page);

  for (const [tpl, label] of [['editorial', '에디토리얼'], ['magazine', '매거진'], ['studio', '스튜디오']]) {
    await page.getByRole('radio', { name: new RegExp(label) }).click();
    await page.waitForTimeout(1000);
    await bd.screenshot({ path: `${OUT}/title-v11-${tpl}.png` });
  }
  await page.getByRole('radio', { name: /에디토리얼/ }).click();
  await page.waitForTimeout(900);

  await enterEdit(page);
  for (const bg of ['불투명', '반투명', '투명']) {
    await pickTitle(page, '타이틀 배경', bg);
    await bd.screenshot({ path: `${OUT}/title-v11-bg-${bg}.png` });
  }
  await pickTitle(page, '타이틀 배치', '가로');
  await bd.screenshot({ path: `${OUT}/title-v11-dir-h.png` });
  await pickTitle(page, '타이틀 표시', '연도만');
  await bd.screenshot({ path: `${OUT}/title-v11-year-only.png` });
  await pickTitle(page, '타이틀 표시', '전체');
  await pickTitle(page, '타이틀 배치', '세로');
  await pickTitle(page, '타이틀 배경', '반투명');
  await page.getByRole('button', { name: '완료' }).click();
  await page.waitForTimeout(400);

  // 저장 시트 미리보기 canvas — 화면 카드 색과 맞는지 픽셀로 확인
  const t = await titleBox(bd);
  const bb = await bd.boundingBox();
  const rel = { x: (t.x + t.width / 2 - bb.x) / bb.width, y: (t.y + 6 - bb.y) / bb.height };
  await page.getByRole('button', { name: /배경화면 저장/ }).click();
  await page.waitForTimeout(4000);
  const shot = page.locator('[role="dialog"] canvas, [role="dialog"] img').first();
  const px = await page.evaluate(async (r) => {
    const img = document.querySelector('[role="dialog"] img');
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.round(r.x * c.width), Math.round(r.y * c.height), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], w: c.width, h: c.height };
  }, rel);
  ok('V11-12a 저장 미리보기 생성', px !== null && px.w > 0, JSON.stringify(px));
  // 반투명 흰 카드 위쪽 — 밝은 픽셀이어야 한다(사진이 그대로 보이면 카드가 안 그려진 것)
  ok('V11-12b 저장 이미지에 타이틀 카드가 그려진다',
    px !== null && (px.r + px.g + px.b) / 3 > 120, JSON.stringify(px));
  await shot.screenshot({ path: `${OUT}/title-v11-canvas.png` }).catch(() => {});
  ok('V11-13 스크린샷 저장 (⚠️ Read로 열어봐야 검증 완료)', true, `${OUT}/title-v11-*.png`);
  await ctx.close();
}

await browser.close();
const fails = results.filter((r) => r.startsWith('FAIL'));
const real = errors.filter((e) => !/418|Minified React error #418/.test(e));
if (real.length) console.log('PAGE ERRORS:', [...new Set(real)].slice(0, 5).join(' | '));
fails.forEach((r) => console.log(r));
console.log(`${results.length - fails.length} PASS / ${fails.length} FAIL (총 ${results.length})`);
process.exit(fails.length || real.length ? 1 : 0);
