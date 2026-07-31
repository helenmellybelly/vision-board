// 콜라주 템플릿 정의 — 테마 토큰 + 초기 배치 생성기 + 배치 reconcile.
// CollageBoard(DOM)와 lib/wallpaper.ts(canvas)가 같은 수치를 공유해 화면과 저장 이미지가 일치한다.
import {
  CollageLayout,
  CollageLayoutItem,
  CollageSticker,
  CollageTemplate,
  StickerStyle,
} from './types';
import { FOREST } from './colors';

export interface CollageItem {
  key: string; // `${sectionId}-${slotIdx}` — 사진 교체·삭제에도 안정적
  src: string;
}

// 4:5 보드 — 정규화 y는 (픽셀 y / 보드 높이)라서, 정사각 사진의 정규화 높이 = w × ASPECT
export const ASPECT = 4 / 5;

// 비율(w/h) 기반 분기 — 기기 사이즈가 프리셋마다 달라 타깃 enum 대신 비율로 판단 (v6.19)
// 세로로 긴 화면(폰·태블릿)은 상단 ~15%를 시계·위젯 영역으로 비운다
export const hasTopReserve = (aspect: number) => aspect < 0.75;
export const isLandscape = (aspect: number) => aspect > 1;
// 비율 차이 ~2% 이내면 같은 배치를 그대로 쓴다 (예: 기본 폰 9:19.5 ↔ iPhone 9:19.5)
export const aspectsEqual = (a: number, b: number) => Math.abs(a - b) / b <= 0.02;

export const MIN_W = 0.12;
export const MAX_W = 0.7;
export const STICKER_MIN_W = 0.18;

export interface CollageTheme {
  bg: string;
  /** 세로 그라디언트 [상단, 하단] — 있으면 bg 대신 그라디언트로 칠한다 (DOM·canvas 동일 적용) */
  bgGradient?: [string, string];
  /** 사진 프레임 — v7.6: 흰 폴라로이드 프레임 제거, 전 템플릿 rounded(사진만 + 라운드·그림자) */
  frame: 'rounded';
  /** 타이틀 위치 — center = 중앙 연도 카드(사진 위), top = 상단 밴드 */
  titlePos: 'center' | 'top';
  dark: boolean;
}

export const COLLAGE_THEMES: Record<CollageTemplate, CollageTheme> = {
  // 구 '폴라로이드' 템플릿 → '숲' 테마 (id는 localStorage 키라 유지, UI 라벨만 '숲')
  polaroid: {
    bg: FOREST.base,
    bgGradient: [FOREST.deep, FOREST.light],
    frame: 'rounded',
    titlePos: 'center',
    dark: true,
  },
  mosaic: { bg: '#FAF9F7', frame: 'rounded', titlePos: 'top', dark: false },
  minimal: { bg: '#FFFFFF', frame: 'rounded', titlePos: 'top', dark: false },
};

// v8.0 — 첫인상은 겹침이 원천적으로 없는 모자이크. 숲은 무겹침 산포로 개선해 선택지로 유지
export const DEFAULT_TEMPLATE: CollageTemplate = 'mosaic';
export const TEMPLATE_ORDER: CollageTemplate[] = ['mosaic', 'polaroid', 'minimal'];

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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── 숲(polaroid): 예약셀 지터 그리드 (v8.0) ──
// 구 버전은 18개 고정 슬롯이 서로 겹치고 연도 카드·스티커가 사진을 가려 "사진이 안 보인다"는
// 오너 피드백이 났다. 셀 하나 = 항목 하나로 원천적 무겹침을 보장하고, 산포 느낌은 회전±지터로 낸다.

const POLAROID_ROTS = [-7, 5, -4, 8, -6, 4, 7, -5];
// 인덱스 결정적 지터 (셀 여유 폭 대비 비율) — Math.random 금지(재현성·검증 결정성)
const POLAROID_JITTER: [number, number][] = [
  [0.4, -0.3], [-0.35, 0.4], [0.2, 0.35], [-0.4, -0.2], [0.05, -0.4], [0.45, 0.2], [-0.2, 0.1], [0.3, -0.45],
];

/** 중앙 연도 카드의 정규화 rect — canvas(lib/wallpaper.ts: minDim×0.46/0.27, 중앙 배치)와 같은 수식.
 *  시드와 새 항목 배치가 이 영역을 피해 사진이 카드에 가리지 않는다 */
