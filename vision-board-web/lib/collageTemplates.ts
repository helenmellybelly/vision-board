// 콜라주 템플릿 정의 — 테마 + 시드 배치 생성기 + 배치 reconcile (v9.0 그리드 재설계).
//
// 배치의 진실 원천은 lib/collageGrid.ts의 GridSpec이고, 조판 수치는 lib/collageTokens.ts가 소유한다.
// 이 파일은 "어떤 그리드를 고를 것인가"(chooseGrid)와 "저장된 배치를 현재 사진 구성에 맞추는 법"
// (resolveLayout)만 담당한다.
//
// ⚠️ cols 탐색의 목적함수는 채움률(fill)이다. v8.7까지는 argmax cellW(셀 폭 최대화)였고,
//    그게 오너가 말한 "왁! 큰 느낌"의 직접 원인이었다 — 알고리즘이 "크게 채우기"를 최적화하고 있었다.
//    "빈틈 없이 꽉"(목적함수)과 "왁! 하지 않게"(제약)를 분리해야 둘 다 만족한다.
import {
  CollageLayout,
  CollageLayoutItem,
  CollageSticker,
  CollageTemplate,
  StickerStyle,
} from './types';
import {
  BG_PALETTE,
  GUARDRAIL_MIN_ITEMS,
  GridTemplate,
  SPAN_CAP,
  TEMPLATE_DEFAULT_BG,
  boxRatioOk,
  hasTopReserve,
  isLandscape,
  normalizeBgColor,
  photoBounds,
  spacingFor,
  titleInkFor,
} from './collageTokens';
import {
  Band,
  GridSpec,
  buildBands,
  assertTiling,
  gridKeys,
  gridMetrics,
  insertKeys,
  layoutCells,
  materialize,
  removeKeys,
} from './collageGrid';

export interface CollageItem {
  key: string; // `${sectionId}-${slotIdx}` — 사진 교체·삭제에도 안정적
  src: string;
  /** 사진 실제 가로세로비(w/h) — 있으면 세로 사진을 정사각 히어로에 넣지 않는다 (v9.0).
   *  비동기 측정이라 없을 수 있고, 없으면 1로 간주해 결정성을 지킨다 */
  ratio?: number;
}

// 4:5 보드 — 정규화 y는 (픽셀 y / 보드 높이)라서, 정사각 사진의 정규화 높이 = w × ASPECT
export const ASPECT = 4 / 5;

// 비율 판정은 collageTokens가 단일 소스 — 기존 호출부 호환을 위해 재export
export { hasTopReserve, isLandscape } from './collageTokens';
/** 비율 차이 ~2% 이내면 같은 배치를 그대로 쓴다 (예: 기본 폰 9:19.5 ↔ iPhone 9:19.5) */
export const aspectsEqual = (a: number, b: number) => Math.abs(a - b) / b <= 0.02;

export const MIN_W = 0.12;
export const MAX_W = 0.7;
export const STICKER_MIN_W = 0.18;

// ── 테마 ──
// v8.7까지 COLLAGE_THEMES는 상수 테이블이었지만, 배경색을 사용자가 고르게 되면서 dark가
// 배경색 파생값이 됐다 — 상수로는 표현할 수 없어 함수로 승격했다 (v9.0).

export interface CollageTheme {
  bg: string;
  /** 사진 프레임 — v7.6부터 전 템플릿 rounded(사진만 + 라운드·그림자) */
  frame: 'rounded' | 'matte';
  /** 타이틀 위치 — 전 템플릿 상단 밴드 (중앙 연도 카드는 숲과 함께 폐기) */
  titlePos: 'top';
  /** 어두운 배경인가 — 타이틀 글자색·사진 경계 처리 분기 */
  dark: boolean;
  /** 연도 글자색 */
  titleInk: string;
  /** "VISION BOARD" 라벨 글자색 */
  labelInk: string;
}

/** 템플릿 + 사용자가 고른 배경색 → 렌더 테마. DOM·canvas가 이 함수 하나만 호출해 락스텝을 지킨다 */
export function themeFor(template: CollageTemplate, bgColor?: string): CollageTheme {
  const bg = normalizeBgColor(bgColor, template);
  const ink = titleInkFor(bg);
  return {
    bg,
    frame: template === 'matte' ? 'matte' : 'rounded',
    titlePos: 'top',
    dark: ink.dark,
    titleInk: ink.title,
    labelInk: ink.label,
  };
}

export { BG_PALETTE, TEMPLATE_DEFAULT_BG, normalizeBgColor };

