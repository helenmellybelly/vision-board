// 배경화면 캔버스 렌더링 — /collage '배경화면으로 저장' 시트에서 사용
// 외부 라이브러리 없이 Canvas API로 직접 그린다.
// 사이즈를 먼저 고르고 그 비율 그대로 편집하므로, 선택한 해상도로 직접 그린다(무크롭 WYSIWYG, v6.19).
import { BoardData, CollageLayout, CollageSticker, CollageTemplate } from './types';
import { CollageItem, themeFor, titleFor } from './collageTemplates';
import {
  AMBIENT_SCALE,
  AMBIENT_SCRIM_ALPHA,
  PHOTO_RADIUS_RATIO,
  STICKER_FONT_RATIO,
  STICKER_LINE_H,
  STICKER_PAD_EM,
  STICKER_PAD_X_EM,
  TITLE_LABEL_TEXT,
  TitleLayout,
  titleLayoutFor,
  wrapStickerText,
} from './collageTokens';
import { ICONS, hasPath2D, isIconId } from './stickerArt';
import { bustedSrc, displaySrc } from './imageSrc';
// 사진 18장이 한꺼번에 몰려 서로를 타임아웃시키는 걸 막는다 (v8.7 → v10에서 순수 모듈로 추출)
import { mapLimit } from './mapLimit';

// ── 기기별 사이즈 프리셋 — 편집 진입 전에 고르고, 편집·내보내기 모두 이 비율을 쓴다 (v6.19) ──
export interface WallpaperPreset {
  id: string;
  label: string;
  /** 칩 행 표시용 짧은 라벨 (v7.3) — 없으면 label 사용 */
  shortLabel?: string;
  w: number;
  h: number;
  group: '휴대폰' | '태블릿' | 'PC';
  note?: string; // 비율 특성 안내
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'phone', label: '기본 폰 (9:19.5)', shortLabel: '기본 폰', w: 1170, h: 2532, group: '휴대폰' },
  { id: 'iphone', label: 'iPhone 일반·Pro', shortLabel: 'iPhone', w: 1179, h: 2556, group: '휴대폰' },
  { id: 'iphone-max', label: 'iPhone Plus·Pro Max', shortLabel: 'iPhone Max', w: 1290, h: 2796, group: '휴대폰' },
  { id: 'galaxy-s', label: 'Galaxy S 시리즈', shortLabel: 'Galaxy S', w: 1080, h: 2340, group: '휴대폰' },
  { id: 'zflip-main', label: 'Galaxy Z Flip 메인', shortLabel: 'Z Flip', w: 1080, h: 2640, group: '휴대폰' },
  { id: 'zflip-cover', label: 'Galaxy Z Flip 커버', shortLabel: 'Z Flip 커버', w: 720, h: 748, group: '휴대폰', note: '커버 화면은 정사각에 가까워. 그 비율 그대로 꾸밀 수 있어.' },
  { id: 'tablet', label: 'iPad·갤럭시탭 세로', shortLabel: '태블릿', w: 1668, h: 2388, group: '태블릿', note: '폰보다 가로가 넓은 비율이야.' },
  { id: 'pc-fhd', label: 'PC FHD (16:9)', shortLabel: 'FHD', w: 1920, h: 1080, group: 'PC' },
  { id: 'pc-qhd', label: 'PC QHD (16:9)', shortLabel: 'QHD', w: 2560, h: 1440, group: 'PC' },
  { id: 'macbook', label: '맥북 (16:10)', shortLabel: '맥북', w: 2560, h: 1664, group: 'PC' },
  { id: 'ultrawide', label: '울트라와이드 (21:9)', shortLabel: '울트라와이드', w: 3440, h: 1440, group: 'PC', note: '좌우로 아주 넓은 비율이야.' },
];