export function polaroidReserveRect(aspect: number): { x: number; y: number; w: number; h: number } {
  const wNorm = aspect < 1 ? 0.46 : 0.46 / aspect;
  const hNorm = aspect < 1 ? 0.27 * aspect : 0.27;
  const m = 0.02; // 여유 마진
  return { x: (1 - wNorm) / 2 - m, y: (1 - hNorm) / 2 - m, w: wNorm + m * 2, h: hNorm + m * 2 };
}

interface Rect { x: number; y: number; w: number; h: number }
const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const overlapArea = (a: Rect, b: Rect) => {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
};

/** 저장된 배치가 "사진이 서로를 가리는" 수준으로 망가졌는지 판정 (v8.4).
 *  현재 사진 키만 검사(스티커·삭제된 키 제외). 경계 대폭 이탈 또는 어느 쌍이든
 *  겹침이 작은 쪽 면적의 50%를 넘으면 broken — v8.0 시드의 최대 겹침은 ~13%라
 *  정상 시드 계열은 이 임계에 절대 걸리지 않는다. verify-collage-layout이 직접 검증 */
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

/** 숲 그리드 셀 계산 — 픽셀 기준 정사각 셀(cellH = cellW × aspect), 예약 영역과 겹치는 셀은 제외.
 *  cols를 2부터 키워가며 (사진 n + 스티커 2)개가 들어가는 최소 cols를 찾는다 → 사진이 최대한 커진다 */
function polaroidFreeCells(total: number, aspect: number): { cells: Rect[]; cellW: number } {
  const topReserve = hasTopReserve(aspect) ? 0.15 : 0;
  const x0 = 0.02, x1 = 0.98;
  const y0 = topReserve + 0.02, y1 = 0.98;
  const usableW = x1 - x0;
  const usableH = y1 - y0;
  const reserve = polaroidReserveRect(aspect);
  const maxCols = isLandscape(aspect) ? 9 : 7;
  let best: { cells: Rect[]; cellW: number } | null = null;
  for (let cols = 2; cols <= maxCols; cols++) {
    const cellW = usableW / cols;
    const cellH = cellW * aspect; // 픽셀 정사각
    const rows = Math.max(1, Math.floor(usableH / cellH));
    const free: Rect[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = { x: x0 + c * cellW, y: y0 + r * cellH, w: cellW, h: cellH };
        if (!rectsIntersect(cell, reserve)) free.push(cell);
      }
    }
    best = { cells: free, cellW };
    if (free.length >= total) return best;
  }
  return best!; // 이론상 도달 불가(폰 cols7이면 20+칸) — 마지막 그리드로 순환 배치
}

function seedPolaroid(items: CollageItem[], aspect: number): CollageLayout {
  const { cells, cellW } = polaroidFreeCells(items.length + 2, aspect);
  // 회전 bbox 예산 — ±7° 회전 시 bbox ≈ w×1.11이므로 w=0.92셀이면 넘침 ~2%뿐 (겹침 사실상 0)
  const w = cellW * 0.92;
  const hNorm = w * aspect;
  const slack = cellW - w;
  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const cell = cells[i % cells.length];
    const [jx, jy] = POLAROID_JITTER[i % POLAROID_JITTER.length];
    result[item.key] = {
      x: clamp(cell.x + slack / 2 + jx * slack, 0, 1 - w),
      y: clamp(cell.y + (cell.h - hNorm) / 2 + jy * slack, 0, 1 - hNorm),
      w,
      z: i + 1, // row-major 셀 순서 → 위쪽 행이 아래층, 자연스러운 겹층(실겹침은 ~0)
      rot: POLAROID_ROTS[i % POLAROID_ROTS.length],
    };
  });

  const layout: CollageLayout = { items: result, aspect, edited: false };
  // 스크랩북 무드 기본 스티커 — 사진과 셀을 나눠 가져 사진을 가리지 않는다
  layout.stickers = {
    'seed-script': { id: 'seed-script', text: "It's my year", style: 'script' },
    'seed-chip': { id: 'seed-chip', text: '잘 될 거야', style: 'chip' },
  };
  const spare = cells.slice(items.length); // 사진 배치 후 남은 셀 (부족하면 하단 셀 재사용)
  // 스티커 폭이 셀보다 넓어 인접 셀이면 서로 겹친다 — 한 칸 건너 배치
  const stickerCell = (idx: number) =>
    spare[idx * 2] ?? spare[idx] ?? cells[cells.length - 1 - idx] ?? cells[0];
  const sw = clamp(cellW * 1.3, STICKER_MIN_W, 0.4);
  [stickerKey('seed-script'), stickerKey('seed-chip')].forEach((key, i) => {
    const cell = stickerCell(i);
    result[key] = {
      x: clamp(cell.x + (cell.w - sw) / 2, 0, 1 - sw),
      y: cell.y + cell.h * 0.3,
      w: sw,
      z: items.length + 1 + i,
      rot: i === 0 ? -3 : -5,
    };
  });
  return layout;
}

