// 배경화면 캔버스 렌더링 — /collage '배경화면으로 저장' 시트에서 사용
// 외부 라이브러리 없이 Canvas API로 직접 그린다.
// 타깃 2종: mobile(9:19.5 세로) / desktop(16:9 가로) — 좌표는 전부 zone(rect) 기반.
import { CollageLayout, CollageSticker, CollageTemplate } from './types';
import { ASPECT, COLLAGE_THEMES, CollageItem, STICKER_FONT_RATIO } from './collageTemplates';

export interface WallpaperSectionGroup {
  label: string;
  color: string;
  images: string[]; // dataURL 또는 외부 URL — 섹션당 최대 3장
}

export type WallpaperTarget = 'mobile' | 'desktop';
export const WALLPAPER_SIZES: Record<WallpaperTarget, { w: number; h: number }> = {
  mobile: { w: 1170, h: 2532 },
  desktop: { w: 1920, h: 1080 },
};

// 디자인 2종: polaroid = 다크 무드 폴라로이드 산포 / minimal = 크림 배경 정렬 그리드
export type WallpaperStyle = 'polaroid' | 'minimal';
const BG_DARK = '#2D2B29'; // VisionBoardCollage와 동일한 배경
const BG_LIGHT = '#FAF9F7'; // 서비스 기본 크림 배경 (globals.css --background)
const INK = '#1C1B19';
const INK_SOFT = '#6E6962';

// 콜라주와 같은 폴라로이드 회전 언어 — 인덱스 기반 결정적 배치
const ROTATIONS = [-6, 4, -3, 6, -4, 5, -5, 3, -2, 4, -6, 3, -4, 6, -3, 5, -5, 2];
const JITTERS: [number, number][] = [
  [-16, 10], [14, -12], [-8, 18], [20, 8], [-14, -10], [8, 16],
  [18, -8], [-20, 12], [10, -16], [-12, 8], [16, 12], [-10, -14],
  [12, 14], [-18, -8], [8, -12], [-8, 14], [14, 10], [-12, -12],
];

function loadOne(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 성공적으로 로드된 cross-origin 이미지는 캔버스를 오염시키지 않도록 CORS 모드로
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (src.startsWith('data:')) {
        reject(new Error('image load failed'));
        return;
      }
      // CORS 미지원 호스트면 동일 출처 프록시로 한 번 더 시도
      const retry = new Image();
      retry.onload = () => resolve(retry);
      retry.onerror = () => reject(new Error('image load failed'));
      retry.src = `/api/image/proxy?url=${encodeURIComponent(src)}`;
    };
    img.src = src;
  });
}

// 깨진 링크(만료된 생성 이미지 등)는 조용히 건너뛴다
async function loadImages(srcs: string[]): Promise<HTMLImageElement[]> {
  const settled = await Promise.allSettled(srcs.map(loadOne));
  return settled
    .filter((s): s is PromiseFulfilledResult<HTMLImageElement> => s.status === 'fulfilled')
    .map((s) => s.value);
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
  target: WallpaperTarget
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const { w, h } = WALLPAPER_SIZES[target];
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

function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  size: number,
  rotDeg: number
) {
  const pad = size * 0.045;
  const chin = size * 0.16;
  const imgSize = size - pad * 2;
  const frameH = pad + imgSize + chin;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-size / 2, -frameH / 2, size, frameH);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawCover(ctx, img, -imgSize / 2, -frameH / 2 + pad, imgSize, imgSize);
  ctx.restore();
}

