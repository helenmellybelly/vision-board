// 콜라주 템플릿 — 테마 + 시드 배치 + 스티커 킷 + 배치 reconcile (v10 재설계).
//
// 층 구조:  collageJustify(순수 기하) → collageSolve(정책) → **여기**(보드 데이터) → 렌더러 2종
//
// ⚠️ 템플릿은 배치 알고리즘이 아니라 완성된 구성안이다. 네 축이 함께 갈려야 한눈에 다르다:
//    ① 배치 구조  ② 타이틀 카드 위치·스타일  ③ 기본 스티커 킷  ④ 갭
//    여백 수치로만 구분하면 (a) 사진이 작아지거나 (b) 차이를 못 느낀다 — v9의 모자이크↔미니멀이
//    갭 0.025 vs 0.03 차이뿐이라 사실상 같은 템플릿이었던 게 그 증거다.
import {
  CollageLayout,
  CollageLayoutItem,
  CollageSticker,
  CollageTemplate,
  JustifiedSpec,
  StickerStyle,
} from './types';
import {
  BG_PALETTE,
  TEMPLATE_DEFAULT_BG,
  TEMPLATE_TITLE_DEFAULT,
  TitleAnchor,
  TitleStyle,
  isLandscape,
  normalizeBgColor,
  normalizeTitle,
  regionFor,
  titleInkFor,
} from './collageTokens';
import { SolveItem, layoutSpec, solveTemplate } from './collageSolve';
import {
  bumpRowInSpec,
  insertKeys,
  removeKeys,
  swapInSpec,
  assertPartition,
} from './collageJustify';
import { IconId } from './stickerArt';

export interface CollageItem {
  key: string; // `${sectionId}-${slotIdx}` — 사진 교체·삭제에도 안정적
  src: string;
  /** 사진 실측 가로세로비(w/h). 아직 못 쟀으면 undefined → 1로 간주해 결정성을 지킨다.
   *  v9는 첫 1장만 알았고 그것도 히어로 on/off에만 썼다 — 그래서 세로 사진이 잘렸다 */
  ratio?: number;
}

// 4:5 보드 — 레거시 기본 비율. /collage는 폰·PC 2탭이라 실제로는 프리셋 비율이 쓰인다
export const ASPECT = 4 / 5;

// 비율 판정은 collageTokens가 단일 소스 — 기존 호출부 호환을 위해 재export
export { hasTopReserve, isLandscape } from './collageTokens';
/** 비율 차이 ~2% 이내면 같은 배치를 그대로 쓴다 (예: 기본 폰 9:19.5 ↔ iPhone 9:19.5) */
export const aspectsEqual = (a: number, b: number) => Math.abs(a - b) / b <= 0.02;

export const MIN_W = 0.12;
export const MAX_W = 0.7;
export const STICKER_MIN_W = 0.18;

// ── 테마 ──

export interface CollageTheme {
  bg: string;
  /** v10 — 매트(흰 액자) 폐기. 전 템플릿이 사진만 라운드로 그린다.
   *  액자가 필요했던 이유(세로 사진 무크롭)가 저스티파이드 엔진으로 사라졌다 */
  frame: 'rounded';
  /** 어두운 배경인가 — 타이틀 글자색·사진 경계 처리 분기 */
  dark: boolean;
  /** 연도 글자색 */
  titleInk: string;
  /** "VISION BOARD" 라벨 글자색 */
  labelInk: string;
  /** 타이틀 카드 배경 — 사진 위에 얹히므로 반드시 불투명 계열이어야 글자가 읽힌다.
   *  ⚠️ backdrop-filter 금지 — canvas로 재현할 수 없어 화면과 저장 이미지가 갈라진다 */
  cardBg: string;
  /** 카드 테두리 (흰 배경에서 카드가 사라지지 않게) */
  cardBorder: string;
}

/** 템플릿 + 사용자가 고른 배경색 → 렌더 테마. DOM·canvas가 이 함수 하나만 호출해 락스텝을 지킨다 */
export function themeFor(template: CollageTemplate, bgColor?: string): CollageTheme {
  const bg = normalizeBgColor(bgColor, template);
  const ink = titleInkFor(bg);
  return {
    bg,
    frame: 'rounded',
    dark: ink.dark,
    titleInk: ink.title,
    labelInk: ink.label,
    // 거의 불투명 — 92%로 두면 카드 뒤 사진 사이 이음매가 비쳐 렌더 결함처럼 보인다(실측)
    cardBg: ink.dark ? 'rgba(20,19,18,0.94)' : 'rgba(255,255,255,0.96)',
    cardBorder: ink.dark ? 'rgba(255,255,255,0.14)' : 'rgba(28,27,25,0.10)',
  };
}