// ── 모자이크: 매거진 스팬 그리드 — 크기가 섞인 결정적 패턴(첫 셀은 2×2 히어로) ──

const MOSAIC_SPANS: [number, number][] = [
  [2, 2], [1, 1], [1, 1], [1, 1], [1, 1], [2, 1], [1, 1], [1, 2],
];

function seedMosaic(items: CollageItem[], aspect: number): CollageLayout {
  const n = items.length;
  const gx = 0.015;
  const gy = gx * aspect;
  const margin = 0.02;
  // 상단 타이틀 밴드(라벨+연도) 아래부터 그리드 — 세로로 긴 화면은 시계 영역까지 고려해 더 내린다.
  // 가로형은 타이틀 실점유(~0.145)에 맞춰 0.16 (v8.2) — 사진 세로 예산 +5%p
  const titleBottom = hasTopReserve(aspect) ? 0.22 : isLandscape(aspect) ? 0.16 : 0.15;
  const availH = 0.97 - titleBottom;

  // 점유 그리드에 first-fit 패킹 — cols가 정해졌을 때의 셀 좌표
  const pack = (cols: number) => {
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
    return { cells, usedRows };
  };

  // 컬럼 수 최적 탐색 (v8.2) — 고정 공식 대신 후보마다 실제로 패킹해 보고, 세로 초과 축소(k)까지
  // 반영한 최종 셀 폭이 가장 큰 cols를 고른다(동률이면 작은 cols). 1~18장·비율 전 범위 자동 적응.
  // 히어로 [2,2] 스팬이 있어 cols는 2부터 — n=1도 cols=2에서 전폭 히어로가 된다.
  const maxCols = hasTopReserve(aspect) ? 5 : 9;
  let best: { cells: { c: number; r: number; sc: number; sr: number }[]; usedRows: number; cellW: number; cellH: number; cols: number } | null = null;
  for (let cols = 2; cols <= maxCols; cols++) {
    const { cells, usedRows } = pack(cols);
    let cellW = (1 - margin * 2 - (cols - 1) * gx) / cols;
    let cellH = cellW * aspect;
    const neededH = usedRows * cellH + (usedRows - 1) * gy;
    if (neededH > availH) {
      // 갭은 축소하지 않으므로 갭을 제외한 셀 예산으로 k를 구한다 — availH/neededH 방식은
      // (1-k)×갭만큼 하단이 넘친다 (v8.2 리플로우 검증에서 발견된 잠재 오차)
      const k = Math.max(0.01, (availH - (usedRows - 1) * gy) / (usedRows * cellH));
      cellW *= k;
      cellH *= k;
    }
    if (!best || cellW > best.cellW + 1e-9) best = { cells, usedRows, cellW, cellH, cols };
  }
  const { cells, usedRows, cellW, cellH, cols } = best!;
  const gridW = cols * cellW + (cols - 1) * gx;
  const left = (1 - gridW) / 2;
  // v8.0 — 세로도 가운데 정렬: 사진이 적을 때 상단에 몰리고 하단이 비는 문제 해소
  const contentH = usedRows * cellH + (usedRows - 1) * gy;
  const top = titleBottom + Math.max(0, (availH - contentH) / 2);

  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const { c, r, sc, sr } = cells[i];
    result[item.key] = {
      x: left + c * (cellW + gx),
      y: top + r * (cellH + gy),
      w: sc * cellW + (sc - 1) * gx,
      h: sr * cellH + (sr - 1) * gy,
      z: i + 1,
    };
  });
  return { items: result, aspect, edited: false };
}

// ── 미니멀: 균일 균형 행 그리드 (v8.4) — v8.5부터 시드는 아래 혼합 밴드 타일링으로 이사.
// 이 함수는 reflowLayout의 전-스팬-1×1 경로(편집으로 균일해진 배치의 리플로우)에만 남는다.
// 고아 행 배제 원리: r ∈ [ceil(n/maxCols) .. floor(n/2)]는 모든 행이 ≥2장, r = n은 전 행 1장뿐.

