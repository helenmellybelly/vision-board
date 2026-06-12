// 콜라주 템플릿 정의 — 테마 토큰 + 초기 배치 생성기 + 배치 reconcile.
// CollageBoard(DOM)와 lib/wallpaper.ts(canvas)가 같은 수치를 공유해 화면과 저장 이미지가 일치한다.
import {
  CollageLayout,
  CollageLayoutItem,
  CollageSticker,
  CollageTemplate,
  StickerStyle,
} from './types';

export interface CollageItem {
  key: string; // `${sectionId}-${slotIdx}` — 사진 교체·삭제에도 안정적
  src: string;
}

// 4:5 보드 — 정규화 y는 (픽셀 y / 보드 높이)라서, 정사각 사진의 정규화 높이 = w × ASPECT
export const ASPECT = 4 / 5;
export const MIN_W = 0.12;
export const MAX_W = 0.7;
export const STICKER_MIN_W = 0.18;

export interface CollageTheme {
  bg: string;
  /** 사진 프레임 — polaroid = 흰 테두리+턱, rounded = 라운드 모서리 */
  frame: 'polaroid' | 'rounded';
  /** 타이틀 위치 — center = 중앙 연도 카드(사진 위), top = 상단 밴드 */
  titlePos: 'center' | 'top';
  dark: boolean;
}

export const COLLAGE_THEMES: Record<CollageTemplate, CollageTheme> = {
  polaroid: { bg: '#2D2B29', frame: 'polaroid', titlePos: 'center', dark: true },
  mosaic: { bg: '#FAF9F7', frame: 'rounded', titlePos: 'top', dark: false },
  minimal: { bg: '#FFFFFF', frame: 'rounded', titlePos: 'top', dark: false },
};

// 스티커 글자 크기 = 항목 폭(it.w) × 보드 폭(px) × 비율 — DOM(cqi)과 canvas가 같은 식을 쓴다
export const STICKER_FONT_RATIO: Record<StickerStyle, number> = {
  script: 0.17,
  chip: 0.11,
  outline: 0.15,
};

// 스티커 시트 프리셋 문구 — 샘플 무드보드의 어퍼메이션 레퍼런스
export const STICKER_PRESETS: { text: string; style: StickerStyle }[] = [
  { text: '잘 될 거야', style: 'chip' },
  { text: '될 일은 된다', style: 'chip' },
  { text: '그러니까 감사', style: 'chip' },
  { text: '일단 시작', style: 'chip' },
  { text: "It's my year", style: 'script' },
  { text: 'lucky me', style: 'script' },
  { text: 'YOU CAN AND YOU WILL', style: 'outline' },
  { text: 'DO IT NOW', style: 'outline' },
];

export const stickerKey = (id: string) => `sticker:${id}`;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── 폴라로이드: 중앙 연도 카드를 비워두고 가장자리에 빽빽하게 산포 ──

const POLAROID_SLOTS: [number, number][] = [
  [0.05, 0.03], [0.63, 0.04], [0.34, 0.08], [0.06, 0.60], [0.62, 0.61], [0.33, 0.66],
  [0.01, 0.21], [0.69, 0.22], [0.05, 0.78], [0.64, 0.79], [0.35, 0.82], [0.01, 0.40],
  [0.70, 0.41], [0.20, 0.18], [0.48, 0.20], [0.20, 0.62], [0.48, 0.63], [0.34, 0.24],
];
const POLAROID_WIDTHS = [0.30, 0.27, 0.32, 0.26, 0.29, 0.31];
const POLAROID_ROTS = [-7, 5, -4, 8, -6, 4, 7, -5];

function seedPolaroid(items: CollageItem[]): CollageLayout {
  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const [x, y] = POLAROID_SLOTS[i % POLAROID_SLOTS.length];
    const w = POLAROID_WIDTHS[i % POLAROID_WIDTHS.length];
    result[item.key] = {
      x: clamp(x, 0, 1 - w),
      y: clamp(y, 0, 1 - w * ASPECT),
      w,
      z: i + 1,
      rot: POLAROID_ROTS[i % POLAROID_ROTS.length],
    };
  });
  const layout: CollageLayout = { items: result };
  // 스크랩북 무드 기본 스티커 — 사용자가 옮기거나 지울 수 있다
  layout.stickers = {
    'seed-script': { id: 'seed-script', text: "It's my year", style: 'script' },
    'seed-chip': { id: 'seed-chip', text: '잘 될 거야', style: 'chip' },
  };
  result[stickerKey('seed-script')] = { x: 0.28, y: 0.585, w: 0.44, z: items.length + 1, rot: -3 };
  result[stickerKey('seed-chip')] = { x: 0.05, y: 0.46, w: 0.26, z: items.length + 2, rot: -5 };
  return layout;
}

// ── 모자이크: 매거진 스팬 그리드 — 크기가 섞인 결정적 패턴(첫 셀은 2×2 히어로) ──

const MOSAIC_SPANS: [number, number][] = [
  [2, 2], [1, 1], [1, 1], [1, 1], [1, 1], [2, 1], [1, 1], [1, 2],
];