export { BG_PALETTE, TEMPLATE_DEFAULT_BG, normalizeBgColor };

export const DEFAULT_TEMPLATE: CollageTemplate = 'editorial';
export const TEMPLATE_ORDER: CollageTemplate[] = ['editorial', 'magazine', 'studio'];

/** 구 id(mosaic/minimal/matte/polaroid)·손상 데이터를 안전하게 접는다.
 *  ⚠️ 마이그레이션은 이 폴백에 기대면 안 된다 — 셋이 전부 editorial로 뭉개져
 *  "무엇이 무엇으로 바뀌었다"는 안내가 거짓말이 된다. storage.ts의 명시 매핑을 쓸 것 */
export function normalizeTemplate(t: string | undefined): CollageTemplate {
  return TEMPLATE_ORDER.includes(t as CollageTemplate) ? (t as CollageTemplate) : DEFAULT_TEMPLATE;
}

/** 타이틀 앵커·스타일 — 저장값이 없으면 템플릿 기본값 */
export function titleFor(
  template: CollageTemplate,
  saved: { anchor?: string; style?: string } | undefined,
): { anchor: TitleAnchor; style: TitleStyle } {
  return normalizeTitle(saved, template);
}

// ── 스티커 ──

// 글자 크기 = 항목 폭(it.w) × 보드 폭(px) × 비율 — DOM(cqi)과 canvas가 같은 식을 쓴다
export const STICKER_FONT_RATIO: Record<StickerStyle, number> = {
  script: 0.17,
  chip: 0.11,
  outline: 0.15,
};

// 프리셋 문구 — 샘플 무드보드의 어퍼메이션 레퍼런스 (v7.6 다양화)
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

/**
 * 템플릿 기본 스티커 킷 (v10).
 *
 * 왜 미리 얹나: 스티커 기능이 있다는 걸 아무도 모른다. 보드에 이미 하나 얹혀 있으면
 * "아, 이걸 옮기고 고칠 수 있구나"가 즉시 전달된다 — 발견성이 목적이지 장식이 목적이 아니다.
 * 그래서 지우면 다시 안 나온다(kitRemoved). '기본 배치로'를 눌러야 되살아난다.
 *
 * 좌표는 타이틀 기본 앵커와 겹치지 않게 잡았다(에디토리얼 mc / 매거진 tl / 스튜디오 tc).
 */
interface KitEntry {
  id: string;
  sticker: Omit<CollageSticker, 'id'>;
  at: { x: number; y: number; w: number; rot?: number };
}

/** 킷 장식의 잉크 — 순검정은 사진을 이긴다. 장식은 사진보다 조용해야 한다 */
const KIT_INK = '#4A463F';

// ⚠️ y 좌표는 스티커 **높이**를 감안해야 한다. 텍스트 스티커는 아래로 자라므로(폭의 0.3~0.5배)
//    0.85 아래에 두면 보드 밖으로 잘린다(실측: 'MAKE IT HAPPEN'이 'MAKE IT'만 보였다).
export const TEMPLATE_KIT: Record<CollageTemplate, KitEntry[]> = {
  editorial: [
    { id: 'kit:ed:1', sticker: { kind: 'icon', icon: 'sparkle' as IconId, text: '', style: 'chip', color: KIT_INK }, at: { x: 0.83, y: 0.08, w: 0.05 } },
    { id: 'kit:ed:2', sticker: { kind: 'text', text: 'all is well', style: 'script' }, at: { x: 0.07, y: 0.79, w: 0.26, rot: -3 } },
  ],
  magazine: [
    { id: 'kit:mg:1', sticker: { kind: 'icon', icon: 'arrow' as IconId, text: '', style: 'chip', color: KIT_INK }, at: { x: 0.7, y: 0.83, w: 0.16 } },
    { id: 'kit:mg:2', sticker: { kind: 'text', text: '잘 될 거야', style: 'chip' }, at: { x: 0.08, y: 0.78, w: 0.26, rot: -2 } },
  ],
  studio: [
    { id: 'kit:st:1', sticker: { kind: 'icon', icon: 'corner' as IconId, text: '', style: 'chip', color: KIT_INK }, at: { x: 0.05, y: 0.86, w: 0.06, rot: 180 } },
    { id: 'kit:st:2', sticker: { kind: 'text', text: 'MAKE IT HAPPEN', style: 'outline' }, at: { x: 0.31, y: 0.7, w: 0.38 } },
  ],
};

