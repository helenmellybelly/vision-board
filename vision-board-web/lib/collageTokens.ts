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

/** 히어로 기하 한계. 이 밖이면 히어로를 포기하고 평평한 저스티파이드로 간다 */
export const HERO_TOP_MIN_R = 1.1;
export const HERO_MAX_H = 0.62;
export const HERO_MIN_W = 0.24;

/**
 * 히어로 폭 상한 — **템플릿마다 다르다.**
 *
 * 정사각 사진(그리고 치수 미측정 기본값 1.0)의 좌측 풀하이트 히어로는 16:9에서 폭이 0.53까지
 * 나온다. 매거진에서는 그게 "한 장이 주인공"이라는 정체성 그 자체지만, 에디토리얼에서는
 * 한 장이 보드의 절반을 먹고 나머지 17장이 0.6%까지 잘아진다(실측) — "순서대로 조밀"이라는
 * 정체성과 정면으로 충돌한다.
 *
 * 에디토리얼·스튜디오에 히어로를 연 이유는 미학이 아니라 기하(행 스택만으로 못 메우는 구간)였으므로,
 * **얌전한 히어로만** 허용한다. 세로 사진이면 폭이 자연히 작아 이 상한 안에 들어온다.
 */
export const heroMaxWFor = (template: CollageTemplateId): number =>
  template === 'magazine' ? 0.6 : 0.42;

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

// ══════════════════════════════════════════════════════════════════════
// v12 — 문구 스티커 조판
//
// 왜 여기로 왔나: "스티커의 높이"를 네 곳이 각자 계산하고 있었다 —
//   ① CollageBoard 클램프의 `it.w * aspect`(정사각 가정)
//   ② collageTemplates placeNewItems의 `it.w * 0.35`
//   ③ wallpaper drawSticker의 `lines * lineH + padY * 2`
//   ④ DOM의 자동 높이(내용이 정한다)
// ③이 정답이고 ①②는 근사였다. 실측하면 chip 1줄의 실제 높이는 ①의 0.26배 —
// 즉 w=0.44 스티커가 높이 5%인데 20%를 예약당해 **보드 하단 20%에 문구를 놓을 수가 없었다**.
// 반대로 여러 줄이면 정사각을 넘어 아래가 잘렸다. 한 상수가 양방향으로 틀려 있었던 것.
// 이제 ①②③이 전부 stickerHeightNorm 하나를 부른다.
//
// ⚠️ 아래 수치는 DOM(StickerView의 Tailwind 클래스)과 canvas(drawSticker) 양쪽의
//    **실제 값**이다. 한쪽을 바꾸면 나머지 둘도 같이 바꿔야 한다 —
//    scripts/verify-sticker.js S-1이 그 일치를 계약으로 잠근다.
// ══════════════════════════════════════════════════════════════════════

/** lib/types.ts의 StickerStyle과 같은 유니온이지만 의존을 만들지 않는다 (CollageTemplateId와 같은 이유) */
export type StickerStyleId = 'script' | 'chip' | 'outline';

/** 글자 크기 = 항목 폭(it.w) × 보드 폭 × 비율 — DOM은 cqi, canvas는 px로 같은 식을 쓴다 */
export const STICKER_FONT_RATIO: Record<StickerStyleId, number> = {
  script: 0.17,
  chip: 0.11,
  outline: 0.15,
};

/** 줄 높이 (em). DOM: chip=leading-snug(1.375) · outline/script=leading-tight(1.25) */
export const STICKER_LINE_H: Record<StickerStyleId, number> = {
  script: 1.25,
  chip: 1.375,
  outline: 1.25,
};

/** 세로 여백 합계 (em). chip만 py-[0.5em] 위아래 = 1.0, 나머지는 박스가 없다 */
export const STICKER_PAD_EM: Record<StickerStyleId, number> = {
  script: 0,
  chip: 1,
  outline: 0,
};

/** 가로 여백 한쪽 (em). chip의 px-[0.7em] — canvas wrapText의 maxW 계산과 락스텝 */
export const STICKER_PAD_X_EM: Record<StickerStyleId, number> = {
  script: 0,
  chip: 0.7,
  outline: 0,
};