// 단일 로드 시도 — 타임아웃 시 핸들러를 떼고 실패 처리해 미리보기가 영원히 "만드는 중"에 갇히지 않게 (v8.4)
function tryLoad(url: string, crossOrigin: boolean, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      // 빈 문자열을 넣으면 브라우저가 현재 페이지 URL로 다시 요청한다 — 취소는 data:,로 (v8.7)
      img.src = 'data:,';
      reject(new Error('image load timeout'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

// 이미지 로드의 정본 (v8.7 재작성).
// ⚠️ 핵심 계약: 원격 사진은 DOM <img>와 **완전히 같은 조건**으로 로드한다 — 같은 URL(displaySrc),
// 같은 CORS 모드(crossOrigin 미설정). 브라우저 HTTP 캐시 키에 CORS 모드가 들어가므로,
// 조건이 어긋나면 보드가 이미 받아둔 응답을 캔버스가 재사용하지 못하고 전부 다시 받는다.
// 그게 v8.6까지의 "사진 N장은 못 불러와서 빠졌어"의 직접 원인이었다(재요청 폭주 → 부분 타임아웃).
// 동일 출처 응답은 캔버스를 오염시키지 않으므로 crossOrigin 없이도 toBlob/toDataURL이 안전하다.
// ⚠️ 검증기로 compressImage(lib/imageUtils)를 쓰면 안 된다: onerror가 원본을 그대로 resolve해 항상 통과한다.
export async function loadOne(src: string, opts?: { bust?: number }): Promise<HTMLImageElement> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return tryLoad(src, false, 10_000);
  const resolved = displaySrc(src);
  if (resolved !== src) {
    try {
      return await tryLoad(bustedSrc(resolved, opts?.bust ?? 0), false, 12_000);
    } catch {
      // 프록시 장애 시에만 원본 직행 — CORS를 지원하는 호스트는 여기서 살아난다
      return tryLoad(src, true, 8_000);
    }
  }
  // 프록시 허용 밖(레거시 임의 호스트) — 직행이 유일한 길이고, 실패하면 그대로 실패다.
  // lib/imageNormalize.ts의 복구 동선이 이런 사진을 내 저장소로 수입해 이 분기를 없앤다.
  return tryLoad(src, true, 8_000);
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 170px "Enjoystories"'),
      document.fonts.load('600 44px "Pretendard Variable"'),
    ]);
  } catch {
    // 폰트 로드 실패 시 시스템 서체로 그린다
  }
}

const SCRIPT_FONT = '"Enjoystories", cursive';

function newCanvas(
  bg: string,
  w: number,
  h: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx, w, h };
}

// 비율 유지 + 중앙 크롭으로 사각 영역 채우기
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// 라운드 코너 사진 — v7.6 프레임리스 공통 경로. dark 테마는 DOM shadow-lg에 맞춰 그림자를 강하게
function drawRoundedPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  dark = false
) {
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(28,27,25,0.14)';
  ctx.shadowBlur = dark ? 28 : 22;
  ctx.shadowOffsetY = dark ? 12 : 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.clip();
  drawCover(ctx, img, x, y, w, h);
  ctx.restore();
}

/** #RRGGBB → rgba() — 스크림처럼 배경색에서 파생되는 알파 색을 만든다 */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 앰비언트 배경 — 사진 한 장을 크게 흐려 깔고 그 위에 배경색 스크림을 덮는다.
 *
 * 크롭 없이는 보드를 꽉 채울 수 없는 배치(보통 사진 1~3장)에서 남는 자리를 메운다.
 * 애플 TV·음악 앱이 쓰는 방식이라 "빈 공간"이 아니라 의도된 배경으로 읽힌다.
 *
 * ⚠️ ctx.filter='blur()'를 쓰지 않는다 — 구 Safari 미지원이라 환경에 따라 결과가 갈린다.
 *    32px로 줄였다가 다시 키우는 쪽이 전 브라우저에서 동일하게 동작하고 더 빠르다.
 *    DOM(CollageBoard)은 CSS filter를 쓰지만, 앰비언트는 사진 뒤 배경이라 미세한 차이가
 *    락스텝을 해치지 않는다(타이틀·사진 좌표처럼 정합이 필요한 요소가 아니다).
 */
