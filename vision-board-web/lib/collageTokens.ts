// 콜라주 조판 토큰 — DOM(CollageBoard) · canvas(lib/wallpaper.ts) · 기하 검증(scripts/verify-collage-layout.js)이
// 공유하는 수치의 단일 소스 (v9.0).
//
// 왜 생겼나: v8.7까지 titleBottom 공식만 해도 collageTemplates.ts 4곳 + 검증 스크립트에 중복돼 있었고,
// 여백·갭·타이포 비율도 소비처마다 하드코딩이었다. 하나만 어긋나면 화면과 저장 이미지가 조용히 갈라진다.
//
// ⚠️ 이 파일은 순수 유지 — ./types 포함 어떤 프로젝트 모듈도 import하지 않는다.
//    검증 스크립트가 tsx로 단독 컴파일하고, 브라우저·노드 양쪽에서 같은 값을 읽어야 하기 때문.
//    (lib/merge.ts가 같은 이유로 순수를 유지하는 것과 같은 계약)

/** 그리드 기반 콜라주 템플릿. lib/types.ts의 CollageTemplate과 같은 유니온이지만 의존을 만들지 않는다 */
export type GridTemplate = 'mosaic' | 'minimal' | 'matte';

// ── 비율 판정 (collageTemplates.ts에서 재export해 기존 호출부 호환) ──

/** 세로로 긴 화면(폰·태블릿)은 상단 ~15%를 시계·위젯 영역으로 비운다 */
export const hasTopReserve = (aspect: number) => aspect < 0.75;
export const isLandscape = (aspect: number) => aspect > 1;

/** minDim(짧은 변)을 폭/높이로 나눈 정규화 계수.
 *  모든 여백을 이 계수로 곱하면 축과 무관하게 픽셀 등방이 된다 —
 *  v8.7까지는 여백이 폭 정규화라 16:9에서 좌우 38px / 상하 32px로 비대칭이었다 */
export const minDimNormX = (aspect: number) => Math.min(1, 1 / aspect);
export const minDimNormY = (aspect: number) => Math.min(aspect, 1);

// ── 여백·갭 ──
// G = 갭 / minDim,  M = 외곽 여백 / 갭.
// v8.7 실측: 1920×1080에서 여백 38px · 갭 29px → 1.3:1. 갤러리 조판의 통념은 2.5~3:1이고,
// 이 "여백이 사실상 없는" 상태가 오너가 말한 "왁! 큰 느낌"의 절반이었다.
// 갭은 거의 그대로 두고(29→27px) 여백만 2배로 키운다 — 갭은 원래 문제가 아니었다.
const GAP_RATIO: Record<GridTemplate, number> = {
  mosaic: 0.025,
  minimal: 0.03,
  matte: 0.055,
};
const MARGIN_MULT: Record<GridTemplate, number> = {
  mosaic: 3.0,
  minimal: 3.0,
  matte: 2.2,
};
/** 울트라와이드(21:9)에서 minDim 비례 여백이 폭 대비 너무 얇아지는 것을 막는 하한 */
const MARGIN_X_FLOOR = 0.03;

export interface SpacingTokens {
  /** 좌우 외곽 여백 (폭 정규화) */
  marginX: number;
  /** 상하 외곽 여백 (높이 정규화) */
  marginY: number;
  /** 사진 사이 가로 간격 (폭 정규화) */
  gutterX: number;
  /** 사진 사이 세로 간격 (높이 정규화) — gutterX와 픽셀 등방 */
  gutterY: number;
  /** 그리드가 시작하는 y — 상단 타이틀 밴드 아래 */
  titleBottom: number;
  /** 그리드가 끝나는 y = 1 − marginY */
  availBottom: number;
  /** 그리드에 주어진 세로 예산 */
  availHeight: number;
  /** 그리드에 주어진 가로 예산 */
  availWidth: number;
}

export function spacingFor(template: GridTemplate, aspect: number): SpacingTokens {
  const nx = minDimNormX(aspect);
  const ny = minDimNormY(aspect);
  const g = GAP_RATIO[template];
  const m = MARGIN_MULT[template];

  const gutterX = g * nx;
  const gutterY = g * ny;
  const marginX = Math.max(g * m * nx, MARGIN_X_FLOOR);
  const marginY = g * m * ny;

  // 세로로 긴 화면은 시계 영역까지 고려해 더 내린다. 가로형은 타이틀 실점유에 맞춘 값(v8.2)
  const titleBottom = hasTopReserve(aspect)
    ? 0.22
    : isLandscape(aspect)
      ? 0.16
      : template === 'mosaic'
        ? 0.15
        : 0.17;
  const availBottom = 1 - marginY;

  return {
    marginX,
    marginY,
    gutterX,
    gutterY,
    titleBottom,
    availBottom,
    availHeight: availBottom - titleBottom,
    availWidth: 1 - marginX * 2,
  };
}