/** 균형 행 그리드 배치 — reflowLayout(편집 리플로우)의 균일 1×1 경로 전용 (v8.5부터).
 *  z: 시드는 i+1, 리플로우는 entries.z 보존. includeH: 리플로우 계약은 h를 직접 읽는다 */
function layoutBalancedGrid(
  entries: { key: string; z?: number }[],
  aspect: number,
  includeH: boolean
): Record<string, CollageLayoutItem> {
  const n = entries.length;
  const result: Record<string, CollageLayoutItem> = {};
  if (n === 0) return result;
  const g = 0.02;
  const margin = 0.035;
  const titleBottom = hasTopReserve(aspect) ? 0.22 : isLandscape(aspect) ? 0.16 : 0.17;
  const availH = 0.95 - titleBottom;
  const gy = g * aspect;

  const maxCols = Math.min(n, hasTopReserve(aspect) ? 5 : 9);
  const candidates: number[] = [];
  for (let r = Math.ceil(n / maxCols); r <= Math.floor(n / 2); r++) candidates.push(r);
  candidates.push(n); // 1열 세로 스택 — 사진이 적을 땐 이게 제일 크다
  let best: { rows: number; colsEff: number; w: number; hNorm: number } | null = null;
  for (const rows of candidates) {
    const colsEff = Math.ceil(n / rows); // 균형 분배의 최대 행 개수 = base + (extra>0)
    if (colsEff > maxCols) continue;
    let w = (1 - margin * 2 - (colsEff - 1) * g) / colsEff;
    let hNorm = w * aspect;
    const neededH = rows * hNorm + (rows - 1) * gy;
    if (neededH > availH) {
      // 갭 제외 셀 예산 기준 축소 — seedMosaic와 동일한 이유 (v8.2)
      const k = Math.max(0.01, (availH - (rows - 1) * gy) / (rows * hNorm));
      w *= k;
      hNorm *= k;
    }
    if (!best || w > best.w + 1e-9) best = { rows, colsEff, w, hNorm };
  }
  const { rows, colsEff, w, hNorm } = best!;
  // 균형 분배 — 앞쪽 extra개 행이 1장 더 갖는다 (행당 개수 차 ≤1)
  const base = Math.floor(n / rows);
  const extra = n % rows;
  const gridW = colsEff * w + (colsEff - 1) * g;
  const left = (1 - gridW) / 2;
  // v8.0 — 세로도 가운데 정렬
  const contentH = rows * hNorm + (rows - 1) * gy;
  const top = titleBottom + Math.max(0, (availH - contentH) / 2);

  let i = 0;
  for (let r = 0; r < rows; r++) {
    const inRow = base + (r < extra ? 1 : 0);
    const rowOffset = ((colsEff - inRow) * (w + g)) / 2; // 모든 짧은 행 가운데 정렬
    for (let c = 0; c < inRow; c++, i++) {
      const e = entries[i];
      result[e.key] = {
        x: left + rowOffset + c * (w + g),
        y: top + r * (hNorm + gy),
        w,
        ...(includeH ? { h: hNorm } : {}),
        z: e.z ?? i + 1,
      };
    }
  }
  return result;
}

// ── 미니멀 혼합 그리드 시드 (v8.5) ──
// 구 균일 시드는 1~18장 전부 같은 크기라 "배치를 전혀 고려하지 않았다"는 오너 피드백.
// "큰 사진 1개"가 아니라 크고 작은 여러 장이 섞이되(오너 확정), 미니멀답게 여백·정렬은 유지:
// 밴드가 C열 그리드를 정확히 타일해 구멍·겹침이 원천적으로 없다.
//  - 히어로 밴드(2행): 2×2 하나 + (C−2)열×(1×1 두 장 스택) = 1+2(C−2)장. 밴드마다 좌/우 교대
//  - 균일 행: C×1×1. 히어로와 교차 배열해 리듬을 만든다
//  - 나머지 r: r=1 → 가운데 배너 [min(C,4),1] (⚠️ 스팬 ≤4 — inferGridSpans 캡과 락스텝),
//    r≥2 → 가운데 짧은 행
// C는 3..maxCols 후보마다 실제 구성해 보고 k-축소 반영 최종 셀 폭이 가장 큰 값을 고른다
// (seedMosaic·layoutBalancedGrid와 같은 탐색 철학 — 장수·비율 전 범위 자동 적응).
type MinimalBand =
  | { kind: 'hero'; heroRight: boolean }
  | { kind: 'row'; count: number }
  | { kind: 'banner' };