/** 문구 상한 — v11까지 40자 1줄이었다. 인라인 편집(v12)에서 줄바꿈이 열리며 함께 완화 */
export const STICKER_MAX_CHARS = 120;
export const STICKER_MAX_LINES = 6;

/**
 * 스티커의 정규화 높이(보드 높이 대비).
 * 클램프 · placeNewItems · canvas boxH가 전부 이 식만 쓴다.
 *
 * lines는 **하드 브레이크(\n) 기준 하한**이다 — 소프트랩까지 세려면 렌더러의 measureText가
 * 필요하고 그건 순수 모듈이 할 수 없는 일이다. 호출부(CollageBoard)는 실측 높이와
 * `Math.max`로 묶어 안전망을 만든다. 공식이 단일 정의이고 실측은 상한일 뿐이라
 * "두 곳이 각자 계산한다"로 되돌아가지 않는다.
 */
export function stickerHeightNorm(
  style: StickerStyleId,
  lines: number,
  w: number,
  aspect: number,
): number {
  const font = w * STICKER_FONT_RATIO[style];
  const n = Math.max(1, Math.floor(lines));
  return font * (STICKER_LINE_H[style] * n + STICKER_PAD_EM[style]) * aspect;
}

/** 하드 브레이크 기준 줄 수 — wrapStickerText가 세그먼트를 나누는 기준과 같다 */
export function stickerLineCount(text: string): number {
  if (!text) return 1;
  return Math.max(1, text.split('\n').length);
}

/**
 * 문구 줄바꿈 (v12) — 하드 브레이크(\n)를 먼저 자르고, 각 세그먼트를 폭에 맞춰 소프트랩한다.
 *
 * `measure`를 콜백으로 받는 이유: canvas는 `ctx.measureText(s).width`를 쓰고 검증 스크립트는
 * 결정적 스텁을 쓴다. 실제 줄바꿈 **로직**은 한 벌만 존재해야 하므로 폭 재기만 밖으로 뺐다.
 *
 * ⚠️ 순서가 계약이다. 소프트랩을 먼저 돌리면 `\n`이 한 단어의 일부로 measure에 들어가
 *    폭 계산이 어긋나고, 사용자가 의도한 줄바꿈 지점이 사라진다.
 * ⚠️ 빈 줄은 보존한다 — 사용자가 넣은 여백이다.
 * ⚠️ 반환된 어느 줄에도 `\n`이 남으면 안 된다(canvas fillText가 조용히 뭉갠다).
 *    scripts/verify-sticker.js S-5가 이 셋을 계약으로 잠근다.
 */
export function wrapStickerText(
  text: string,
  maxW: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const seg of text.split('\n')) {
    let line = '';
    /** glue: 단어 사이는 공백, **글자 분해는 빈 문자열**.
     *  ⚠️ v11까지 둘 다 공백으로 이어 붙였다 — 그래서 공백 없는 긴 한국어가 글자 단위로 쪼개질 때
     *     저장 이미지에 "자 라 나 는 중"처럼 글자 사이 공백이 끼었다(화면에는 안 끼므로 육안으로만 보이는 종류) */
    const push = (chunk: string, glue: string) => {
      const tryLine = line ? `${line}${glue}${chunk}` : chunk;
      if (measure(tryLine) <= maxW || !line) {
        line = tryLine;
      } else {
        out.push(line);
        line = chunk;
      }
    };
    const before = out.length;
    for (const word of seg.split(' ')) {
      // 공백 없는 긴 한국어/영문은 글자 단위로 쪼갠다
      if (measure(word) > maxW) for (const ch of word) push(ch, '');
      else push(word, ' ');
    }
    if (line) out.push(line);
    // 세그먼트가 통째로 비었으면(사용자가 넣은 빈 줄) 한 줄을 되살린다
    if (out.length === before) out.push('');
  }
  return out.length ? out : [''];
}