function drawCenterTitle(
  ctx: CanvasRenderingContext2D,
  year: string,
  cx: number,
  cy: number,
  yearPx = 170
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C4C2BE';
  ctx.font = `600 ${Math.round(yearPx * 0.2)}px "Pretendard Variable", Pretendard, sans-serif`;
  ctx.fillText('V I S I O N   B O A R D', cx, cy - yearPx * 0.62);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${yearPx}px ${SCRIPT_FONT}`;
  ctx.fillText(year, cx, cy + yearPx * 0.235);
}

// 한 구역(rect)에 폴라로이드를 그리드 + 지터로 흩뿌림 — 살짝씩 겹치게
// scale: 폴라로이드 크기 배율 (모바일 전폭=1 기준) — 호출자가 구역 크기에 맞게 지정
function scatterInRect(
  ctx: CanvasRenderingContext2D,
  imgs: HTMLImageElement[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  startIdx: number,
  maxCols: number,
  scale = 1
) {
  const n = imgs.length;
  if (n === 0) return;
  const cols = Math.min(maxCols, n);
  const rows = Math.ceil(n / cols);
  const size = (n <= 2 ? 470 : n <= 4 ? 430 : n <= 6 ? 390 : 350) * scale;
  const stepX = (x1 - x0) / cols;
  // 행 중심을 구역 안에 클램프 — 폴라로이드가 타이틀 밴드를 침범하지 않게.
  // 행끼리는 자연스럽게 겹친다 (할당 높이보다 폴라로이드가 큼).
  const halfH = (size * 1.16) / 2;
  const cyFirst = y0 + halfH * 0.85;
  const cyLast = y1 - halfH * 0.85;
  const stepY = rows > 1 ? (cyLast - cyFirst) / (rows - 1) : 0;

  imgs.forEach((img, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowOffset = ((cols - inRow) * stepX) / 2; // 마지막 줄은 가운데 정렬
    const gi = startIdx + i;
    const [jx, jy] = JITTERS[gi % JITTERS.length];
    const cx = x0 + rowOffset + stepX * (c + 0.5) + jx;
    const cy = (rows > 1 ? cyFirst + stepY * r : (y0 + y1) / 2) + jy;
    drawPolaroid(ctx, img, cx, cy, size, ROTATIONS[gi % ROTATIONS.length]);
  });
}

// ── 미니멀 그리드 스타일 헬퍼 ──

// 라운드 코너 사진 — 회전 없이 정렬, 부드러운 그림자
function drawRoundedPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  ctx.shadowColor = 'rgba(28,27,25,0.14)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
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

// 미니멀 헤더 — 작은 레터스페이스 라벨 + 손글씨(Enjoystories) 연도
function drawMinimalHeader(
  ctx: CanvasRenderingContext2D,
  year: string,
  cx: number,
  labelY: number,
  yearY: number,
  yearPx = 104
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK_SOFT;
  ctx.font = '600 32px "Pretendard Variable", Pretendard, sans-serif';
  ctx.fillText('V I S I O N   B O A R D', cx, labelY);
  ctx.fillStyle = INK;
  ctx.font = `700 ${yearPx}px ${SCRIPT_FONT}`;
  ctx.fillText(year, cx, yearY);
}

// 섹션 컬러 도트 행 — 6개 영역의 시그니처
function drawColorDots(ctx: CanvasRenderingContext2D, colors: string[], cx: number, cy: number) {
  const r = 13;
  const gap = 46;
  const totalW = colors.length * r * 2 + (colors.length - 1) * (gap - r * 2);
  let x = cx - totalW / 2 + r;
  for (const color of colors) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    x += gap;
  }
}

// 정렬 그리드 — 마지막 줄은 가운데 정렬, 블록 전체를 구역에 수직 중앙 배치
function gridInRect(
  ctx: CanvasRenderingContext2D,
  imgs: HTMLImageElement[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  colsOverride?: number
) {
  const n = imgs.length;
  if (n === 0) return;
  const gap = 26;
  const cols = colsOverride ?? (n <= 4 ? 2 : 3);
  const rows = Math.ceil(n / cols);
  const cellW = (x1 - x0 - gap * (cols - 1)) / cols;
  const cellH = (y1 - y0 - gap * (rows - 1)) / rows;
  const cell = Math.min(cellW, cellH); // 구역 높이도 넘지 않게 (모바일 기존 결과는 항상 cellW)
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const left = x0 + (x1 - x0 - gridW) / 2;
  const top = y0 + Math.max(0, (y1 - y0 - gridH) / 2);
  imgs.forEach((img, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    const rowOffset = ((cols - inRow) * (cell + gap)) / 2;
    drawRoundedPhoto(
      ctx,
      img,
      left + rowOffset + c * (cell + gap),
      top + r * (cell + gap),
      cell,
      cell,
      28
    );
  });
}

// 모드 1: 한 장 모아담기 — 중앙(모바일) 또는 좌측(PC) 타이틀 + 사진 산포/그리드
export async function renderAllInOne(
  groups: WallpaperSectionGroup[],
  year: string,
  style: WallpaperStyle = 'polaroid',
  target: WallpaperTarget = 'mobile'
): Promise<HTMLCanvasElement> {
  await ensureFonts();

  if (style === 'minimal') {
    // 미니멀: 크림 배경 + 정렬 그리드(최대 12장) + 헤더·컬러 도트
    const srcs = groups.flatMap((g) => g.images).slice(0, 12);
    const imgs = await loadImages(srcs);
    const { canvas, ctx, w } = newCanvas(BG_LIGHT, target);
    if (target === 'desktop') {
      // 좌측 1/3 헤더 칼럼 + 우측 그리드
      drawMinimalHeader(ctx, year, 320, 420, 515, 92);
      drawColorDots(ctx, groups.map((g) => g.color), 320, 640);
      gridInRect(ctx, imgs, 640, 1856, 90, 990, imgs.length <= 4 ? 2 : imgs.length <= 9 ? 3 : 4);
    } else {
      drawMinimalHeader(ctx, year, w / 2, 440, 540);
      gridInRect(ctx, imgs, 84, w - 84, 660, 2260);
      drawColorDots(ctx, groups.map((g) => g.color), w / 2, 2360);
    }
    return canvas;
  }

  const srcs = groups.flatMap((g) => g.images).slice(0, 18);
  const imgs = await loadImages(srcs);
  const { canvas, ctx, w } = newCanvas(BG_DARK, target);
  const half = Math.ceil(imgs.length / 2);

  if (target === 'desktop') {
    // 중앙 세로 타이틀 밴드 + 좌·우 산포
    scatterInRect(ctx, imgs.slice(0, half), 50, 710, 70, 1010, 0, 2, 0.62);
    scatterInRect(ctx, imgs.slice(half), 1210, 1870, 70, 1010, half, 2, 0.62);
    drawCenterTitle(ctx, year, w / 2, 530, 150);
  } else {
    // 상단 ~380px은 시계·위젯 영역으로 비워둔다
    scatterInRect(ctx, imgs.slice(0, half), 60, w - 60, 380, 1130, 0, 3);
    scatterInRect(ctx, imgs.slice(half), 60, w - 60, 1470, 2400, half, 3);
    drawCenterTitle(ctx, year, w / 2, 1300, 170);
  }
  return canvas;
}

// 섹션 구역 — 라벨(컬러 점 + 텍스트) + 폴라로이드 1~3장. 좌표·크기는 구역폭 기준 스케일.
function drawSectionZone(
  ctx: CanvasRenderingContext2D,
  group: WallpaperSectionGroup,
  imgs: HTMLImageElement[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  seed: number,
  minimal: boolean
) {
  const cx = (x0 + x1) / 2;
  const s = (x1 - x0) / 1170; // 모바일 전폭 기준 스케일 (모바일=1)

  // 라벨: 컬러 점 + 텍스트
  const labelY = y0 + 30 * s;
  ctx.font = `700 ${Math.round(44 * s)}px "Pretendard Variable", Pretendard, sans-serif`;
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(group.label).width;
  const dotR = 11 * s;
  const gap = 18 * s;
  const startX = cx - (dotR * 2 + gap + textW) / 2;
  ctx.fillStyle = group.color;
  ctx.beginPath();
  ctx.arc(startX + dotR, labelY, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = minimal ? INK : '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(group.label, startX + dotR * 2 + gap, labelY);
  ctx.textAlign = 'center';

  if (imgs.length === 0) {
    ctx.fillStyle = minimal ? '#9A958E' : '#8A8784';
    ctx.font = `400 ${Math.round(32 * s)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('아직 담긴 사진이 없어', cx, (y0 + y1) / 2 + 40 * s);
    return;
  }

  if (minimal) {
    const contentY0 = labelY + 80 * s;
    const cy = (contentY0 + y1) / 2;
    if (imgs.length === 1) {
      drawRoundedPhoto(ctx, imgs[0], cx - 280 * s, cy - 280 * s, 560 * s, 560 * s, 36 * s);
    } else if (imgs.length === 2) {
      drawRoundedPhoto(ctx, imgs[0], cx - (470 + 14) * s, cy - 235 * s, 470 * s, 470 * s, 32 * s);
      drawRoundedPhoto(ctx, imgs[1], cx + 14 * s, cy - 235 * s, 470 * s, 470 * s, 32 * s);
    } else {
      // 3장 — 위 2, 아래 1 가운데 정렬 (회전 없는 정돈된 배치)
      const ps = 380 * s;
      const g = 26 * s;
      const rowTop = cy - ps - g / 2;
      drawRoundedPhoto(ctx, imgs[0], cx - ps - g / 2, rowTop, ps, ps, 30 * s);
      drawRoundedPhoto(ctx, imgs[1], cx + g / 2, rowTop, ps, ps, 30 * s);
      drawRoundedPhoto(ctx, imgs[2], cx - ps / 2, cy + g / 2, ps, ps, 30 * s);
    }
    return;
  }

  const cy = (labelY + 80 * s + y1) / 2;
  if (imgs.length === 1) {
    drawPolaroid(ctx, imgs[0], cx, cy, 560 * s, ROTATIONS[seed]);
  } else if (imgs.length === 2) {
    drawPolaroid(ctx, imgs[0], cx - 230 * s, cy - 90 * s, 470 * s, ROTATIONS[seed]);
    drawPolaroid(ctx, imgs[1], cx + 230 * s, cy + 110 * s, 470 * s, ROTATIONS[seed + 1]);
  } else {
    // 3장 — 위 1, 아래 2 삼각 배치
    drawPolaroid(ctx, imgs[0], cx, cy - 200 * s, 450 * s, ROTATIONS[seed]);
    drawPolaroid(ctx, imgs[1], cx - 250 * s, cy + 190 * s, 450 * s, ROTATIONS[seed + 1]);
    drawPolaroid(ctx, imgs[2], cx + 250 * s, cy + 190 * s, 450 * s, ROTATIONS[seed + 2]);
  }
}