// ── 배치 ──

interface Rect { x: number; y: number; w: number; h: number }
const overlapArea = (a: Rect, b: Rect) => {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
};

/** 저장된 배치가 "사진이 서로를 가리는" 수준으로 망가졌는지 (v8.4).
 *  v10에서는 spec 배치가 원천적으로 무겹침이라 자유 배치(freeform)에만 의미가 있다 */
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

const solveItems = (items: CollageItem[]): SolveItem[] =>
  items.filter((i) => !isStickerKey(i.key)).map((i) => ({ key: i.key, ratio: i.ratio }));

const ratioMapOf = (items: CollageItem[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const i of items) if (i.ratio) m[i.key] = i.ratio;
  return m;
};

/** spec으로부터 items(사진 좌표)를 다시 만든다. spec ↔ items 일관성이 이 함수 하나로 보장된다 */
export function applySpec(
  layout: CollageLayout,
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number
): CollageLayout {
  if (!layout.spec) return layout;
  const rects = layoutSpec(layout.spec, template, ratioMapOf(items), aspect);
  const zBefore = layout.items;
  const photos: Record<string, CollageLayoutItem> = {};
  layout.spec.order.forEach((key, i) => {
    const r = rects[key];
    if (!r) return;
    photos[key] = { x: r.x, y: r.y, w: r.w, h: r.h, z: zBefore[key]?.z ?? i + 1 };
  });
  const stickerItems: Record<string, CollageLayoutItem> = {};
  for (const [k, v] of Object.entries(layout.items)) if (isStickerKey(k)) stickerItems[k] = v;
  return { ...layout, items: { ...photos, ...stickerItems } };
}

/** 킷 스티커를 얹는다 — 이미 있거나 사용자가 지운 것(kitRemoved)은 건너뛴다 */
function withKit(
  layout: CollageLayout,
  template: CollageTemplate,
  removed: string[] | undefined
): CollageLayout {
  const skip = new Set(removed ?? []);
  const stickers: Record<string, CollageSticker> = { ...layout.stickers };
  const items = { ...layout.items };
  let z = Math.max(0, ...Object.values(items).map((it) => it.z));
  for (const entry of TEMPLATE_KIT[template]) {
    if (skip.has(entry.id) || stickers[entry.id]) continue;
    stickers[entry.id] = { id: entry.id, ...entry.sticker };
    items[stickerKey(entry.id)] = {
      x: entry.at.x,
      y: entry.at.y,
      w: entry.at.w,
      z: ++z,
      rot: entry.at.rot,
    };
  }
  return { ...layout, items, stickers };
}

export function seedLayout(
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number = ASPECT,
  opts?: { kitRemoved?: string[] }
): CollageLayout {
  const solve = solveItems(items);
  const res = solveTemplate(template, solve, aspect);
  const photos: Record<string, CollageLayoutItem> = {};
  res.spec.order.forEach((key, i) => {
    const r = res.rects[key];
    if (r) photos[key] = { x: r.x, y: r.y, w: r.w, h: r.h, z: i + 1 };
  });
  const base: CollageLayout = {
    items: photos,
    aspect,
    edited: false,
    specTouched: false,
    spec: res.spec,
    kitRemoved: opts?.kitRemoved,
  };
  return withKit(base, template, opts?.kitRemoved);
}

// ── 편집 연산 (렌더러가 쓰는 얇은 래퍼 — 전부 실패하지 않는다) ──

export function swapPhotos(
  layout: CollageLayout,
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number,
  a: string,
  b: string
): CollageLayout {
  if (!layout.spec) return layout;
  const spec = swapInSpec(layout.spec, a, b);
  return applySpec({ ...layout, spec, edited: true, specTouched: true }, template, items, aspect);
}

export function bumpPhoto(
  layout: CollageLayout,
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number,
  key: string,
  dir: 'up' | 'down'
): CollageLayout {
  if (!layout.spec) return layout;
  const spec = bumpRowInSpec(layout.spec, key, dir);
  if (spec === layout.spec) return layout;
  return applySpec({ ...layout, spec, edited: true, specTouched: true }, template, items, aspect);
}

// ── 새 항목 배치 (자유 배치·고아 스티커 전용) ──

/** 새 항목을 기존 배치의 빈 공간에 놓는다 (v8.0) — 코스 그리드 후보를 훑어 겹침이 최소인 자리.
 *  결정적(무작위 없음) */