/**
 * 저장 직전 문구 정규화 — DOM(contentEditable innerText)과 canvas가 같은 문자열을 본다.
 * 멱등: normalize(normalize(t)) === normalize(t).
 *
 * ⚠️ 줄 단위로 자른 뒤 다시 글자수를 자르면 안 된다(줄 경계가 흐트러진다).
 *    글자수 → 줄 수 순서가 계약이다.
 */
export function normalizeStickerText(text: string): string {
  const flat = text
    .replace(/\r\n?/g, '\n')
    // 세로탭·폼피드도 개행으로 접는다 (contentEditable이 붙여넣기에서 흘려보낸다)
    .replace(/[\v\f]/g, '\n')
    .replace(/[ \t]+$/gm, '');
  const capped = flat.slice(0, STICKER_MAX_CHARS);
  const lines = capped.split('\n').slice(0, STICKER_MAX_LINES);
  // 앞뒤 빈 줄만 털고 가운데 빈 줄은 보존한다 — 사용자가 의도한 여백일 수 있다
  while (lines.length > 1 && lines[0].trim() === '') lines.shift();
  while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n').trim() === '' ? '' : lines.join('\n');
}


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

// ══════════════════════════════════════════════════════════════════════
// v11 — 타이틀 커스터마이즈
//
// v10의 타이틀은 "9점 앵커 × 3스타일" 프리셋 덩어리였다. 크기·투명도·표시요소·가로세로가
// 전부 여기 상수로 고정이라 사용자가 손댈 여지가 없었고, 정중앙 밴드가 사진 한 장을
// 통째로 덮는 걸 피할 방법이 없었다(오너 실사용 지적).
//
// v11의 두 축:
//  ① 카드 크기를 **글자 내용에서 계산**한다 — 그래야 '연도만'이면 카드가 줄고,
//     '가로 배치'면 넓은 스트립이 된다. 스타일별 w/h 테이블 24칸을 눈대중으로 채우지 않는다.
//  ② 렌더러(DOM·canvas)는 **표시 리스트(TitleLayout)를 그리기만** 한다. 좌표 산술을 양쪽에
//     두면 반드시 갈라진다 — v10에서 이미 세 곳(세로정렬·연도 자간·padY)이 어긋나 있었다.
// ══════════════════════════════════════════════════════════════════════

/** 라벨/연도를 세로로 쌓을지, 한 줄에 나란히 둘지. v10에서는 style에 종속이었다 */
export type TitleDir = 'v' | 'h';
export type TitleParts = 'all' | 'label' | 'year' | 'none';
/** solid = 거의 불투명 카드(v10 동작) / soft = 반투명 / clear = 카드 없이 글자만 */
export type TitleBg = 'solid' | 'soft' | 'clear';
export type TitleInkMode = 'auto' | 'light' | 'dark';

export const TITLE_DIRS: TitleDir[] = ['v', 'h'];
export const TITLE_PARTS: TitleParts[] = ['all', 'label', 'year', 'none'];
export const TITLE_BGS: TitleBg[] = ['solid', 'soft', 'clear'];
export const TITLE_INK_MODES: TitleInkMode[] = ['auto', 'light', 'dark'];

/** 라벨 문구는 고정 — 나만의 문구가 필요하면 스티커('+ 문구')를 쓴다.
 *  canvas가 그리는 문자열이자 advance 실측의 기준이다 */
export const TITLE_LABEL_TEXT = 'VISION BOARD';

// ── 폰트 실측 상수 (scripts/tune-title.mjs --fonts 산출물) ──
// ⚠️ 눈대중 금지. Pretendard Variable 600 / Enjoystories 700을 실제로 로드해
//    measureText로 잰 값이다. 폰트를 바꾸면 스크립트를 다시 돌려 갱신할 것.

/** 'VISION BOARD'의 자간 0 advance (em). 커닝이 반영된 문자열 폭이라 글자합(6.917)과 다르다 */
export const TITLE_LABEL_ADVANCE_EM = 6.879;
/** 라벨 글자 수 — 자간은 **마지막 글자 뒤에도** 붙는다(CSS·canvas 공통, 실측 확인). 그래서 n배 */
export const TITLE_LABEL_CHARS = TITLE_LABEL_TEXT.length;
/** 숫자 1자 최대폭 (em). 어떤 연도가 와도 넘치지 않게 최대값을 쓴다 */
export const TITLE_YEAR_ADVANCE_EM = 0.38;
/** ink(실제 글자) 높이 — font box가 아니라 잉크 기준이라 카드가 글자에 딱 붙는다 */
export const TITLE_INK_H_SANS = 0.73;
export const TITLE_INK_H_SCRIPT = 0.73;