// 모드 2: 섹션 묶음 — 2개 섹션을 위·아래(모바일) 또는 좌·우(PC)로 나눠 담은 월페이퍼 한 장
export async function renderSectionPair(
  pair: WallpaperSectionGroup[],
  year: string,
  style: WallpaperStyle = 'polaroid',
  target: WallpaperTarget = 'mobile'
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const imgsA = await loadImages(pair[0]?.images ?? []);
  const imgsB = pair[1] ? await loadImages(pair[1].images) : [];
  const minimal = style === 'minimal';
  const { canvas, ctx, w } = newCanvas(minimal ? BG_LIGHT : BG_DARK, target);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = minimal ? INK_SOFT : '#C4C2BE';
  ctx.font = '600 30px "Pretendard Variable", Pretendard, sans-serif';

  if (target === 'desktop') {
    ctx.fillText(`V I S I O N   B O A R D   ${year}`, w / 2, 70);
    drawSectionZone(ctx, pair[0], imgsA, 40, 940, 140, 1030, 0, minimal);
    if (pair[1]) drawSectionZone(ctx, pair[1], imgsB, 980, 1880, 140, 1030, 3, minimal);
  } else {
    ctx.fillText(`V I S I O N   B O A R D   ${year}`, w / 2, 300);
    drawSectionZone(ctx, pair[0], imgsA, 0, w, 430, 1330, 0, minimal);
    if (pair[1]) drawSectionZone(ctx, pair[1], imgsB, 0, w, 1430, 2330, 3, minimal);
  }
  return canvas;
}