function seedMinimal(items: CollageItem[], aspect: number): CollageLayout {
  const n = items.length;
  const result: Record<string, CollageLayoutItem> = {};
  if (n === 0) return { items: result, aspect, edited: false };

  const g = 0.02;
  const gy = g * aspect;
  const margin = 0.035;
  const titleBottom = hasTopReserve(aspect) ? 0.22 : isLandscape(aspect) ? 0.16 : 0.17;
  const availH = 0.95 - titleBottom;

  // 특례 n=1 — 전폭 히어로 (가로형은 높이 기준 클램프), 수직 센터
  if (n === 1) {
    let w = 1 - margin * 2;
    let h = w * aspect;
    if (h > availH) {
      h = availH;
      w = h / aspect;
    }
    result[items[0].key] = { x: (1 - w) / 2, y: titleBottom + (availH - h) / 2, w, h, z: 1 };
    return { items: result, aspect, edited: false };
  }
  // 특례 n=2 — 폰은 전폭 2단 스택, 4:5·가로형은 좌우 2분할
  if (n === 2) {
    if (hasTopReserve(aspect)) {
      let w = 1 - margin * 2;
      let h = w * aspect;
      if (2 * h + gy > availH) {
        const k = Math.max(0.01, (availH - gy) / (2 * h));
        w *= k;
        h *= k;
      }
      const top = titleBottom + Math.max(0, (availH - (2 * h + gy)) / 2);
      items.forEach((item, i) => {
        result[item.key] = { x: (1 - w) / 2, y: top + i * (h + gy), w, h, z: i + 1 };
      });
    } else {
      let w = (1 - margin * 2 - g) / 2;
      let h = w * aspect;
      if (h > availH) {
        const k = availH / h;
        w *= k;
        h *= k;
      }
      const left = (1 - (2 * w + g)) / 2;
      const top = titleBottom + Math.max(0, (availH - h) / 2);
      items.forEach((item, i) => {
        result[item.key] = { x: left + i * (w + g), y: top, w, h, z: i + 1 };
      });
    }
    return { items: result, aspect, edited: false };
  }

  // C 후보 탐색 — n ≥ 3이면 C=3(히어로 밴드 3장)이 항상 유효해 best가 존재한다
  const maxCols = hasTopReserve(aspect) ? 5 : 7;
  let best: { cols: number; w: number; hNorm: number; bands: MinimalBand[] } | null = null;
  for (let C = 3; C <= maxCols; C++) {
    const heroSize = 1 + 2 * (C - 2);
    if (n < heroSize) continue;
    const heroCount = clamp(Math.round(n / (heroSize + C)), 1, 3);
    const rem = n - heroCount * heroSize;
    if (rem < 0) continue; // clamp 하한 1에서만 가능(heroSize > n) — 위 가드로 이미 배제
    const uniformRows = Math.floor(rem / C);
    const r = rem % C;
    const bands: MinimalBand[] = [];
    for (let i = 0; i < Math.max(heroCount, uniformRows); i++) {
      if (i < heroCount) bands.push({ kind: 'hero', heroRight: i % 2 === 1 });
      if (i < uniformRows) bands.push({ kind: 'row', count: C });
    }
    if (r === 1) bands.push({ kind: 'banner' });
    else if (r >= 2) bands.push({ kind: 'row', count: r });

    const totalRows = bands.reduce((acc, b) => acc + (b.kind === 'hero' ? 2 : 1), 0);
    let w = (1 - margin * 2 - (C - 1) * g) / C;
    let hNorm = w * aspect;
    const neededH = totalRows * hNorm + (totalRows - 1) * gy;
    if (neededH > availH) {
      // 갭 제외 셀 예산 기준 축소 — seedMosaic와 동일한 이유 (v8.2)
      const k = Math.max(0.01, (availH - (totalRows - 1) * gy) / (totalRows * hNorm));
      w *= k;
      hNorm *= k;
    }
    if (!best || w > best.w + 1e-9) best = { cols: C, w, hNorm, bands };
  }
  const { cols, w, hNorm, bands } = best!;
  const gridW = cols * w + (cols - 1) * g;
  const left = (1 - gridW) / 2;
  const totalRows = bands.reduce((acc, b) => acc + (b.kind === 'hero' ? 2 : 1), 0);
  const contentH = totalRows * hNorm + (totalRows - 1) * gy;
  let rowY = titleBottom + Math.max(0, (availH - contentH) / 2);

  let i = 0;
  for (const band of bands) {
    if (band.kind === 'hero') {
      const heroCol = band.heroRight ? cols - 2 : 0;
      result[items[i].key] = {
        x: left + heroCol * (w + g),
        y: rowY,
        w: 2 * w + g,
        h: 2 * hNorm + gy,
        z: i + 1,
      };
      i++;
      for (let c = 0; c < cols; c++) {
        if (c >= heroCol && c < heroCol + 2) continue; // 히어로 점유 열
        for (let rr = 0; rr < 2; rr++) {
          result[items[i].key] = {
            x: left + c * (w + g),
            y: rowY + rr * (hNorm + gy),
            w,
            h: hNorm,
            z: i + 1,
          };
          i++;
        }
      }
      rowY += 2 * (hNorm + gy);
    } else if (band.kind === 'row') {
      const rowOffset = ((cols - band.count) * (w + g)) / 2; // 짧은 행 가운데 정렬
      for (let c = 0; c < band.count; c++) {
        result[items[i].key] = {
          x: left + rowOffset + c * (w + g),
          y: rowY,
          w,
          h: hNorm,
          z: i + 1,
        };
        i++;
      }
      rowY += hNorm + gy;
    } else {
      const span = Math.min(cols, 4); // ⚠️ inferGridSpans 스팬 캡 1..4 락스텝
      const bw = span * w + (span - 1) * g;
      result[items[i].key] = {
        x: left + (gridW - bw) / 2,
        y: rowY,
        w: bw,
        h: hNorm,
        z: i + 1,
      };
      i++;
      rowY += hNorm + gy;
    }
  }
  return { items: result, aspect, edited: false };
}

