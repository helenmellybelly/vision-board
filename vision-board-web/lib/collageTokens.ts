// 콜라주 조판 토큰 — DOM(CollageBoard) · canvas(lib/wallpaper.ts) · 기하 검증(scripts/verify-collage-layout.js)이
// 공유하는 수치의 단일 소스 (v9.0).
//
// 왜 생겼나: v8.7까지 titleBottom 공식만 해도 collageTemplates.ts 4곳 + 검증 스크립트에 중복돼 있었고,
// 여백·갭·타이포 비율도 소비처마다 하드코딩이었다. 하나만 어긋나면 화면과 저장 이미지가 조용히 갈라진다.
//
// ⚠️ 이 파일은 순수 유지 — ./types 포함 어떤 프로젝트 모듈도 import하지 않는다.
//    검증 스크립트가 tsx로 단독 컴파일하고, 브라우저·노드 양쪽에서 같은 값을 읽어야 하기 때문.
//    (lib/merge.ts가 같은 이유로 순수를 유지하는 것과 같은 계약)

// ── 비율 판정 (collageTemplates.ts에서 재export해 기존 호출부 호환) ──

/** 세로로 긴 화면(폰·태블릿)은 상단 일부를 시계·위젯 영역으로 비운다 */
export const hasTopReserve = (aspect: number) => aspect < 0.75;
export const isLandscape = (aspect: number) => aspect > 1;

/** minDim(짧은 변)을 폭/높이로 나눈 정규화 계수.
 *  모든 여백을 이 계수로 곱하면 축과 무관하게 픽셀 등방이 된다 —
 *  v8.7까지는 여백이 폭 정규화라 16:9에서 좌우 38px / 상하 32px로 비대칭이었다 */
export const minDimNormX = (aspect: number) => Math.min(1, 1 / aspect);
export const minDimNormY = (aspect: number) => Math.min(aspect, 1);

// ══════════════════════════════════════════════════════════════════════
// v10 — 저스티파이드 배치 토큰
// v9의 그리드 토큰(GAP_RATIO·spacingFor·titleBottom·photoBounds·SPAN_CAP·MATTE_MAT_RATIO)은
// 여기서 전부 대체됐다. 특히 titleBottom(상단 15~22% 예약)이 사라진 게 사진 면적 증가의 원천이다.
// ══════════════════════════════════════════════════════════════════════

/** v10 템플릿. lib/types.ts의 CollageTemplate과 같은 유니온이지만 의존을 만들지 않는다 */
export type CollageTemplateId = 'editorial' | 'magazine' | 'studio';

/** 방향 분류 임계 — 이 값이 스튜디오 밴드의 경계를 정한다.
 *  4:5(0.8)는 세로로, 5:4(1.25)는 가로로 읽혀야 한다 */
export const PORTRAIT_R = 0.85;
export const LANDSCAPE_R = 1.18;

/** 갭 / minDim. 에디토리얼은 헤어라인(사진이 서로 맞닿는 느낌) */
const JUSTIFY_GAP: Record<CollageTemplateId, number> = {
  editorial: 0.008,
  magazine: 0.013,
  studio: 0.016,
};

/** 외곽 여백 / minDim. 에디토리얼 0 = 풀블리드(화면 끝까지 사진).
 *  ⚠️ 여백으로 템플릿을 구분하지 않는다 — 여백은 곧 사진 면적 손실이고, 그게 매트 갤러리가
 *  거부당한 이유다. 여기 값은 "성격"이 아니라 세 템플릿의 최소한의 숨 쉴 틈이다 */
const JUSTIFY_MARGIN: Record<CollageTemplateId, number> = {
  editorial: 0,
  magazine: 0.028,
  studio: 0.022,
};

/** 세로로 긴 화면(폰)에서 상단에 비워두는 몫 — 잠금화면 시계·위젯이 사진을 덮는 자리.
 *  v9의 titleBottom 0.22를 대체한다. 타이틀은 이제 사진 위에 얹히므로 이 예약은 시계 전용이다 */