function seedMosaic(items: CollageItem[]): CollageLayout {
  const n = items.length;
  const cols = n <= 8 ? 4 : n <= 13 ? 5 : 6;
  const gx = 0.015;
  const gy = gx * ASPECT;
  const margin = 0.03;
  const titleBottom = 0.15; // 상단 타이틀 밴드(라벨+연도) 아래부터 그리드 — 연도와 겹치지 않게
  const availH = 0.97 - titleBottom;

  // 점유 그리드에 first-fit 패킹
  const grid: boolean[][] = [];
  const ensureRow = (r: number) => {
    while (grid.length <= r) grid.push(new Array(cols).fill(false));
  };
  const fits = (r: number, c: number, sc: number, sr: number) => {
    if (c + sc > cols) return false;
    for (let rr = r; rr < r + sr; rr++) {
      ensureRow(rr);
      for (let cc = c; cc < c + sc; cc++) if (grid[rr][cc]) return false;
    }
    return true;
  };
  const cells: { c: number; r: number; sc: number; sr: number }[] = [];
  items.forEach((_, i) => {
    let [sc, sr] = MOSAIC_SPANS[i % MOSAIC_SPANS.length];
    // 빈틈 우선 탐색
    let placed = false;
    for (let r = 0; !placed; r++) {
      ensureRow(r);
      for (let c = 0; c <= cols - 1; c++) {
        if (fits(r, c, sc, sr)) {
          for (let rr = r; rr < r + sr; rr++) for (let cc = c; cc < c + sc; cc++) grid[rr][cc] = true;
          cells.push({ c, r, sc, sr });
          placed = true;
          break;
        }
      }
      if (r > 40) { sc = 1; sr = 1; } // 안전장치
    }
  });
  const usedRows = grid.reduce((m, row, r) => (row.some(Boolean) ? r + 1 : m), 1);

  // 폭 기준 셀 크기 → 세로가 넘치면 축소 후 가운데 정렬
  let cellW = (1 - margin * 2 - (cols - 1) * gx) / cols;
  let cellH = cellW * ASPECT;
  const neededH = usedRows * cellH + (usedRows - 1) * gy;
  if (neededH > availH) {
    const k = availH / neededH;
    cellW *= k;
    cellH *= k;
  }
  const gridW = cols * cellW + (cols - 1) * gx;
  const left = (1 - gridW) / 2;

  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const { c, r, sc, sr } = cells[i];
    result[item.key] = {
      x: left + c * (cellW + gx),
      y: titleBottom + r * (cellH + gy),
      w: sc * cellW + (sc - 1) * gx,
      h: sr * cellH + (sr - 1) * gy,
      z: i + 1,
    };
  });
  return { items: result };
}

// ── 미니멀: 상단 타이틀 + 균일 정사각 그리드, 마지막 줄 가운데 정렬 ──

function seedMinimal(items: CollageItem[]): CollageLayout {
  const n = items.length;
  const cols = n <= 6 ? 3 : n <= 12 ? 4 : 5;
  const g = 0.02;
  const margin = 0.05;
  const titleBottom = 0.17;
  const availH = 0.95 - titleBottom;

  let w = (1 - margin * 2 - (cols - 1) * g) / cols;
  const rows = Math.ceil(n / cols);
  let hNorm = w * ASPECT;
  const gy = g * ASPECT;
  const neededH = rows * hNorm + (rows - 1) * gy;
  if (neededH > availH) {
    const k = availH / neededH;
    w *= k;
    hNorm *= k;
  }
  const gridW = cols * w + (cols - 1) * g;
  const left = (1 - gridW) / 2;

  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowOffset = ((cols - inRow) * (w + g)) / 2; // 마지막 줄 가운데 정렬
    result[item.key] = {
      x: left + rowOffset + c * (w + g),
      y: titleBottom + r * (hNorm + gy),
      w,
      z: i + 1,
    };
  });
  return { items: result };
}

export function seedLayout(template: CollageTemplate, items: CollageItem[]): CollageLayout {
  if (template === 'polaroid') return seedPolaroid(items);
  if (template === 'mosaic') return seedMosaic(items);
  return seedMinimal(items);
}

// 저장된 배치 + 현재 사진 구성 동기화 — 새 사진은 시드 위치로, 사라진 키는 정리.
// 스티커는 정의(stickers)와 배치 항목이 함께 유지된다.
export function resolveLayout(
  template: CollageTemplate,
  items: CollageItem[],
  saved: CollageLayout | undefined
): CollageLayout {
  const seed = seedLayout(template, items);
  if (!saved) return seed;

  const result: Record<string, CollageLayoutItem> = {};
  for (const item of items) {
    result[item.key] = saved.items[item.key] ?? seed.items[item.key];
  }
  const stickers: Record<string, CollageSticker> = { ...saved.stickers };
  for (const id of Object.keys(stickers)) {
    const key = stickerKey(id);
    result[key] = saved.items[key] ?? { x: 0.3, y: 0.42, w: 0.4, z: 999 };
  }
  return { items: result, stickers };
}

// 새 스티커의 기본 배치 — 중앙 연도 카드(폴라로이드)에 가리지 않게 중앙 아래, 최상단
export function newStickerLayoutItem(maxZ: number): CollageLayoutItem {
  return { x: 0.28, y: 0.62, w: 0.44, z: maxZ + 1, rot: -2 };
}