export const DEFAULT_TEMPLATE: CollageTemplate = 'mosaic';
export const TEMPLATE_ORDER: CollageTemplate[] = ['mosaic', 'minimal', 'matte'];

/** 알 수 없는 템플릿 값(구 'polaroid', 손상 데이터)을 안전하게 접는다 */
export function normalizeTemplate(t: string | undefined): CollageTemplate {
  return TEMPLATE_ORDER.includes(t as CollageTemplate) ? (t as CollageTemplate) : DEFAULT_TEMPLATE;
}

// 스티커 글자 크기 = 항목 폭(it.w) × 보드 폭(px) × 비율 — DOM(cqi)과 canvas가 같은 식을 쓴다
export const STICKER_FONT_RATIO: Record<StickerStyle, number> = {
  script: 0.17,
  chip: 0.11,
  outline: 0.15,
};

// 스티커 시트 프리셋 문구 — 샘플 무드보드의 어퍼메이션 레퍼런스 (v7.6 다양화)
// 이모지는 chip/script만 — outline은 strokeText 외곽선이 이모지 글리프를 깨뜨린다
export const STICKER_PRESETS: { text: string; style: StickerStyle }[] = [
  { text: '잘 될 거야', style: 'chip' },
  { text: '될 일은 된다', style: 'chip' },
  { text: '그러니까 감사', style: 'chip' },
  { text: '일단 시작 🔥', style: 'chip' },
  { text: '자라나는 중 🌱', style: 'chip' },
  { text: '올해는 내 해 🍀', style: 'chip' },
  { text: '매일 조금씩', style: 'chip' },
  { text: '나는 내 편', style: 'chip' },
  { text: '가볍게, 꾸준히', style: 'chip' },
  { text: '운을 심는 중 🍀', style: 'chip' },
  { text: "It's my year", style: 'script' },
  { text: 'lucky me', style: 'script' },
  { text: 'bloom ✨', style: 'script' },
  { text: 'growing 🌱', style: 'script' },
  { text: 'all is well', style: 'script' },
  { text: 'YOU CAN AND YOU WILL', style: 'outline' },
  { text: 'DO IT NOW', style: 'outline' },
  { text: 'MAKE IT HAPPEN', style: 'outline' },
];

export const stickerKey = (id: string) => `sticker:${id}`;
export const isStickerKey = (key: string) => key.startsWith('sticker:');

interface Rect { x: number; y: number; w: number; h: number }
const overlapArea = (a: Rect, b: Rect) => {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
};

/** 저장된 배치가 "사진이 서로를 가리는" 수준으로 망가졌는지 판정 (v8.4).
 *  경계 대폭 이탈 또는 어느 쌍이든 겹침이 작은 쪽 면적의 50%를 넘으면 broken.
 *  v9.0에서는 그리드 배치가 원천적으로 무겹침이라, 이 판정은 레거시 자유 배치에만 의미가 있다 */
export function isLayoutBroken(
  saved: CollageLayout,
  items: CollageItem[],
  aspect: number = ASPECT
): boolean {
  const rects: Rect[] = [];
  for (const item of items) {
    const it = saved.items[item.key];
    if (!it) continue;
    const r = { x: it.x, y: it.y, w: it.w, h: it.h ?? it.w * aspect };
    if (r.x < -0.02 || r.y < -0.02 || r.x + r.w > 1.02 || r.y + r.h > 1.02) return true;
    rects.push(r);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const minA = Math.min(rects[i].w * rects[i].h, rects[j].w * rects[j].h);
      if (minA > 0 && overlapArea(rects[i], rects[j]) / minA > 0.5) return true;
    }
  }
  return false;
}

// ── 그리드 선택 ──
//
// 템플릿의 성격은 여백 수치가 아니라 "어떤 그리드를 선호하는가"에서 갈린다:
//   모자이크 — 매거진 리듬. 2×2 히어로 허용 + 크기 섞임에 가산점
//   미니멀   — 절제. 히어로 없음. 크기는 splitCols가 만드는 자연스러운 정도만 (v8.5 오너 확정:
//              "전부 같은 크기"는 배치를 고려하지 않은 것으로 보인다 → 완전 균일도 아니다)
//   매트     — 액자. 전 항목 1×1 균일, 마지막 짧은 행은 채우지 않고 가운데 정렬
const VARIETY_WEIGHT: Record<GridTemplate, number> = { mosaic: 0.12, minimal: 0, matte: 0 };

/** 세로 사진을 정사각 히어로에 넣으면 위아래가 잘려 글자가 안 보인다(오너 v8.7 팟캐스트 사례).
 *  이 비율보다 세로로 길면 히어로 후보에서 제외한다 */
const PORTRAIT_RATIO = 0.8;