export function seedLayout(
  template: CollageTemplate,
  items: CollageItem[],
  aspect: number = ASPECT
): CollageLayout {
  if (template === 'polaroid') return seedPolaroid(items, aspect);
  if (template === 'mosaic') return seedMosaic(items, aspect);
  return seedMinimal(items, aspect);
}

// ── v8.2 반응형 그리드 편집 — 리사이즈 후 전체 리플로우 ──
// 숲(polaroid)은 지터·회전·산포가 정체성(그리드 의미론 없음)이라 대상이 아니다.

export interface GridSpans {
  cellW: number;
  spans: Record<string, [number, number]>;
}

/** 현재 배치가 그리드 정합인지 판정하고 키별 스팬을 역산 (v8.2).
 *  기준 셀 폭 = 사진 최소 폭. 스팬 환산 오차가 셀의 35%를 넘는 항목이 있으면
 *  자유 배치(사용자가 그리드를 깬 상태)로 보고 null — 리플로우 부적격 */
export function inferGridSpans(
  items: Record<string, CollageLayoutItem>,
  aspect: number
): GridSpans | null {
  const photos = Object.entries(items).filter(([k]) => !k.startsWith('sticker:'));
  if (photos.length < 2) return null;
  const gx = 0.015; // 스팬 반올림용 근사 — mosaic/minimal 갭 차이(0.005)는 허용오차 안
  const gy = gx * aspect;
  const cellW = Math.min(...photos.map(([, it]) => it.w));
  if (!(cellW > 0)) return null;
  const cellH = cellW * aspect;
  const spans: Record<string, [number, number]> = {};
  for (const [k, it] of photos) {
    const h = it.h ?? it.w * aspect;
    const sc = Math.round((it.w + gx) / (cellW + gx));
    const sr = Math.round((h + gy) / (cellH + gy));
    if (sc < 1 || sc > 4 || sr < 1 || sr > 4) return null;
    if (Math.abs(it.w - (sc * cellW + (sc - 1) * gx)) > cellW * 0.35) return null;
    if (Math.abs(h - (sr * cellH + (sr - 1) * gy)) > cellH * 0.35) return null;
    spans[k] = [sc, sr];
  }
  return { cellW, spans };
}

/** 주어진 스팬을 읽기 순서 그대로 다시 패킹 (v8.2) — 한 장이 커지면 나머지가 자리를 내준다.
 *  시드와 같은 cols 최적 탐색(최종 셀 폭 최대)을 쓰므로 결과도 시드와 같은 기하 계약(무겹침·경계·
 *  수직 센터링)을 따른다. z는 호출자가 준 값 그대로 보존. 스티커는 다루지 않는다 */
