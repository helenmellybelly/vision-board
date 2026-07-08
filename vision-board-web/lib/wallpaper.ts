// 배경화면 캔버스 렌더링 — /collage '배경화면으로 저장' 시트에서 사용
// 외부 라이브러리 없이 Canvas API로 직접 그린다.
// 사이즈를 먼저 고르고 그 비율 그대로 편집하므로, 선택한 해상도로 직접 그린다(무크롭 WYSIWYG, v6.19).
import { CollageLayout, CollageSticker, CollageTemplate } from './types';
import { COLLAGE_THEMES, CollageItem, STICKER_FONT_RATIO, hasTopReserve } from './collageTemplates';

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

const INK = '#1C1B19';
const INK_SOFT = '#6E6962';

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

// 편집 배치를 선택한 해상도 그대로 캔버스에 옮긴다 — 사진 배치·회전·스티커 일치(무크롭 WYSIWYG, v6.19).
// 좌표 공간이 캔버스와 동일(0..1 정규화)하므로 레터박스 없이 화면 전체를 쓴다.
export async function renderBoardLayout(
  template: CollageTemplate,
  layout: CollageLayout,
  items: CollageItem[],
  year: string,
  size: { w: number; h: number }
): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const theme = COLLAGE_THEMES[template];
  const { canvas, ctx, w, h } = newCanvas(theme.bg, size.w, size.h);

  // 풀블리드 — 편집 보드가 곧 캔버스
  const bx = 0;
  const by = 0;
  const bw = w;
  const bh = h;
  const aspect = w / h; // 정사각 사진의 정규화 높이 = it.w × aspect (collageTemplates와 동일식)
  const minDim = Math.min(w, h); // DOM cqmin과 같은 기준 — 타이포·카드 치수는 짧은 변 비례

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

  // 상단 타이틀 밴드 (mosaic·minimal) — 사진보다 먼저.
  // 세로로 긴 화면은 상단 시계 영역 아래로 내린다 — DOM(CollageBoard)의 padTop과 동일 기준
  if (theme.titlePos === 'top') {
    const padCq = hasTopReserve(w / h) ? 0.32 : 0.04; // cqmin 단위(minDim 비례)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.dark ? '#C4C2BE' : INK_SOFT;
    ctx.font = `600 ${Math.round(minDim * 0.026)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('V I S I O N   B O A R D', bx + bw / 2, by + minDim * (padCq + 0.01));
    ctx.fillStyle = theme.dark ? '#FFFFFF' : INK;
    ctx.font = `700 ${Math.round(minDim * 0.07)}px ${SCRIPT_FONT}`;
    ctx.fillText(year, bx + bw / 2, by + minDim * (padCq + 0.075));
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
      const ph = (it.h ?? it.w * aspect) * bh;
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

  // 중앙 연도 카드 (polaroid) — 사진 위, 화면과 동일. 치수는 짧은 변(minDim) 비례
  if (theme.titlePos === 'center') {
    const cardW = minDim * 0.46;
    const cardH = minDim * 0.27;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#3A3734';
    ctx.beginPath();
    ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, minDim * 0.03);
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
    ctx.font = `600 ${Math.round(minDim * 0.026)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('V I S I O N   B O A R D', cx, cy - cardH * 0.22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.round(minDim * 0.09)}px ${SCRIPT_FONT}`;
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