// ── 조판 리듬 (타이포 선택 — 가드레일이 아니다) ──
/** 라벨↔연도 세로 간격 / labelSize. verify-title이 [0.5, 2.0] 범위를 지켜 드리프트를 막는다 */
const TITLE_GAP_V = 0.8;
/** 라벨↔연도 가로 간격 / labelSize */
const TITLE_GAP_H = 1.6;
/** 카드 안쪽 여백 (minDim 비례, 배율과 함께 커진다) — v10 값 계승 */
const TITLE_PAD_X = 0.05;
const TITLE_PAD_Y = 0.028;

// ── 크기 정규화 ──
// ⚠️ 아래 셋은 눈대중이 아니다. scripts/tune-title.mjs가 9프리셋 × 3템플릿 × β·fmax·배율
//    2,772조합을 쓸어 역산했다. 목적함수는 "연도 ink 높이 / 보드 대각선"(=존재감)의
//    **템플릿별 변동계수 평균 최소화**이고, 하드 제약은
//    화면 라벨 ≥11px(text-micro) · 화면 연도 ≥20px · 내보내기 연도 ≥28px · 카드 면적 ≤14%다.
//    채택안(β0.95 / fmax1.50 / 1.25)에서 존재감 편차가 1.66배 → 1.24배로 줄었다
//    (오너가 "모바일에서만 타이틀이 작다"고 지적한 그 편차다).

/** 세로/가로로 긴 보드에서 타이틀을 키우는 정도. 0이면 v10과 동일(짧은 변 순수 비례) */
export const TITLE_UNIT_BETA = 0.95;
/** 그 상한 — 울트라와이드·Z플립 메인처럼 극단적인 비율에서 무한정 커지지 않게 */
export const TITLE_UNIT_FMAX = 1.5;
/** 전 보드 공통 기본 배율. 이 값을 정한 건 스튜디오(라인 스타일)의 연도가 폰 미리보기에서
 *  20px을 넘어야 한다는 제약이다 — 오너가 "스튜디오 연도가 너무 작다"고 지적한 지점 */
export const TITLE_BASE_SCALE = 1.25;

export const TITLE_SCALE_MIN = 0.7;
export const TITLE_SCALE_MAX = 1.8;

/** 카드 폭/높이 상한 (정규화). 여기 걸리면 박스를 자르는 게 아니라 **배율을 낮춘다** —
 *  자르면 글자만 커지고 카드는 안 커져 텍스트가 넘친다 */
const TITLE_W_CAP = 0.92;
const TITLE_H_CAP = 0.5;

/**
 * 타이틀 전용 정규화 계수 (minDim 배수).
 *
 * 왜 필요한가: 짧은 변 비례는 "긴 변 대비 존재감"을 보존하지 않는다. 실측하면 연도 높이 /
 * 보드 대각선이 폰 0.030 · FHD 0.037 · Z플립커버 0.055로 1.8배까지 벌어진다 —
 * 오너가 겪은 "모바일에서만 타이틀이 너무 작다"의 정량적 실체다.
 *
 * ⚠️ 하한을 1로 클램프한다. 순수 기하평균 정규화로 바꾸면 정사각에 가까운 보드
 *    (Z플립 커버)가 −24%로 **작아지는** 부작용이 생긴다.
 * ⚠️ 반환이 minDim **배수**라 렌더러의 단위 의미가 안 바뀐다 — DOM은 계속 cqmin,
 *    canvas는 계속 minDim을 곱한다. CSS로 sqrt(cqw*cqh)를 못 쓰므로 이게 유일한 락스텝 해법.
 */
export function titleUnit(aspect: number): number {
  const r = Math.sqrt(Math.max(aspect, 1 / aspect));
  return Math.min(TITLE_UNIT_FMAX, 1 + TITLE_UNIT_BETA * (r - 1));
}