function drawAmbient(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  bg: string
) {
  const sw = 32;
  const sh = Math.max(1, Math.round((sw * h) / w));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d');
  if (!sctx) return;
  drawCover(sctx, img, 0, 0, sw, sh);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 가장자리에서 블러가 끊겨 보이지 않게 살짝 키워 덮는다
  const ow = w * AMBIENT_SCALE;
  const oh = h * AMBIENT_SCALE;
  ctx.drawImage(small, (w - ow) / 2, (h - oh) / 2, ow, oh);
  ctx.fillStyle = withAlpha(bg, AMBIENT_SCRIM_ALPHA);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 자간 있는 한 줄 — ctx.letterSpacing이 있으면 그걸 쓰고(DOM CSS letter-spacing과 같은 규칙:
 * **마지막 글자 뒤에도** 붙는다), 없으면 같은 총폭이 나오도록 글자별로 커서를 밀어 그린다.
 *
 * ⚠️ v10의 "글자 사이에 공백 끼우기" 폴백을 대체한다 — 공백 폭은 폰트마다 달라 폴백 환경에서만
 *    카드 밖으로 삐져나갔고, collageTokens의 advance 예측식과도 어긋났다.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  cy: number,
  size: number,
  trackingEm: number,
  align: 'left' | 'center' | 'right'
) {
  const track = trackingEm * size;
  const trackable = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (trackable.letterSpacing !== undefined) {
    trackable.letterSpacing = `${track}px`;
    ctx.textAlign = align;
    ctx.fillText(text, x, cy);
    trackable.letterSpacing = '0px';
    return;
  }
  const chars = [...text];
  const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + track * chars.length;
  let cursor = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cursor, cy);
    cursor += ctx.measureText(ch).width + track;
  }
}

/**
 * 타이틀 카드 — 사진 **위에** 얹힌다 (v10). v9는 상단 15~22%를 통째로 비워 넣었다.
 *
 * v11부터 이 함수는 좌표를 계산하지 않는다 — collageTokens.titleLayoutFor()가 내려준 표시 리스트를
 * 그리기만 한다. ⚠️ 여기에 산술 리터럴을 다시 넣으면 DOM과 갈라진다(v10에서 세로 정렬·연도 자간이
 * 실제로 그렇게 갈라져 있었다).
 */