export function reflowLayout(
  template: CollageTemplate,
  ordered: { key: string; span: [number, number]; z: number }[],
  aspect: number = ASPECT
): Record<string, CollageLayoutItem> | null {
  if (template === 'polaroid' || ordered.length === 0) return null;
  // 미니멀 균일(전 스팬 1×1) 리플로우는 시드와 같은 균형 행 분배로 — 편집 후에도 고아 행이
  // 재발하지 않는다 (v8.4). 스팬 혼합(사진 확대 편집)은 기존 first-fit 유지 — 스팬 패킹엔
  // 균형 분배 등가물이 없어 고아 가능성을 허용한다.
  if (template === 'minimal' && ordered.every((e) => e.span[0] === 1 && e.span[1] === 1)) {
    return layoutBalancedGrid(ordered, aspect, true);
  }
  const gx = template === 'mosaic' ? 0.015 : 0.02;
  const gy = gx * aspect;
  const margin = template === 'mosaic' ? 0.02 : 0.035;
  const titleBottom = hasTopReserve(aspect) ? 0.22 : isLandscape(aspect) ? 0.16 : template === 'mosaic' ? 0.15 : 0.17;
  const availB = template === 'mosaic' ? 0.97 : 0.95;
  const availH = availB - titleBottom;

  const pack = (cols: number) => {
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
    ordered.forEach((e) => {
      let sc = Math.min(e.span[0], cols);
      let sr = Math.min(e.span[1], cols);
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
        if (r > 40) { sc = 1; sr = 1; }
      }
    });
    const usedRows = grid.reduce((m, row, r) => (row.some(Boolean) ? r + 1 : m), 1);
    return { cells, usedRows };
  };

  // 시드와 동일한 cols 최적 탐색 — 스팬 구성이 달라졌으니 다시 고른다
  const maxCols = hasTopReserve(aspect) ? 5 : 9;
  const minCols = Math.max(2, ...ordered.map((e) => Math.min(e.span[0], 4)));
  let best: { cells: { c: number; r: number; sc: number; sr: number }[]; usedRows: number; cellW: number; cellH: number; cols: number } | null = null;
  for (let cols = minCols; cols <= Math.max(minCols, maxCols); cols++) {
    const { cells, usedRows } = pack(cols);
    let cellW = (1 - margin * 2 - (cols - 1) * gx) / cols;
    let cellH = cellW * aspect;
    const neededH = usedRows * cellH + (usedRows - 1) * gy;
    if (neededH > availH) {
      // 갭 제외 셀 예산 기준 축소 — seedMosaic와 동일한 이유 (v8.2)
      const k = Math.max(0.01, (availH - (usedRows - 1) * gy) / (usedRows * cellH));
      cellW *= k;
      cellH *= k;
    }
    if (!best || cellW > best.cellW + 1e-9) best = { cells, usedRows, cellW, cellH, cols };
  }
  const { cells, usedRows, cellW, cellH, cols } = best!;
  const gridW = cols * cellW + (cols - 1) * gx;
  const left = (1 - gridW) / 2;
  const contentH = usedRows * cellH + (usedRows - 1) * gy;
  const top = titleBottom + Math.max(0, (availH - contentH) / 2);

  const result: Record<string, CollageLayoutItem> = {};
  ordered.forEach((e, i) => {
    const { c, r, sc, sr } = cells[i];
    result[e.key] = {
      x: left + c * (cellW + gx),
      y: top + r * (cellH + gy),
      w: sc * cellW + (sc - 1) * gx,
      h: sr * cellH + (sr - 1) * gy,
      z: e.z,
    };
  });
  return result;
}

/** 새 항목을 기존 배치의 빈 공간에 놓는다 (v8.0) — 코스 그리드 후보를 훑어 기존 항목·예약
 *  영역과의 겹침이 최소인 자리를 고른다. 결정적(무작위 없음). 고아 스티커 폴백도 이 경로를 쓴다 */