// ── 타이포 ──
// v8.7 실측: 1920×1080에서 연도가 minDim×0.07 = 76px이고 그 아래 여유가 11px뿐이었다.
// 가로형만 줄인다 — 폰·보드 비율에서는 현행 크기가 이미 적절하다.

export interface TitleTokens {
  /** 상단 패딩 (minDim 비례) — DOM은 cqmin, canvas는 minDim×값 */
  padTop: number;
  /** "V I S I O N   B O A R D" 라벨 폰트 크기 (minDim 비례) */
  labelRatio: number;
  /** 연도 폰트 크기 (minDim 비례) */
  yearRatio: number;
  /** 라벨 중심 y (minDim 비례, canvas 전용) */
  labelY: number;
  /** 연도 중심 y (minDim 비례, canvas 전용) */
  yearY: number;
}

export function titleTokensFor(template: GridTemplate, aspect: number): TitleTokens {
  const padTop = hasTopReserve(aspect) ? 0.32 : 0.045;
  const land = isLandscape(aspect);
  // 매트 갤러리는 배경색이 주인공이라 타이틀을 한 단계 더 조용하게
  const quiet = template === 'matte';
  const labelRatio = quiet ? (land ? 0.02 : 0.023) : land ? 0.022 : 0.026;
  const yearRatio = quiet ? (land ? 0.046 : 0.06) : land ? 0.052 : 0.07;
  return { padTop, labelRatio, yearRatio, labelY: padTop + 0.01, yearY: padTop + 0.07 };
}

// ── 사진 박스 가드레일 ──
// "빈틈 없이 꽉"(목적함수=채움률)과 "왁! 하지 않게"는 서로 반대 방향이다.
// 하나는 목적함수, 다른 하나는 제약으로 분리해야 둘 다 만족한다.
// 이 값들은 눈대중이 아니라 솔버를 n=3..18 × 3비율로 돌려 역산한 것이다 —
// scripts/verify-collage-layout.js의 "가드레일 회귀" 블록이 이 임계를 고정한다.
//
// ⚠️ 제약 검사는 반드시 k-축소(세로 초과 시 셀 축소) **이후**의 최종 박스에 적용할 것.
//    축소 전 값으로 판정하면 실제로는 들어맞는 후보를 잘못 탈락시킨다.

export interface PhotoBounds {
  /** 사진 박스 높이 상한 (높이 정규화) */
  maxH: number;
  /** 사진 박스 높이 하한 — 너무 잘아서 알아볼 수 없는 배치를 막는다 */
  minH: number;
  /** 박스 가로세로비(px) 허용 상한. 1/값이 하한 */
  maxBoxRatio: number;
}

/** 가드레일이 적용되는 최소 장수. 1~2장은 크게 보이는 게 맞다 */
export const GUARDRAIL_MIN_ITEMS = 3;

export function photoBounds(aspect: number): PhotoBounds {
  if (isLandscape(aspect)) {
    // 1080 높이에서 594px. 이 값을 더 조이면 n=3처럼 사진이 적을 때 한 줄로 시원하게 놓는 배치가
    // 탈락하고 채움률 47%짜리 성긴 배치가 남는다(솔버 실측). "왁!"의 실제 억제력은 이 상한이 아니라
    // 목적함수(채움률)에서 나온다 — 히어로 밴드는 가로 예산을 낭비해 채움률에서 스스로 진다.
    // 상한은 v8.7의 병리(n=6에서 720px=67%)만 확실히 잘라내는 안전망 역할
    return { maxH: 0.55, minH: 0.06, maxBoxRatio: 2.2 };
  }
  // 세로형·보드 — 폭 바운드라 같은 스팬이어도 높이 점유가 작다
  return { maxH: 0.5, minH: 0.045, maxBoxRatio: 2.2 };
}

/** 박스 가로세로비가 허용 범위 안인지 (px 기준).
 *  넘어서면 object-cover가 사진을 심하게 잘라 "띠"처럼 보인다 — 3열 스팬 1행 배너가 이 경우 */