function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  tl: TitleLayout,
  year: string,
  bw: number,
  bh: number,
  minDim: number
) {
  if (!tl.visible) return;
  const x = tl.box.x * bw;
  const y = tl.box.y * bh;
  const w = tl.box.w * bw;
  const h = tl.box.h * bh;
  ctx.save();

  if (tl.card.alpha > 0) {
    ctx.fillStyle = withAlpha(tl.card.color, tl.card.alpha);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, minDim * tl.radius);
    ctx.fill();
  }
  if (tl.border.alpha > 0) {
    ctx.strokeStyle = withAlpha(tl.border.color, tl.border.alpha);
    ctx.lineWidth = Math.max(1, minDim * 0.0012);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, minDim * tl.radius);
    ctx.stroke();
  }

  // ⚠️ 그림자는 카드를 그린 **뒤에** 켠다 — 먼저 켜면 카드 사각형에도 그림자가 붙는다
  if (tl.shadow) {
    ctx.shadowColor = tl.shadow.color;
    ctx.shadowBlur = minDim * tl.shadow.blur;
    ctx.shadowOffsetY = minDim * tl.shadow.dy;
  }
  ctx.textBaseline = 'middle';
  for (const l of tl.lines) {
    const px = minDim * l.size;
    ctx.font =
      l.font === 'script'
        ? `${l.weight} ${px}px ${SCRIPT_FONT}`
        : `${l.weight} ${px}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillStyle = l.color;
    drawTracked(ctx, l.kind === 'label' ? TITLE_LABEL_TEXT : year, l.x * bw, l.cy * bh, px, l.tracking, l.align);
  }
  ctx.restore();
}

// ── 보드 그대로 내보내기 — /collage 화면의 편집 배치·스티커를 1:1로 캔버스에 그린다 ──

// 줄바꿈 로직의 단일 소스는 collageTokens.wrapStickerText (v12) — 여기는 폭 재기만 연결하는 어댑터다.
// DOM은 CSS(pre-wrap)가, canvas는 이 함수가 같은 규칙으로 줄을 나눈다
const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number) =>
  wrapStickerText(text, maxW, (s) => ctx.measureText(s).width);

// 스티커 — DOM StickerView와 같은 비율식(fontPx = w × 보드폭 × RATIO)으로 그린다
function drawSticker(
  ctx: CanvasRenderingContext2D,
  sticker: CollageSticker,
  rect: { x: number; y: number; w: number; rot: number },
  dark: boolean
) {
  // DOM은 fontSize = it.w×100×RATIO(cqi) = it.w×RATIO×보드폭(px) — rect.w가 it.w×보드폭이므로 같은 식
  const fontPx = rect.w * STICKER_FONT_RATIO[sticker.style];
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y);
  if (rect.rot) ctx.rotate((rect.rot * Math.PI) / 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 라인 아이콘 (v10) — 단위 path를 DOM(<svg viewBox="0 0 1 1">)과 공유한다.
  // ⚠️ Path2D 미지원이면 아무것도 그리지 않는다. 화면에는 보이는데 저장 이미지엔 없는
  //    '반쪽 렌더'를 만들 바에야, UI 쪽에서 아이콘 자체를 숨기는 게 계약이다(stickerArt.hasPath2D)
  if (sticker.kind === 'icon' && isIconId(sticker.icon)) {
    const def = ICONS[sticker.icon];
    const w = rect.w;
    const h = w / def.ratio;
    if (hasPath2D()) {
      // ⚠️ ctx.scale(w, h)로 확대하면 안 된다 — 비등방 스케일이 선 굵기까지 찌그러뜨린다.
      //    기하만 행렬로 변환하고 lineWidth는 픽셀 단위로 둔다
      const p = new Path2D();
      p.addPath(new Path2D(def.d), new DOMMatrix([w, 0, 0, h, -w / 2, 0]));
      const ink = sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19');
      if (def.mode === 'fill') {
        ctx.globalAlpha = def.alpha ?? 1;
        ctx.fillStyle = ink;
        ctx.fill(p);
      } else {
        ctx.lineWidth = def.stroke * Math.min(w, h);
        ctx.strokeStyle = ink;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(p);
      }
    }
    ctx.restore();
    return;
  }

  if (sticker.style === 'chip') {
    ctx.font = `600 ${fontPx}px "Pretendard Variable", Pretendard, sans-serif`;
    const padX = fontPx * STICKER_PAD_X_EM.chip;
    const padY = (fontPx * STICKER_PAD_EM.chip) / 2;
    const lineH = fontPx * STICKER_LINE_H.chip;
    const lines = wrapText(ctx, sticker.text, rect.w - padX * 2);
    // ⚠️ stickerHeightNorm(chip, n, w, aspect)를 픽셀로 환산한 것과 **같은 식**이어야 한다 —
    //    클램프·placeNewItems가 그 함수를 쓰므로, 여기서 갈라지면 화면에선 맞는데
    //    저장 이미지에서만 잘리는(또는 그 반대) 조용한 어긋남이 된다. verify-sticker S-1이 잠근다
    const boxH = lines.length * lineH + padY * 2;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-rect.w / 2, 0, rect.w, boxH, fontPx * 0.45);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#1C1B19';
    lines.forEach((l, i) => ctx.fillText(l, 0, padY + i * lineH + fontPx * 0.12));
  } else if (sticker.style === 'outline') {
    ctx.font = `800 ${fontPx}px "Pretendard Variable", Pretendard, sans-serif`;
    const lineH = fontPx * STICKER_LINE_H.outline;
    // toUpperCase는 세그먼트가 아니라 전체에 걸어도 안전하다 — \n은 대문자화되지 않는다
    const lines = wrapText(ctx, sticker.text.toUpperCase(), rect.w);
    ctx.lineWidth = fontPx * 0.14;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1C1B19';
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((l, i) => {
      ctx.strokeText(l, 0, i * lineH);
      ctx.fillText(l, 0, i * lineH);
    });
  } else {
    ctx.font = `700 ${fontPx}px ${SCRIPT_FONT}`;
    const lineH = fontPx * STICKER_LINE_H.script;
    const lines = wrapText(ctx, sticker.text, rect.w);
    if (dark) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillStyle = sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19');
    lines.forEach((l, i) => ctx.fillText(l, 0, i * lineH));
  }
  ctx.restore();
}

// 편집 배치를 선택한 해상도 그대로 캔버스에 옮긴다 — 사진 배치·회전·스티커 일치(무크롭 WYSIWYG, v6.19).
// 좌표 공간이 캔버스와 동일(0..1 정규화)하므로 레터박스 없이 화면 전체를 쓴다.
// skipped: 로드에 실패해 캔버스에서 빠진 사진 수 — 조용한 누락 대신 호출부가 알린다 (v8.1)
// skippedKeys: 어떤 슬롯이 빠졌는지 (v8.7) — 호출부가 섹션 이름을 보여주고 복구 동선을 건다
export async function renderBoardLayout(
  template: CollageTemplate,
  layout: CollageLayout,
  items: CollageItem[],
  year: string,
  size: { w: number; h: number },
  opts?: { bust?: number; deadlineMs?: number; bgColor?: string; title?: BoardData['collageTitle'] }
): Promise<{ canvas: HTMLCanvasElement; skipped: number; skippedKeys: string[] }> {
  await ensureFonts();
  // 배경색은 세 템플릿 공통 — DOM(CollageBoard)도 같은 themeFor()를 호출해 락스텝을 지킨다 (v9.0)
  const theme = themeFor(template, opts?.bgColor);
  const { canvas, ctx, w, h } = newCanvas(theme.bg, size.w, size.h);

  // 풀블리드 — 편집 보드가 곧 캔버스
  const bx = 0;
  const by = 0;
  const bw = w;
  const bh = h;
  const aspect = w / h; // 정사각 사진의 정규화 높이 = it.w × aspect (collageTemplates와 동일식)
  const minDim = Math.min(w, h); // DOM cqmin과 같은 기준 — 타이포·카드 치수는 짧은 변 비례

  const srcByKey = new Map(items.map((i) => [i.key, i.src]));
  // src 기준 dedupe (v8.7) — 같은 사진이 여러 슬롯에 있어도 1회만 받는다
  const uniqueSrcs = [...new Set(items.map((i) => i.src))];
  const loadedBySrc = new Map<string, HTMLImageElement>();
  const loadAll = mapLimit(uniqueSrcs, 6, async (src) => {
    try {
      loadedBySrc.set(src, await loadOne(src, { bust: opts?.bust }));
    } catch {
      // 깨진 이미지는 건너뛴다 — 수는 skipped로 집계해 반환
    }
  });
  // 상위 데드라인 (v8.7) — 한 장이 stall해도 미리보기가 영원히 "만드는 중"에 갇히지 않는다.
  // 시간이 다하면 그때까지 받은 사진만으로 그리고, 나머지는 skipped로 정직하게 보고한다.
  await Promise.race([
    loadAll,
    new Promise<void>((resolve) => setTimeout(resolve, opts?.deadlineMs ?? 20_000)),
  ]);
  const loadedByKey = new Map<string, HTMLImageElement>();
  const skippedKeys: string[] = [];
  for (const i of items) {
    const img = loadedBySrc.get(i.src);
    if (img) loadedByKey.set(i.key, img);
    else skippedKeys.push(i.key);
  }
  const skipped = skippedKeys.length;

  // 앰비언트 배경 — 사진보다 먼저(z-0). 크롭 없이 꽉 채울 수 없는 배치에서만 존재한다 (v10)
  if (layout.spec?.ambient) {
    const amb = loadedByKey.get(layout.spec.ambient);
    if (amb) drawAmbient(ctx, amb, w, h, theme.bg);
  }

  // 사진 + 스티커 — z 순서대로
  const entries = Object.entries(layout.items).sort(([, a], [, b]) => a.z - b.z);
  for (const [key, it] of entries) {
    if (key.startsWith('sticker:')) {
      const sticker = layout.stickers?.[key.slice('sticker:'.length)];
      if (!sticker) continue;
      drawSticker(
        ctx,
        sticker,
        { x: bx + it.x * bw, y: by + it.y * bh, w: it.w * bw, rot: it.rot ?? 0 },
        theme.dark
      );
      continue;
    }
    if (!srcByKey.has(key)) continue;
    const img = loadedByKey.get(key);
    if (!img) continue;
    const px = bx + it.x * bw;
    const py = by + it.y * bh;
    const pw = it.w * bw;
    const ph = (it.h ?? it.w * aspect) * bh;
    // v10 — 전 템플릿 단일 경로(라운드 + cover). 무크롭용 매트 액자가 필요 없어졌다:
    // 박스 자체가 사진의 원본 비율에 맞춰 만들어지므로 cover가 잘라낼 게 거의 없다
    const draw = (dx: number, dy: number) =>
      drawRoundedPhoto(ctx, img, dx, dy, pw, ph, pw * PHOTO_RADIUS_RATIO, theme.dark);
    // 회전은 자유 배치 모드에서만 남는다 — spec 배치는 rot을 쓰지 않는다
    if (it.rot) {
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((it.rot * Math.PI) / 180);
      draw(-pw / 2, -ph / 2);
      ctx.restore();
    } else {
      draw(px, py);
    }
  }

  // 타이틀 카드 — 사진 위에 얹힌다 (v10). 맨 마지막에 그려 어떤 사진에도 가리지 않는다
  drawTitleCard(
    ctx,
    titleLayoutFor(titleFor(template, layout.title, opts?.title), aspect, theme.bg),
    year,
    bw,
    bh,
    minDim
  );

  return { canvas, skipped, skippedKeys };
}

// ── 저장 위치 선택 (v8.4) — 데스크톱 Chrome/Edge는 OS 저장 대화상자로 위치를 고른다 ──
// ⚠️ showSaveFilePicker는 transient user activation이 필요 — 클릭 핸들러의 "첫 await"로 호출할 것.
type SaveFilePickerFn = (opts: {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

export async function pickSaveHandle(
  filename: string
): Promise<FileSystemFileHandle | 'cancelled' | 'unsupported'> {
  const picker = (window as { showSaveFilePicker?: SaveFilePickerFn }).showSaveFilePicker;
  if (typeof picker !== 'function') return 'unsupported';
  try {
    return await picker({
      suggestedName: filename,
      types: [{ description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }],
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    // SecurityError(iframe·헤드리스 등) 포함 그 외 실패는 공유/다운로드 폴백으로
    return 'unsupported';
  }
}

export async function writeCanvasToHandle(
  canvas: HTMLCanvasElement,
  handle: FileSystemFileHandle
): Promise<void> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

// 모바일은 공유 시트(사진 앱 저장), 미지원 환경은 파일 다운로드
export async function saveCanvas(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // 공유 실패 시 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