/** 카드 배경 알파 — 테마별. soft 값은 §compositeContrast 계약(최악 사진 양쪽에서 ≥3.0)이 정한다 */
export const TITLE_CARD_ALPHA: Record<TitleBg, { light: number; dark: number }> = {
  solid: { light: 0.96, dark: 0.94 },
  soft: { light: 0.55, dark: 0.55 },
  clear: { light: 0, dark: 0 },
};
/** 카드 바탕색 — themeFor의 cardBg가 이 값에서 파생된다(정의 중복 제거) */
export const TITLE_CARD_HEX = { light: '#FFFFFF', dark: '#141312' };
export const TITLE_BORDER_HEX = { light: '#1C1B19', dark: '#FFFFFF' };
export const TITLE_BORDER_ALPHA = { light: 0.06, dark: 0.1 };
/** 투명 배경일 때 글자 그림자 — minDim 비례. DOM textShadow ↔ canvas shadow*가 같은 수치를 쓴다 */
export const TITLE_SHADOW = { blur: 0.018, dy: 0.004, alpha: 0.55 };

/** 알파 합성 위 글자의 WCAG 대비.
 *
 *  ⚠️ 합성은 **sRGB 감마 공간**에서 한다 — 브라우저 알파 합성도 canvas 2D 합성도 선형광이 아니다.
 *     채널을 먼저 섞고 **그다음** 휘도를 계산해야 맞다. 선형광으로 잘못 계산하면 다크 반투명이
 *     2.09로 나와 알파를 0.75까지 올리게 되고, "반투명인데 거의 불투명"이 된다. */
export function compositeContrast(
  cardHex: string,
  alpha: number,
  behindHex: string,
  inkHex: string,
): number {
  const rgb = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const a = rgb(cardHex);
  const b = rgb(behindHex);
  const mix = a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  const hex = '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
  return contrastRatio(hex, inkHex);
}

export interface TitleConfig {
  style: TitleStyle;
  anchor: TitleAnchor;
  dir: TitleDir;
  parts: TitleParts;
  bg: TitleBg;
  ink: TitleInkMode;
  scale: number;
  /** 자유 좌표(카드 좌상단, 0..1). 있으면 anchor를 무시한다 */
  pos?: { x: number; y: number };
}

export interface TitleLine {
  kind: 'label' | 'year';
  /** 글자 기준점 (보드 0..1) — align 기준 */
  x: number;
  /** 세로 중심선 (보드 0..1) — DOM은 translateY(-50%), canvas는 textBaseline='middle' */
  cy: number;
  align: 'left' | 'center' | 'right';
  /** 폰트 크기 — minDim 비례 (DOM cqmin, canvas minDim×값). 배율·정규화가 이미 반영돼 있다 */
  size: number;
  tracking: number;
  font: 'sans' | 'script';
  weight: 600 | 700;
  color: string;
}

export interface TitleLayout {
  /** parts==='none'이면 false — 두 렌더러 모두 아무것도 그리지 않는다 */
  visible: boolean;
  box: { x: number; y: number; w: number; h: number };
  /** 모서리 반경 — minDim 비례 */
  radius: number;
  /** 카드 색 (알파 포함). alpha 0이면 카드를 아예 안 그린다 */
  card: { color: string; alpha: number };
  border: { color: string; alpha: number };
  /** 글자 그림자 — blur·dy는 minDim 비례. 카드가 투명할 때만 있다 */
  shadow?: { blur: number; dy: number; color: string };
  /** 어두운 바탕인가 — 사진 그림자/링 전환에 쓰인다 */
  dark: boolean;
  lines: TitleLine[];
  /** 실제 적용된 배율 (상한에 걸려 요청보다 작을 수 있다) — 리사이즈 UI가 한계를 알린다 */
  effScale: number;
}

/** 스타일 = 타이포 정체성만. 카드 크기는 여기서 정하지 않는다(내용에서 계산) */
const TITLE_TYPE: Record<
  TitleStyle,
  { labelRatio: number; yearRatio: number; tracking: number; align: 'left' | 'center'; dir: TitleDir; radius: number }
