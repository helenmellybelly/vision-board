// 모바일 배경화면(9:19.5) 캔버스 렌더링 — /collage '배경화면으로 저장' 시트에서 사용
// 외부 라이브러리 없이 Canvas API로 직접 그린다.

export interface WallpaperSectionGroup {
  label: string;
  color: string;
  images: string[]; // dataURL 또는 외부 URL — 섹션당 최대 3장
}

export const WALLPAPER_W = 1170;
export const WALLPAPER_H = 2532;
const BG = '#2D2B29'; // VisionBoardCollage와 동일한 배경

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
      document.fonts.load('700 170px "Gowun Batang"'),
      document.fonts.load('600 44px "Pretendard Variable"'),
    ]);
  } catch {
    // 폰트 로드 실패 시 시스템 서체로 그린다
  }
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = WALLPAPER_W;
  canvas.height = WALLPAPER_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WALLPAPER_W, WALLPAPER_H);
  return { canvas, ctx };
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

function drawCenterTitle(ctx: CanvasRenderingContext2D, year: string, cy: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C4C2BE';
  ctx.font = '600 34px "Pretendard Variable", Pretendard, sans-serif';
  ctx.fillText('V I S I O N   B O A R D', WALLPAPER_W / 2, cy - 105);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 170px "Gowun Batang", serif';
  ctx.fillText(year, WALLPAPER_W / 2, cy + 40);
}

// 한 구역(zone)에 폴라로이드를 3열 그리드 + 지터로 흩뿌림 — 살짝씩 겹치게
function scatterInZone(
  ctx: CanvasRenderingContext2D,
  imgs: HTMLImageElement[],
  y0: number,
  y1: number,
  startIdx: number
) {
  const n = imgs.length;
  if (n === 0) return;
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const size = n <= 2 ? 470 : n <= 4 ? 430 : n <= 6 ? 390 : 350;
  const marginX = 60;
  const stepX = (WALLPAPER_W - marginX * 2) / cols;
  // 행 중심을 구역 안에 클램프 — 폴라로이드가 중앙 타이틀 밴드를 침범하지 않게.
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
    const cx = marginX + rowOffset + stepX * (c + 0.5) + jx;
    const cy = (rows > 1 ? cyFirst + stepY * r : (y0 + y1) / 2) + jy;
    drawPolaroid(ctx, img, cx, cy, size, ROTATIONS[gi % ROTATIONS.length]);
  });
}

// 모드 1: 한 장 모아담기 — 최대 18장을 위·아래 구역에 겹쳐 배치, 중앙에 타이틀
export async function renderAllInOne(
  groups: WallpaperSectionGroup[],
  year: string
): Promise<HTMLCanvasElement> {
  const srcs = groups.flatMap((g) => g.images).slice(0, 18);
  await ensureFonts();
  const imgs = await loadImages(srcs);
  const { canvas, ctx } = newCanvas();

  // 상단 ~380px은 시계·위젯 영역으로 비워둔다
  const half = Math.ceil(imgs.length / 2);
  scatterInZone(ctx, imgs.slice(0, half), 380, 1130, 0);
  scatterInZone(ctx, imgs.slice(half), 1470, 2400, half);
  drawCenterTitle(ctx, year, 1300);
  return canvas;
}

function drawSectionZone(
  ctx: CanvasRenderingContext2D,
  group: WallpaperSectionGroup,
  imgs: HTMLImageElement[],
  y0: number,
  y1: number,
  seed: number
) {
  // 라벨: 컬러 점 + 흰 텍스트
  const labelY = y0 + 30;
  ctx.font = '700 44px "Pretendard Variable", Pretendard, sans-serif';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(group.label).width;
  const dotR = 11;
  const gap = 18;
  const startX = (WALLPAPER_W - (dotR * 2 + gap + textW)) / 2;
  ctx.fillStyle = group.color;
  ctx.beginPath();
  ctx.arc(startX + dotR, labelY, dotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(group.label, startX + dotR * 2 + gap, labelY);
  ctx.textAlign = 'center';

  if (imgs.length === 0) {
    ctx.fillStyle = '#8A8784';
    ctx.font = '400 32px "Pretendard Variable", Pretendard, sans-serif';
    ctx.fillText('아직 담긴 사진이 없어', WALLPAPER_W / 2, (y0 + y1) / 2 + 40);
    return;
  }

  const cy = (labelY + 80 + y1) / 2;
  if (imgs.length === 1) {
    drawPolaroid(ctx, imgs[0], WALLPAPER_W / 2, cy, 560, ROTATIONS[seed]);
  } else if (imgs.length === 2) {
    drawPolaroid(ctx, imgs[0], WALLPAPER_W / 2 - 230, cy - 90, 470, ROTATIONS[seed]);
    drawPolaroid(ctx, imgs[1], WALLPAPER_W / 2 + 230, cy + 110, 470, ROTATIONS[seed + 1]);
  } else {
    // 3장 — 위 1, 아래 2 삼각 배치
    drawPolaroid(ctx, imgs[0], WALLPAPER_W / 2, cy - 200, 450, ROTATIONS[seed]);
    drawPolaroid(ctx, imgs[1], WALLPAPER_W / 2 - 250, cy + 190, 450, ROTATIONS[seed + 1]);
    drawPolaroid(ctx, imgs[2], WALLPAPER_W / 2 + 250, cy + 190, 450, ROTATIONS[seed + 2]);
  }
}

// 모드 2: 섹션 묶음 — 2개 섹션을 위·아래로 나눠 담은 월페이퍼 한 장
export async function renderSectionPair(
  pair: WallpaperSectionGroup[],
  year: string
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const imgsA = await loadImages(pair[0]?.images ?? []);
  const imgsB = pair[1] ? await loadImages(pair[1].images) : [];
  const { canvas, ctx } = newCanvas();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#C4C2BE';
  ctx.font = '600 30px "Pretendard Variable", Pretendard, sans-serif';
  ctx.fillText(`V I S I O N   B O A R D   ${year}`, WALLPAPER_W / 2, 300);

  drawSectionZone(ctx, pair[0], imgsA, 430, 1330, 0);
  if (pair[1]) drawSectionZone(ctx, pair[1], imgsB, 1430, 2330, 3);
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