interface GridChoice {
  grid: GridSpec;
  score: number;
  fill: number;
}

function recipesFor(template: CollageTemplate, heroAllowed: boolean) {
  if (template === 'matte') return [{ uniform: true }];
  if (template === 'minimal') return [{ hero: false }];
  return heroAllowed
    ? [{ hero: false }, { hero: true, heroMax: 1 }, { hero: true, heroMax: 2 }]
    : [{ hero: false }];
}

/** 후보 cols마다 실제로 밴드를 구성하고 셀 크기를 계산해, 가드레일을 통과하는 것 중
 *  점수가 가장 높은 그리드를 고른다. 결정적(무작위 없음) */
export function chooseGrid(
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number
): GridSpec | null {
  const keys = items.map((i) => i.key);
  const n = keys.length;
  if (n === 0) return null;

  const bounds = photoBounds(aspect);
  const sp = spacingFor(template, aspect);
  const maxCols = hasTopReserve(aspect) ? 5 : 10;
  const heroAllowed = (items[0]?.ratio ?? 1) >= PORTRAIT_RATIO;
  const recipes = recipesFor(template, heroAllowed);

  let best: GridChoice | null = null;
  for (let cols = 1; cols <= maxCols; cols++) {
    for (const recipe of recipes) {
      const bands = buildBands(keys, cols, recipe);
      if (!bands || bands.length === 0) continue;
      const grid: GridSpec = { v: 1, cols, bands };
      if (!assertTiling(grid)) continue;

      const m = gridMetrics(grid, template, aspect);
      const { cells } = layoutCells(grid);
      // ⚠️ 가드레일은 k-축소가 끝난 최종 박스에 적용한다 — 축소 전 값으로 보면 멀쩡한 후보를 버린다
      let ok = true;
      let varied = 0;
      for (const cell of cells) {
        const w = cell.sc * m.unitW + (cell.sc - 1) * sp.gutterX;
        const h = cell.sr * m.unitH + (cell.sr - 1) * sp.gutterY;
        if (cell.sc > 1 || cell.sr > 1) varied++;
        if (n < GUARDRAIL_MIN_ITEMS) continue; // 1~2장은 크게 보이는 게 맞다
        if (h > bounds.maxH || h < bounds.minH || !boxRatioOk(w, h, aspect, bounds)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const score = m.fill * (1 + VARIETY_WEIGHT[template] * (varied / n));
      if (!best || score > best.score + 1e-9) best = { grid, score, fill: m.fill };
    }
  }
  return best?.grid ?? null;
}

/** grid로부터 items를 다시 만든다. grid와 items의 일관성이 이 함수 하나로 보장된다 */
export function applyGrid(
  layout: CollageLayout,
  template: CollageTemplate,
  aspect: number
): CollageLayout {
  if (!layout.grid) return layout;
  const stickerItems: Record<string, CollageLayoutItem> = {};
  for (const [k, v] of Object.entries(layout.items)) if (isStickerKey(k)) stickerItems[k] = v;
  const zBefore = layout.items;
  const photos = materialize(layout.grid, template, aspect, (key, i) => zBefore[key]?.z ?? i + 1);
  return { ...layout, items: { ...photos, ...stickerItems } };
}

export function seedLayout(
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number = ASPECT
): CollageLayout {
  const photos = items.filter((i) => !isStickerKey(i.key));
  const grid = chooseGrid(template, photos, aspect);
  if (!grid) return { items: {}, aspect, edited: false };
  return {
    items: materialize(grid, template, aspect),
    aspect,
    edited: false,
    grid,
  };
}

// ── 레거시 배치의 그리드 백필 ──

export interface GridSpans {
  cellW: number;
  spans: Record<string, [number, number]>;
}

/** 저장된 좌표에서 그리드 스팬을 역산 (v8.2). v9.0에서는 **레거시 배치의 1회 백필 전용**이다 —
 *  새 배치는 grid를 직접 들고 다니므로 역산이 실패해 자동 정렬이 죽는 일이 없다.
 *  기준 셀 폭 = 사진 최소 폭. 환산 오차가 셀의 35%를 넘으면 자유 배치로 보고 null */
export function inferGridSpans(
  items: Record<string, CollageLayoutItem>,
  aspect: number
): GridSpans | null {
  const photos = Object.entries(items).filter(([k]) => !isStickerKey(k));
  if (photos.length < 2) return null;
  const gx = 0.015; // 역산용 근사 — 템플릿별 갭 차이는 허용오차 안
  const gy = gx * aspect;
  const cellW = Math.min(...photos.map(([, it]) => it.w));
  if (!(cellW > 0)) return null;
  const cellH = cellW * aspect;
  const spans: Record<string, [number, number]> = {};
  for (const [k, it] of photos) {
    const h = it.h ?? it.w * aspect;
    const sc = Math.round((it.w + gx) / (cellW + gx));
    const sr = Math.round((h + gy) / (cellH + gy));
    if (sc < 1 || sc > SPAN_CAP || sr < 1 || sr > SPAN_CAP) return null;
    if (Math.abs(it.w - (sc * cellW + (sc - 1) * gx)) > cellW * 0.35) return null;
    if (Math.abs(h - (sr * cellH + (sr - 1) * gy)) > cellH * 0.35) return null;
    spans[k] = [sc, sr];
  }
  return { cellW, spans };
}

// ── 새 항목 배치 (자유 배치 경로 전용) ──

/** 새 항목을 기존 배치의 빈 공간에 놓는다 (v8.0) — 코스 그리드 후보를 훑어 겹침이 최소인 자리.
 *  결정적(무작위 없음). v9.0에서는 자유 배치(freeform) 보드와 고아 스티커 폴백에만 쓰인다 */
export function placeNewItems(
  newKeys: string[],
  existing: Record<string, CollageLayoutItem>,
  template: CollageTemplate,
  aspect: number = ASPECT
): Record<string, CollageLayoutItem> {
  const placed: Record<string, CollageLayoutItem> = {};
  if (newKeys.length === 0) return placed;

  const topReserve = spacingFor(template, aspect).titleBottom;
  const itemRect = (key: string, it: CollageLayoutItem): Rect => ({
    x: it.x,
    y: it.y,
    w: it.w,
    // 스티커는 텍스트라 실높이가 낮다 — 정사각 가정이면 팬텀 블록이 빈 공간 탐색을 방해한다
    h: it.h ?? (isStickerKey(key) ? it.w * 0.35 : it.w * aspect),
  });

  const photoWs = Object.entries(existing)
    .filter(([k]) => !isStickerKey(k))
    .map(([, it]) => it.w)
    .sort((a, b) => a - b);
  const defaultW = photoWs.length
    ? photoWs[Math.floor(photoWs.length / 2)]
    : isLandscape(aspect) ? 0.16 : 0.26;

  const rects: Rect[] = Object.entries(existing).map(([k, it]) => itemRect(k, it));
  let maxZ = Math.max(0, ...Object.values(existing).map((it) => it.z));

  for (const key of newKeys) {
    const isSticker = isStickerKey(key);
    const w = isSticker ? Math.max(STICKER_MIN_W, defaultW) : defaultW;
    const h = isSticker ? w * 0.35 : w * aspect;
    const STEPS = 18;
    let best = { x: 0.02, y: topReserve, score: Infinity };
    for (let yi = 0; yi <= STEPS && best.score > 0; yi++) {
      const y = topReserve + (yi / STEPS) * Math.max(0, 0.98 - h - topReserve);
      for (let xi = 0; xi <= STEPS; xi++) {
        const x = 0.02 + (xi / STEPS) * Math.max(0, 0.96 - w);
        const cand = { x, y, w, h };
        let score = 0;
        for (const r of rects) score = Math.max(score, overlapArea(cand, r) / (w * h));
        if (score < best.score) best = { x, y, score };
        if (best.score === 0) break; // 완전 빈 자리 발견 — 조기 종료
      }
    }
    const it: CollageLayoutItem = { x: best.x, y: best.y, w, z: ++maxZ };
    placed[key] = it;
    rects.push(itemRect(key, it));
  }
  return placed;
}

// ── reconcile ──

/** 저장된 배치에 grid가 없으면(레거시) 1회 백필한다. 백필 불가면 freeform으로 표시 —
 *  현행(v8.x)과 같은 동작이므로 기존 사용자가 갑자기 배치를 잃지 않는다 */
export function ensureGrid(
  layout: CollageLayout,
  template: CollageTemplate,
  aspect: number
): CollageLayout {
  if (layout.grid || layout.freeform) return layout;
  const info = inferGridSpans(layout.items, aspect);
  if (!info) return { ...layout, freeform: true };
  const order = Object.entries(layout.items)
    .filter(([k]) => !isStickerKey(k))
    .sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
    .map(([k]) => k);
  const cols = Math.max(
    2,
    ...order.map((k) => info.spans[k]?.[0] ?? 1)
  );
  // 역산한 스팬을 그대로 재현하려 하기보다, 같은 장수·같은 템플릿의 표준 그리드로 수렴시킨다.
  // 레거시 좌표는 갭·여백 체계가 달라(v8.7 이전) 그대로 살려도 새 토큰과 어긋난 화면이 된다.
  const grid = chooseGrid(template, order.map((key) => ({ key, src: '' })), aspect);
  if (!grid) return { ...layout, freeform: true };
  void cols;
  return applyGrid({ ...layout, grid }, template, aspect);
}

// 저장된 배치 + 현재 사진 구성 동기화 (v8.0 identity reconcile → v9.0 그리드 기반)
// - 저장 당시 비율(saved.aspect)과 다르면 시드로 새로 시작 (v6.19)
// - '기본 배치로'만 하고 손대지 않은 배치(edited === false)는 항상 신선한 시드
// - 자유 배치(freeform)는 기존 좌표를 보존하고 새 키만 빈 공간에 배치 (v8.x 동작 그대로)
// - 그리드 배치는 키 증감을 그리드에 반영하고 좌표를 다시 만든다.
//   ⚠️ 계약 변경: 사진을 추가하면 기존 사진 좌표가 **움직인다**. v8.x의 "기존 rect 불변"과
//   정면 충돌하지만 "항상 빈틈 없이"의 필연적 귀결이다. 보존되는 것은 좌표가 아니라 상대 순서다.
export function resolveLayout(
  template: CollageTemplate,
  items: CollageItem[],
  saved: CollageLayout | undefined,
  aspect: number = ASPECT
): CollageLayout {
  if (!saved) return seedLayout(template, items, aspect);
  if (saved.aspect !== undefined && !aspectsEqual(saved.aspect, aspect)) {
    return seedLayout(template, items, aspect);
  }
  if (saved.edited === false) return seedLayout(template, items, aspect);

  const photos = items.filter((i) => !isStickerKey(i.key));
  const base = ensureGrid(saved, template, aspect);

  if (!base.freeform && base.grid) {
    const want = photos.map((p) => p.key);
    const have = gridKeys(base.grid).filter((k) => !isStickerKey(k));
    const removed = have.filter((k) => !want.includes(k));
    const added = want.filter((k) => !have.includes(k));
    const uniform = template === 'matte';

    let grid: GridSpec | null = base.grid;
    if (removed.length) grid = grid && removeKeys(grid, removed, uniform);
    if (added.length) grid = grid && insertKeys(grid, added, uniform);
    // 그리드 재구성이 불가능해지면(스팬 캡 초과 등) 그 장수의 표준 시드로 수렴
    if (!grid) grid = chooseGrid(template, photos, aspect);
    if (!grid) return seedLayout(template, items, aspect);

    const next = applyGrid({ ...base, grid }, template, aspect);
    return withStickers(next, saved, template, aspect);
  }

  // 자유 배치 — 기존 좌표 보존 + 새 키만 빈 공간에
  const result: Record<string, CollageLayoutItem> = {};
  const newKeys: string[] = [];
  for (const p of photos) {
    if (saved.items[p.key]) result[p.key] = saved.items[p.key];
    else newKeys.push(p.key);
  }
  const stickers: Record<string, CollageSticker> = { ...saved.stickers };
  for (const id of Object.keys(stickers)) {
    const key = stickerKey(id);
    if (saved.items[key]) result[key] = saved.items[key];
    else newKeys.push(key); // 고아 스티커
  }
  Object.assign(result, placeNewItems(newKeys, result, template, aspect));
  return { items: result, stickers, aspect, edited: true, freeform: true };
}

/** 그리드 경로에서 스티커를 다시 얹는다 — 스티커는 그리드 밖 자유 배치 오버레이다 */
function withStickers(
  layout: CollageLayout,
  saved: CollageLayout,
  template: CollageTemplate,
  aspect: number
): CollageLayout {
  const stickers: Record<string, CollageSticker> = { ...saved.stickers };
  const items = { ...layout.items };
  const orphans: string[] = [];
  for (const id of Object.keys(stickers)) {
    const key = stickerKey(id);
    if (saved.items[key]) items[key] = saved.items[key];
    else orphans.push(key);
  }
  Object.assign(items, placeNewItems(orphans, items, template, aspect));
  return { ...layout, items, stickers, aspect, edited: true };
}

// 새 스티커의 기본 배치 — 중앙 아래, 최상단.
// 가로형(PC) 보드에서는 폭 비례 글자가 과대해지지 않게 줄인다
export function newStickerLayoutItem(maxZ: number, aspect: number = ASPECT): CollageLayoutItem {
  const w = isLandscape(aspect) ? 0.26 : 0.44;
  return { x: (1 - w) / 2, y: 0.62, w, z: maxZ + 1, rot: -2 };
}

export type { Band, GridSpec };