> = {
  band: { labelRatio: 0.031, yearRatio: 0.072, tracking: 0.42, align: 'center', dir: 'v', radius: 0.008 },
  bold: { labelRatio: 0.022, yearRatio: 0.088, tracking: 0.2, align: 'left', dir: 'v', radius: 0.008 },
  line: { labelRatio: 0.026, yearRatio: 0.038, tracking: 0.34, align: 'center', dir: 'h', radius: 0.012 },
};

const clamp01 = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 기본 카드 배경 (v11) — v10은 solid였다. 거의 불투명한 카드가 사진 한 장을 통째로 덮는 게
 *  오너가 제기한 문제라 기본을 반투명으로 내렸다. 최악 사진 양쪽에서 대비 ≥3.0은 계약으로 고정 */
export const TITLE_DEFAULT_BG: TitleBg = 'soft';

/** 저장값(기기별 위치 + 전역 모양)을 화이트리스트 검증해 완전한 설정으로 접는다.
 *  미설정 필드는 **템플릿 기본값**으로 — 그래야 세 템플릿이 계속 서로 달라 보인다
 *  (collageBgColor가 TEMPLATE_DEFAULT_BG로 접히는 것과 같은 계약) */
export function resolveTitleConfig(
  saved: { anchor?: string; pos?: { x?: number; y?: number } | null } | undefined,
  global:
    | { style?: string; dir?: string; parts?: string; bg?: string; ink?: string; scale?: number }
    | undefined,
  template: CollageTemplateId,
): TitleConfig {
  const d = TEMPLATE_TITLE_DEFAULT[template];
  const style = TITLE_STYLES.includes(global?.style as TitleStyle) ? (global!.style as TitleStyle) : d.style;
  const anchor = TITLE_ANCHORS.includes(saved?.anchor as TitleAnchor) ? (saved!.anchor as TitleAnchor) : d.anchor;
  const p = saved?.pos;
  const pos =
    p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: Number(p.x), y: Number(p.y) } : undefined;
  return {
    style,
    anchor,
    dir: TITLE_DIRS.includes(global?.dir as TitleDir) ? (global!.dir as TitleDir) : TITLE_TYPE[style].dir,
    parts: TITLE_PARTS.includes(global?.parts as TitleParts) ? (global!.parts as TitleParts) : 'all',
    bg: TITLE_BGS.includes(global?.bg as TitleBg) ? (global!.bg as TitleBg) : TITLE_DEFAULT_BG,
    ink: TITLE_INK_MODES.includes(global?.ink as TitleInkMode) ? (global!.ink as TitleInkMode) : 'auto',
    scale: Number.isFinite(global?.scale)
      ? clamp01(Number(global!.scale), TITLE_SCALE_MIN, TITLE_SCALE_MAX)
      : 1,
    pos,
  };
}

/**
 * 반투명·투명 카드의 라벨 잉크.
 *
 * ⚠️ v10의 라벨 회색(#6E6962 / #C4C2BE)을 그대로 쓰면 안 된다 — 그건 **거의 불투명한** 카드
 *    위에서만 성립하는 색이다. 반투명 카드 뒤로 검은 사진이 비치면 대비가 1.62까지 떨어진다
 *    (verify-title ⑩이 실제로 잡아낸 값). 반투명에서는 보조 텍스트도 본문급 잉크여야 한다.
 */
const TITLE_LABEL_INK_TRANSLUCENT = { light: '#3A3733', dark: '#EDEBE8' };