export const SAFE_TOP = 0.1;

/** 사진이 놓이는 영역 (0..1 정규화). 타이틀은 이 위에 오버레이되므로 세로 예약이 없다 —
 *  v9 대비 사진 면적이 15~22% 늘어나는 지점이 바로 여기다 */
export function regionFor(template: CollageTemplateId, aspect: number): { x: number; y: number; w: number; h: number } {
  const nx = minDimNormX(aspect);
  const ny = minDimNormY(aspect);
  const mx = JUSTIFY_MARGIN[template] * nx;
  const my = JUSTIFY_MARGIN[template] * ny;
  const top = my + (hasTopReserve(aspect) ? SAFE_TOP : 0);
  return { x: mx, y: top, w: 1 - mx * 2, h: 1 - top - my };
}

/** 솔버에 넣을 수치 일체 (lib/collageJustify.ts JustifyOpts와 같은 모양).
 *
 *  ⚠️ 이 상수들은 눈대중이 아니다 — scripts/tune-justify.mjs가
 *  3 aspect × 3 template × n=1..18 × 5 비율믹스를 쓸어 역산했고,
 *  scripts/verify-justify.js가 그 결과를 계약으로 고정한다.
 *  손으로 조이면 "채움률 47%짜리 성긴 배치가 남는" v9의 실패를 되풀이한다. */
export function justifyOptsFor(
  template: CollageTemplateId,
  aspect: number,
  n: number,
  cropTol: number,
) {
  const nx = minDimNormX(aspect);
  const ny = minDimNormY(aspect);
  const g = JUSTIFY_GAP[template];
  // 사진이 적을 때는 가드레일을 풀어준다 — 1~3장은 크게 보이는 게 맞다 (v9 GUARDRAIL_MIN_ITEMS 계승)
  const loose = n < 4;
  return {
    aspect,
    gx: g * nx,
    gy: g * ny,
    cropTol,
    minRowH: loose ? 0 : 0.05,
    // ⚠️ 상한을 조이지 말 것. 저스티파이드에서 "높은 행"은 곧 "그 행에 사진이 적다"이고,
    //    그건 정당한 디자인 선택이다. v9의 photoBounds.maxH(0.55)를 그대로 가져왔다가
    //    세로 보드에서 후보가 전멸해 앰비언트가 63% 발동했다(tune 실측). 막아야 할 것은
    //    큰 사진이 아니라 **실오라기 같은 행**이므로, 실효 가드레일은 minRowH 쪽이다.
    maxRowH: loose ? 1 : 0.85,
    // ⚠️ 여기를 조이면 채움률이 무너진다. 0.085로 뒀더니 16:9에서 7~8장짜리 행이 전부 탈락해
    //    3행(크롭 29%)밖에 안 남았고, 결국 앰비언트로 떨어져 n=18 채움률이 0.64였다(tune 실측).
    //    0.05 = FHD에서 96px — 18장 보드의 세로 사진 폭으로 타당하다.
    minPhotoW: loose ? 0 : 0.05,
    maxPhotoW: 1,
    // 후보(=달성 가능한 자연높이 합)의 밀도가 곧 적합도다. 넉넉히 열어야 s가 1에 가까워진다.
    // 더 키워도 나아지지 않는다 — 4.0×/상한 12로 스윕했더니 실사용 채움률이 오히려 한 칸
    // 나빠졌다(tune 실측). 행이 지나치게 길어지면 사진이 잘아져 다른 가드레일에 걸린다
    maxPerRow: Math.max(2, Math.min(9, Math.round(2.6 * aspect + 3))),
    // 스튜디오는 밴드 대비(세로 밴드는 높고 가로 밴드는 낮게)를 **장려**한다 → 음수.
    // 에디토리얼은 고른 리듬을 선호 → 양수. 매거진은 행마다 장수가 섞여야 매거진처럼 보인다
    wVar: template === 'studio' ? -0.6 : template === 'editorial' ? 0.3 : 0,
    wVariety: template === 'magazine' ? -0.15 : 0,
    nodeBudget: 200_000,
  };
}