export function boxRatioOk(wNorm: number, hNorm: number, aspect: number, bounds: PhotoBounds): boolean {
  if (hNorm <= 0) return false;
  // px 비 = (w × 보드폭) / (h × 보드높이) = (w / h) × aspect
  const r = (wNorm / hNorm) * aspect;
  return r <= bounds.maxBoxRatio + 1e-9 && r >= 1 / bounds.maxBoxRatio - 1e-9;
}

/** 스팬 상한 — 레거시 배치의 그리드 역산(inferGridSpans)과 밴드 구성이 공유한다.
 *  가드레일이 실질 상한을 이미 만들지만, 탐색 공간을 좁혀 결정성·성능을 지킨다 */
export const SPAN_CAP = 4;

// ── 렌더 상수 ──

/** 사진 모서리 반경 / 사진 폭 */
export const PHOTO_RADIUS_RATIO = 0.06;
/** 매트 갤러리 — 매트 여백 / 셀 짧은 변.
 *  매트 갤러리를 구분 짓는 건 셀 크기 상한이 아니라 넓은 외곽 여백(2.2×갭)·균일 1×1·무크롭이다.
 *  셀에 별도 상한을 걸면 채움률이 무너져 사진이 허공에 뜬다(솔버 실측 fill 0.11~0.24) */
export const MATTE_MAT_RATIO = 0.085;

// ── 배경색 팔레트 (모자이크 · 미니멀 · 매트 공통) ──
// 배경색은 템플릿 전용 기능이 아니라 세 템플릿을 가로지르는 축이다.
// 저채도로 고른 이유: 어떤 사진이 들어와도 배경이 먼저 튀지 않아야 한다.

export interface BgSwatch {
  id: string;
  hex: string;
  label: string;
}

export const BG_PALETTE: BgSwatch[] = [
  { id: 'white', hex: '#FFFFFF', label: '화이트' },
  { id: 'ivory', hex: '#F4F1EC', label: '아이보리' },
  { id: 'linen', hex: '#E8E4DC', label: '리넨' },
  { id: 'sage', hex: '#DDE3DE', label: '세이지' },
  { id: 'mist', hex: '#DCE3EA', label: '미스트' },
  { id: 'clay', hex: '#E9DFD8', label: '클레이' },
  { id: 'forest', hex: '#2E3330', label: '포레스트' },
  { id: 'ink', hex: '#1C1B19', label: '잉크' },
];

/** 배경색 미설정(undefined)일 때 템플릿이 쓰는 기본색.
 *  기존 사용자는 이 필드가 없으므로 지금 화면 그대로 보인다(무회귀) */
export const TEMPLATE_DEFAULT_BG: Record<GridTemplate, string> = {
  mosaic: '#FAF9F7',
  minimal: '#FFFFFF',
  matte: '#FFFFFF',
};

/** 저장된 배경색을 팔레트 화이트리스트로 검증. 미지 값이면 템플릿 기본색 —
 *  손상된 데이터가 렌더를 깨뜨리지 않는다 */
export function normalizeBgColor(bg: string | undefined, template: GridTemplate): string {
  if (!bg) return TEMPLATE_DEFAULT_BG[template];
  const up = bg.toUpperCase();
  return BG_PALETTE.some((s) => s.hex.toUpperCase() === up) ? up : TEMPLATE_DEFAULT_BG[template];
}

/** sRGB 상대 휘도 (WCAG 2.x) */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const toLin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 대비비 — 검증 스크립트가 팔레트 × 글자색 조합을 단언한다 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface TitleInk {
  /** 연도 — 주인공 */
  title: string;
  /** "VISION BOARD" 라벨 — 보조 */
  label: string;
  /** 어두운 배경인가 — 사진 그림자/링 전환에도 쓰인다 */
  dark: boolean;
}

/** 배경색에 따라 타이틀 글자색을 자동 반전.
 *  이것 때문에 테마의 dark가 더 이상 정적 상수일 수 없어 COLLAGE_THEMES가 themeFor() 함수로 승격됐다 */
export function titleInkFor(bg: string): TitleInk {
  return relativeLuminance(bg) < 0.45
    ? { title: '#FFFFFF', label: '#C4C2BE', dark: true }
    : { title: '#1C1B19', label: '#6E6962', dark: false };
}