function resolveTitleInk(cfg: TitleConfig, bgHex: string): TitleInk {
  if (cfg.ink === 'light') {
    return { title: '#FFFFFF', label: TITLE_LABEL_INK_TRANSLUCENT.dark, dark: true };
  }
  if (cfg.ink === 'dark') {
    return { title: '#1C1B19', label: TITLE_LABEL_INK_TRANSLUCENT.light, dark: false };
  }
  // auto — 카드가 없으면 뒤가 사진이다. 사진 휘도는 알 수 없으므로(픽셀 샘플링은 DOM에서
  // 교차출처 때문에 불가능하고, canvas만 가능하면 두 렌더러가 갈린다) 적중률이 가장 높은
  // 흰 글자 + 어두운 그림자로 간다.
  if (cfg.bg === 'clear') {
    return { title: '#FFFFFF', label: TITLE_LABEL_INK_TRANSLUCENT.dark, dark: true };
  }
  const base = titleInkFor(bgHex);
  if (cfg.bg === 'solid') return base;
  return { ...base, label: base.dark ? TITLE_LABEL_INK_TRANSLUCENT.dark : TITLE_LABEL_INK_TRANSLUCENT.light };
}

/**
 * 타이틀 카드의 기하·색 일체. DOM(CollageBoard)과 canvas(wallpaper)가 **이 함수만** 호출하고
 * 반환된 표시 리스트를 그리기만 한다 — 렌더러에 좌표 산술을 두면 조용히 갈라진다.
 *
 * ⚠️ 카드 배경에 backdrop-filter를 쓰지 말 것 — canvas로 재현할 수 없다. 불투명/반투명 단색만.
 */