/** 탐색 상한. 솔버는 이 안에서 **최소 크롭 해**를 찾는다 —
 *  이산 tier를 여러 개 두는 것보다 정확하고 한 번만 돌면 된다 */
export const CROP_MAX = 0.35;

/** 이 이하면 "사실상 안 잘림"으로 보고 그대로 채택한다.
 *  v9는 세로 사진을 정사각 셀에 넣으며 40~55%를 잘라냈다 — 6%는 그에 비하면 없는 것과 같다 */
export const CROP_TOL = 0.06;

/** 크롭 c로 보드를 100% 채우기  vs  크롭 0으로 f만 채우고 나머지를 블러로 두기.
 *  "보이는 사진 내용량"으로 직접 비교한다: 전자는 (1 − c), 후자는 f.
 *  이 상수는 그 비교에 얹는 여유 — 같은 값이면 **자르지 않는 쪽**을 택한다(오너의 1순위 요구). */
export const CROP_VS_AMBIENT_BIAS = 0.02;

/** 히어로(매거진) 기하 한계. 이 밖이면 히어로를 포기하고 평평한 저스티파이드로 간다 */
export const HERO_TOP_MIN_R = 1.1;
export const HERO_MAX_H = 0.62;
export const HERO_MIN_W = 0.24;
export const HERO_MAX_W = 0.6;

// ── 타이틀 앵커 (v10) ──
// v9는 상단 15~22%를 통째로 비워 타이틀 밴드로 썼다. 그 예약을 없애고 사진 위에 카드로 얹으면
// 사진 면적이 그만큼 늘어난다. 어디에 얹을지는 사용자가 9점 중에 고른다 —
// 템플릿마다 기본값이 다른 게 세 템플릿을 한눈에 구분되게 만드는 축 하나다.

/** 9점 앵커. t/m/b(위·중간·아래) × l/c/r(왼쪽·가운데·오른쪽) */
export type TitleAnchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export const TITLE_ANCHORS: TitleAnchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

/** band = 세리프 대문자 + 큰 연도(중앙) / bold = 작은 eyebrow + 큰 연도(왼쪽) /
 *  line = 라벨과 연도가 한 줄에 나란히, 자간 넓은 얇은 스트립 */
export type TitleStyle = 'band' | 'bold' | 'line';
export const TITLE_STYLES: TitleStyle[] = ['band', 'bold', 'line'];

export const TEMPLATE_TITLE_DEFAULT: Record<CollageTemplateId, { anchor: TitleAnchor; style: TitleStyle }> = {
  editorial: { anchor: 'mc', style: 'band' },
  magazine: { anchor: 'tl', style: 'bold' },
  studio: { anchor: 'tc', style: 'line' },
};

export interface TitleBox {
  /** 카드 사각형 (0..1 정규화) */
  x: number;
  y: number;
  w: number;
  h: number;
  align: 'left' | 'center';
  /** 라벨/연도를 세로로 쌓을지, 한 줄에 나란히 둘지 */
  stack: 'v' | 'h';
  /** 폰트 크기 — minDim 비례 (DOM은 cqmin, canvas는 minDim×값) */
  labelRatio: number;
  yearRatio: number;
  /** 라벨 자간 (em) */
  tracking: number;
  /** 모서리 반경 — minDim 비례 */
  radius: number;
  /** 카드 안쪽 여백 (정규화) */
  padX: number;
  padY: number;
}

/** 카드가 보드 가장자리에서 떨어지는 거리 (minDim 비례) */
const TITLE_INSET = 0.05;