export function placeNewItems(
  newKeys: string[],
  existing: Record<string, CollageLayoutItem>,
  template: CollageTemplate,
  aspect: number = ASPECT
): Record<string, CollageLayoutItem> {
  const placed: Record<string, CollageLayoutItem> = {};
  if (newKeys.length === 0) return placed;

  const region = regionFor(template, aspect);
  const topReserve = region.y;
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
//
// - 저장 당시 비율(saved.aspect)과 다르면 시드로 새로 시작 (v6.19)
// - '기본 배치로'만 하고 손대지 않은 배치(edited === false)는 항상 신선한 시드
// - **배치를 손대지 않았으면(specTouched !== true) 시드로 갱신한다** (v10) — 사진 치수를
//   나중에 알게 되는 구조라, 배치를 건드리지 않은 사용자는 측정이 끝나는 순간 더 나은
//   배치를 받아야 한다. 스티커·연도만 만진 사용자(edited: true)도 여기 해당한다
// - 자유 배치(freeform)는 기존 좌표를 보존하고 새 키만 빈 공간에 배치
// - spec 배치는 키 증감을 spec에 반영하고 좌표를 다시 만든다.
//   ⚠️ 사진을 추가하면 기존 사진 좌표가 **움직인다**. 보존되는 것은 좌표가 아니라 상대 순서다
export function resolveLayout(
  template: CollageTemplate,
  items: CollageItem[],
  saved: CollageLayout | undefined,
  aspect: number = ASPECT
): CollageLayout {
  if (!saved) return seedLayout(template, items, aspect);
  if (saved.aspect !== undefined && !aspectsEqual(saved.aspect, aspect)) {
    return seedLayout(template, items, aspect, { kitRemoved: saved.kitRemoved });
  }
  if (saved.edited === false) return seedLayout(template, items, aspect, { kitRemoved: saved.kitRemoved });

  const photos = items.filter((i) => !isStickerKey(i.key));

  if (!saved.freeform) {
    // 배치를 직접 손대지 않았으면 언제나 최신 시드 — 치수 백필이 끝나면 여기서 좋아진다
    if (!saved.specTouched || !saved.spec || !assertPartition(saved.spec)) {
      const fresh = seedLayout(template, items, aspect, { kitRemoved: saved.kitRemoved });
      return withStickers(fresh, saved, template, aspect);
    }
    const want = photos.map((p) => p.key);
    const have = saved.spec.order;
    const removed = have.filter((k) => !want.includes(k));
    const added = want.filter((k) => !have.includes(k));
    let spec: JustifiedSpec = saved.spec;
    if (removed.length) spec = removeKeys(spec, removed);
    if (added.length) spec = insertKeys(spec, added, 6);
    if (!assertPartition(spec) || spec.order.length !== want.length) {
      const fresh = seedLayout(template, items, aspect, { kitRemoved: saved.kitRemoved });
      return withStickers(fresh, saved, template, aspect);
    }
    const next = applySpec({ ...saved, spec }, template, items, aspect);
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
  return {
    ...saved,
    items: result,
    stickers,
    aspect,
    edited: true,
    freeform: true,
  };
}

/** spec 경로에서 스티커를 다시 얹는다 — 스티커는 배치 밖 자유 오버레이다 */
function withStickers(
  layout: CollageLayout,
  saved: CollageLayout,
  template: CollageTemplate,
  aspect: number
): CollageLayout {
  const stickers: Record<string, CollageSticker> = { ...layout.stickers, ...saved.stickers };
  const items = { ...layout.items };
  const orphans: string[] = [];
  for (const id of Object.keys(stickers)) {
    const key = stickerKey(id);
    if (saved.items[key]) items[key] = saved.items[key];
    else if (!items[key]) orphans.push(key);
  }
  Object.assign(items, placeNewItems(orphans, items, template, aspect));
  return {
    ...layout,
    items,
    stickers,
    aspect,
    edited: true,
    title: saved.title ?? layout.title,
    kitRemoved: saved.kitRemoved ?? layout.kitRemoved,
  };
}

// 새 스티커의 기본 배치 — 중앙 아래, 최상단.
// 가로형(PC) 보드에서는 폭 비례 글자가 과대해지지 않게 줄인다
export function newStickerLayoutItem(maxZ: number, aspect: number = ASPECT): CollageLayoutItem {
  const w = isLandscape(aspect) ? 0.26 : 0.44;
  return { x: (1 - w) / 2, y: 0.62, w, z: maxZ + 1, rot: -2 };
}

export { TEMPLATE_TITLE_DEFAULT };
export type { JustifiedSpec };