export function titleLayoutFor(cfg: TitleConfig, aspect: number, bgHex: string): TitleLayout {
  const T = TITLE_TYPE[cfg.style];
  const ink = resolveTitleInk(cfg, bgHex);
  // ⚠️ 카드 색은 **보드 테마**를 따른다 — 글자색 수동 반전(ink: light/dark)이 카드까지 뒤집으면
  //    "글자만 밝게" 같은 의도가 카드 반전으로 새어 나간다
  const themeKey = relativeLuminance(bgHex) < 0.45 ? 'dark' : 'light';
  const card = { color: TITLE_CARD_HEX[themeKey], alpha: TITLE_CARD_ALPHA[cfg.bg][themeKey] };
  const border = {
    color: TITLE_BORDER_HEX[themeKey],
    alpha: cfg.bg === 'clear' ? 0 : TITLE_BORDER_ALPHA[themeKey],
  };
  const shadow =
    cfg.bg === 'clear'
      ? {
          blur: TITLE_SHADOW.blur,
          dy: TITLE_SHADOW.dy,
          color: ink.dark ? `rgba(0,0,0,${TITLE_SHADOW.alpha})` : `rgba(255,255,255,${TITLE_SHADOW.alpha})`,
        }
      : undefined;

  const nx = minDimNormX(aspect);
  const ny = minDimNormY(aspect);

  if (cfg.parts === 'none') {
    return {
      visible: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
      radius: 0,
      card: { color: card.color, alpha: 0 },
      border: { color: border.color, alpha: 0 },
      dark: ink.dark,
      lines: [],
      effScale: 0,
    };
  }

  const showLabel = cfg.parts === 'all' || cfg.parts === 'label';
  const showYear = cfg.parts === 'all' || cfg.parts === 'year';

  // ── 배율 1에서의 내용 치수 (minDim 단위) ──
  const l1 = T.labelRatio;
  const y1 = T.yearRatio;
  const labelAdv1 = l1 * (TITLE_LABEL_ADVANCE_EM + T.tracking * TITLE_LABEL_CHARS);
  const yearAdv1 = y1 * TITLE_YEAR_ADVANCE_EM * 4;
  const labelH1 = l1 * TITLE_INK_H_SANS;
  const yearH1 = y1 * TITLE_INK_H_SCRIPT;
  const gap1 = showLabel && showYear ? (cfg.dir === 'v' ? TITLE_GAP_V : TITLE_GAP_H) * l1 : 0;

  const wIn1 =
    cfg.dir === 'v'
      ? Math.max(showLabel ? labelAdv1 : 0, showYear ? yearAdv1 : 0)
      : (showLabel ? labelAdv1 : 0) + gap1 + (showYear ? yearAdv1 : 0);
  const hIn1 =
    cfg.dir === 'v'
      ? (showLabel ? labelH1 : 0) + gap1 + (showYear ? yearH1 : 0)
      : Math.max(showLabel ? labelH1 : 0, showYear ? yearH1 : 0);

  const W1 = (wIn1 + 2 * TITLE_PAD_X) * nx;
  const H1 = (hIn1 + 2 * TITLE_PAD_Y) * ny;

  // 상한은 박스를 자르는 게 아니라 **배율을 낮춰서** 지킨다
  const want = clamp01(cfg.scale, TITLE_SCALE_MIN, TITLE_SCALE_MAX) * TITLE_BASE_SCALE * titleUnit(aspect);
  const eff = Math.min(want, TITLE_W_CAP / W1, TITLE_H_CAP / H1);

  const w = W1 * eff;
  const h = H1 * eff;
  const padX = TITLE_PAD_X * eff * nx;
  const padY = TITLE_PAD_Y * eff * ny;
  const insetX = TITLE_INSET * nx;
  const insetY = TITLE_INSET * ny;

  // pos가 있으면 자유 좌표. ⚠️ 클램프를 여기서 하므로 aspect가 바뀌거나(기기 프리셋 변경)
  //   스타일 변경으로 카드가 커져도 보드 밖으로 나가지 않는다 — 호출부 방어코드 불필요
  const col = cfg.anchor[1];
  const row = cfg.anchor[0];
  const x = cfg.pos
    ? clamp01(cfg.pos.x, 0, Math.max(0, 1 - w))
    : col === 'l'
      ? insetX
      : col === 'r'
        ? 1 - insetX - w
        : (1 - w) / 2;
  const y = cfg.pos
    ? clamp01(cfg.pos.y, 0, Math.max(0, 1 - h))
    : row === 't'
      ? insetY
      : row === 'b'
        ? 1 - insetY - h
        : (1 - h) / 2;

  const labelSize = l1 * eff;
  const yearSize = y1 * eff;
  const labelH = labelH1 * eff * ny;
  const yearH = yearH1 * eff * ny;
  const gap = gap1 * eff * ny;

  const lines: TitleLine[] = [];
  const both = showLabel && showYear;

  if (cfg.dir === 'h') {
    // 한 줄에 나란히 — 박스가 내용을 딱 감싸므로 space-between이 곧 인접 배치다
    const cy = y + h / 2;
    if (showLabel) {
      lines.push({
        kind: 'label',
        x: x + padX,
        cy,
        align: 'left',
        size: labelSize,
        tracking: T.tracking,
        font: 'sans',
        weight: 600,
        color: ink.label,
      });
    }
    if (showYear) {
      lines.push({
        kind: 'year',
        x: both ? x + w - padX : x + w / 2,
        cy,
        align: both ? 'right' : 'center',
        size: yearSize,
        tracking: 0,
        font: 'script',
        weight: 700,
        color: ink.title,
      });
    }
  } else {
    const lineX = T.align === 'left' ? x + padX : x + w / 2;
    const align: 'left' | 'center' = T.align === 'left' ? 'left' : 'center';
    if (showLabel) {
      lines.push({
        kind: 'label',
        x: lineX,
        cy: both ? y + padY + labelH / 2 : y + h / 2,
        align,
        size: labelSize,
        tracking: T.tracking,
        font: 'sans',
        weight: 600,
        color: ink.label,
      });
    }
    if (showYear) {
      lines.push({
        kind: 'year',
        x: lineX,
        cy: both ? y + padY + labelH + gap + yearH / 2 : y + h / 2,
        align,
        size: yearSize,
        tracking: 0,
        font: 'script',
        weight: 700,
        color: ink.title,
      });
    }
  }

  return {
    visible: true,
    box: { x, y, w, h },
    radius: T.radius * eff,
    card,
    border,
    shadow,
    dark: ink.dark,
    lines,
    effScale: eff,
  };
}

/** 자유 좌표를 가장 가까운 9점 앵커로 되돌린다 ('깔끔한 자리로') */
export function nearestAnchor(box: { x: number; y: number; w: number; h: number }): TitleAnchor {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const col = cx < 1 / 3 ? 'l' : cx > 2 / 3 ? 'r' : 'c';
  const row = cy < 1 / 3 ? 't' : cy > 2 / 3 ? 'b' : 'm';
  return `${row}${col}` as TitleAnchor;
}