// ── 보드 그대로 내보내기 — /collage 화면의 편집 배치·스티커를 1:1로 캔버스에 그린다 ──

// 단어 단위 줄바꿈 — 공백 없는 긴 한국어/영문은 글자 단위로 쪼갠다
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  const push = (chunk: string) => {
    const tryLine = line ? `${line} ${chunk}` : chunk;
    if (ctx.measureText(tryLine).width <= maxW || !line) {
      line = tryLine;
    } else {
      lines.push(line);
      line = chunk;
    }
  };
  for (const word of words) {
    if (ctx.measureText(word).width > maxW) {
      for (const ch of word) push(ch);
    } else {
      push(word);
    }
  }
  if (line) lines.push(line);
  return lines;
}

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

  if (sticker.style === 'chip') {
    ctx.font = `600 ${fontPx}px "Pretendard Variable", Pretendard, sans-serif`;
    const padX = fontPx * 0.7;
    const padY = fontPx * 0.5;
    const lineH = fontPx * 1.375;
    const lines = wrapText(ctx, sticker.text, rect.w - padX * 2);
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
    const lineH = fontPx * 1.25;
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
    const lineH = fontPx * 1.25;
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

// 화면의 4:5 보드를 배경화면 안에 그대로 옮긴다 — 사진 배치·회전·스티커 일치(WYSIWYG)
export async function renderBoardLayout(
  template: CollageTemplate,
  layout: CollageLayout,
  items: CollageItem[],
  year: string,
  target: WallpaperTarget = 'mobile'
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const theme = COLLAGE_THEMES[template];
  const { canvas, ctx, w, h } = newCanvas(theme.bg, target);

  // 보드 콘텐츠 영역 — 모바일은 상단 시계 영역(~380px)을 비우고 세로 중앙, PC는 가로 중앙
  let bx: number, by: number, bw: number, bh: number;
  if (target === 'desktop') {
    bh = h - 140;
    bw = bh * ASPECT;
    bx = (w - bw) / 2;
    by = 70;
  } else {
    bw = w - 80;
    bh = bw / ASPECT;
    bx = 40;
    by = 380 + (h - 380 - 40 - bh) / 2;
  }

  const srcByKey = new Map(items.map((i) => [i.key, i.src]));
  const loadedByKey = new Map<string, HTMLImageElement>();
  await Promise.all(
    items.map(async (i) => {
      try {
        loadedByKey.set(i.key, await loadOne(i.src));
      } catch {
        // 깨진 이미지는 건너뛴다
      }
    })
  );

  // 상단 타이틀 밴드 (mosaic·minimal) — 사진보다 먼저
  if (theme.titlePos === 'top') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.dark ? '#C4C2BE' : INK_SOFT;
    ctx.font = `600 ${Math.round(bw * 0.026)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('V I S I O N   B O A R D', bx + bw / 2, by + bw * 0.05);
    ctx.fillStyle = theme.dark ? '#FFFFFF' : INK;
    ctx.font = `700 ${Math.round(bw * 0.07)}px ${SCRIPT_FONT}`;
    ctx.fillText(year, bx + bw / 2, by + bw * 0.115);
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
    if (theme.frame === 'polaroid') {
      const frameH = pw * 1.115;
      drawPolaroid(ctx, img, px + pw / 2, py + frameH / 2, pw, it.rot ?? 0);
    } else {
      const ph = (it.h ?? it.w * ASPECT) * bh;
      if (it.rot) {
        ctx.save();
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((it.rot * Math.PI) / 180);
        drawRoundedPhoto(ctx, img, -pw / 2, -ph / 2, pw, ph, pw * 0.06);
        ctx.restore();
      } else {
        drawRoundedPhoto(ctx, img, px, py, pw, ph, pw * 0.06);
      }
    }
  }

  // 중앙 연도 카드 (polaroid) — 사진 위, 화면과 동일
  if (theme.titlePos === 'center') {
    const cardW = bw * 0.46;
    const cardH = bw * 0.27;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#3A3734';
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, bw * 0.03);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#C4C2BE';
    ctx.font = `600 ${Math.round(bw * 0.026)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('V I S I O N   B O A R D', cx, cy - cardH * 0.22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(bw * 0.09)}px ${SCRIPT_FONT}`;
    ctx.fillText(year, cx, cy + cardH * 0.16);
  }

  return canvas;
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