export function placeNewItems(
  newKeys: string[],
  existing: Record<string, CollageLayoutItem>,
  template: CollageTemplate,
  aspect: number = ASPECT
): Record<string, CollageLayoutItem> {
  const placed: Record<string, CollageLayoutItem> = {};
  if (newKeys.length === 0) return placed;

  const topReserve =
    template === 'polaroid'
      ? hasTopReserve(aspect) ? 0.17 : 0.02
      : hasTopReserve(aspect) ? 0.22 : 0.16;
  const reserved: Rect[] =
    template === 'polaroid' ? [polaroidReserveRect(aspect)] : [];

  const itemRect = (key: string, it: CollageLayoutItem): Rect => ({
    x: it.x,
    y: it.y,
    w: it.w,
    // 스티커는 텍스트라 실높이가 낮다 — 정사각 가정이면 팬텀 블록이 생겨 빈 공간 탐색을 방해
    h: it.h ?? (key.startsWith('sticker:') ? it.w * 0.35 : it.w * aspect),
  });

  // 새 사진 폭 = 기존 사진 폭 중앙값 (없으면 비율별 기본값)
  const photoWs = Object.entries(existing)
    .filter(([k]) => !k.startsWith('sticker:'))
    .map(([, it]) => it.w)
    .sort((a, b) => a - b);
  const defaultW = photoWs.length
    ? photoWs[Math.floor(photoWs.length / 2)]
    : isLandscape(aspect) ? 0.16 : 0.26;

  const rects: Rect[] = Object.entries(existing).map(([k, it]) => itemRect(k, it));
  let maxZ = Math.max(0, ...Object.values(existing).map((it) => it.z));

  for (const key of newKeys) {
    const isSticker = key.startsWith('sticker:');
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
        // 예약 영역(연도 카드)은 불투명 오버레이라 사진 겹침보다 훨씬 나쁘다 — 강한 가중 회피
        for (const r of reserved) score += (overlapArea(cand, r) / (w * h)) * 10;
        if (score < best.score) best = { x, y, score };
        if (best.score === 0) break; // 완전 빈 자리 발견 — 조기 종료
      }
    }
    const it: CollageLayoutItem = {
      x: best.x, y: best.y, w, z: ++maxZ,
      ...(template === 'polaroid' && !isSticker ? { rot: POLAROID_ROTS[rects.length % POLAROID_ROTS.length] } : {}),
    };
    placed[key] = it;
    rects.push(itemRect(key, it));
  }
  return placed;
}

// 저장된 배치 + 현재 사진 구성 동기화 (v8.0 identity reconcile)
// - 저장 당시 비율(saved.aspect)과 다르면 시드로 새로 시작 (v6.19)
// - '기본 배치로'만 하고 손대지 않은 배치(edited === false)는 항상 신선한 시드 —
//   사진이 늘 때마다 자동 배치가 계속 개선된다
// - 손댄 배치(edited true, 또는 플래그 없는 레거시 = 상호작용으로만 저장됐으므로 손댄 것)는
//   기존 키 위치를 보존하고 "새 키만" 빈 공간에 배치.
//   (구 버전은 시드 인덱스로 채워 새 사진이 기존 사진 바로 밑에 생기는 버그가 있었다)
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
  // 숲 레거시 가시성 가드 (v8.4) — edited 플래그 없는 pre-v8.0 배치(18개 고정 슬롯이 서로 겹침)가
  // "손댄 배치" 취급으로 보존돼 사진이 가려지는 문제. 사진이 실제로 서로를 가릴 때만 시드로 복구.
  // saveEdited는 항상 edited:true를 쓰므로 사용자가 만진 배치(의도적 겹침 포함)는 절대 리시드되지 않는다.
  if (template === 'polaroid' && saved.edited === undefined && isLayoutBroken(saved, items, aspect)) {
    return seedLayout(template, items, aspect);
  }

  const result: Record<string, CollageLayoutItem> = {};
  const newKeys: string[] = [];
  for (const item of items) {
    if (saved.items[item.key]) result[item.key] = saved.items[item.key];
    else newKeys.push(item.key);
  }
  const stickers: Record<string, CollageSticker> = { ...saved.stickers };
  for (const id of Object.keys(stickers)) {
    const key = stickerKey(id);
    if (saved.items[key]) result[key] = saved.items[key];
    else newKeys.push(key); // 고아 스티커 — 구 폴백(중앙 고정)은 연도 카드 밑에 깔렸다
  }
  Object.assign(result, placeNewItems(newKeys, result, template, aspect));
  return { items: result, stickers, aspect, edited: true };
}

// 새 스티커의 기본 배치 — 중앙 연도 카드(폴라로이드)에 가리지 않게 중앙 아래, 최상단.
// 가로형(PC) 보드에서는 폭 비례 글자가 과대해지지 않게 줄인다
export function newStickerLayoutItem(maxZ: number, aspect: number = ASPECT): CollageLayoutItem {
  const w = isLandscape(aspect) ? 0.26 : 0.44;
  return { x: (1 - w) / 2, y: 0.62, w, z: maxZ + 1, rot: -2 };
}