/**
 * 타이틀 카드의 기하. DOM(CollageBoard)과 canvas(wallpaper)가 **이 함수만** 호출한다 —
 * 픽셀 수치를 어느 한쪽에 직접 쓰면 화면과 저장 이미지가 조용히 갈라진다.
 *
 * ⚠️ 카드 배경에 backdrop-filter를 쓰지 말 것 — canvas로 재현할 수 없다. 불투명/반투명 단색만.
 */
export function titleBoxFor(style: TitleStyle, anchor: TitleAnchor, aspect: number): TitleBox {
  const nx = minDimNormX(aspect);
  const ny = minDimNormY(aspect);
  // 카드 크기는 minDim 비례로 잡고 축별 정규화 계수로 환산 — 어떤 비율에서도 같은 픽셀 모양
  const size =
    style === 'band'
      ? { w: 0.66, h: 0.2, labelRatio: 0.031, yearRatio: 0.072, tracking: 0.42, stack: 'v' as const, align: 'center' as const }
      : style === 'bold'
        ? { w: 0.46, h: 0.19, labelRatio: 0.022, yearRatio: 0.088, tracking: 0.2, stack: 'v' as const, align: 'left' as const }
        : { w: 0.78, h: 0.078, labelRatio: 0.026, yearRatio: 0.038, tracking: 0.34, stack: 'h' as const, align: 'center' as const };

  const w = Math.min(0.92, size.w * nx);
  const h = Math.min(0.5, size.h * ny);
  const insetX = TITLE_INSET * nx;
  const insetY = TITLE_INSET * ny;

  const col = anchor[1];
  const row = anchor[0];
  const x = col === 'l' ? insetX : col === 'r' ? 1 - insetX - w : (1 - w) / 2;
  const y = row === 't' ? insetY : row === 'b' ? 1 - insetY - h : (1 - h) / 2;

  return {
    x,
    y,
    w,
    h,
    align: size.align,
    stack: size.stack,
    labelRatio: size.labelRatio,
    yearRatio: size.yearRatio,
    tracking: size.tracking,
    radius: style === 'line' ? 0.012 : 0.008,
    padX: 0.05 * nx,
    padY: 0.028 * ny,
  };
}

/** 저장된 앵커·스타일을 화이트리스트로 검증 — 손상된 데이터가 렌더를 깨뜨리지 않는다 */
export function normalizeTitle(
  t: { anchor?: string; style?: string } | undefined,
  template: CollageTemplateId,
): { anchor: TitleAnchor; style: TitleStyle } {
  const d = TEMPLATE_TITLE_DEFAULT[template];
  const anchor = TITLE_ANCHORS.includes(t?.anchor as TitleAnchor) ? (t!.anchor as TitleAnchor) : d.anchor;
  const style = TITLE_STYLES.includes(t?.style as TitleStyle) ? (t!.style as TitleStyle) : d.style;
  return { anchor, style };
}

/** 앰비언트 배경 — 블러 반경 / minDim, 배경 위에 덮는 스크림 알파, 엣지 블리드 확대율 */
export const BLUR_RATIO = 0.06;
export const AMBIENT_SCRIM_ALPHA = 0.28;
export const AMBIENT_SCALE = 1.12;

// ── 렌더 상수 ──

/** 사진 모서리 반경 / 사진 폭 */
export const PHOTO_RADIUS_RATIO = 0.06;


// ── 배경색 팔레트 (세 템플릿 공통) ──
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
export const TEMPLATE_DEFAULT_BG: Record<CollageTemplateId, string> = {
  editorial: '#FAF9F7',
  magazine: '#FFFFFF',
  studio: '#F4F1EC',
};

/** 저장된 배경색을 팔레트 화이트리스트로 검증. 미지 값이면 템플릿 기본색 —
 *  손상된 데이터가 렌더를 깨뜨리지 않는다 */
export function normalizeBgColor(bg: string | undefined, template: CollageTemplateId): string {
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
