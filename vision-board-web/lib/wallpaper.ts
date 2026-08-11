// 배경화면 캔버스 렌더링 — /collage '배경화면으로 저장' 시트에서 사용
// 외부 라이브러리 없이 Canvas API로 직접 그린다.
// 사이즈를 먼저 고르고 그 비율 그대로 편집하므로, 선택한 해상도로 직접 그린다(무크롭 WYSIWYG, v6.19).
import { CollageLayout, CollageSticker, CollageTemplate } from './types';
import { CollageItem, STICKER_FONT_RATIO, themeFor } from './collageTemplates';
import { MATTE_MAT_RATIO, PHOTO_RADIUS_RATIO, titleTokensFor } from './collageTokens';
import { bustedSrc, displaySrc } from './imageSrc';

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

/** 동시 실행 상한이 있는 map — 사진 18장이 한꺼번에 몰려 서로를 타임아웃시키는 걸 막는다 (v8.7) */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
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

// 매트 갤러리 — 흰 매트 카드 안에 사진을 **자르지 않고**(contain) 앉힌다 (v9.0).
// 세로 스크린샷이 정사각 셀에서 위아래가 잘려 글자가 안 보이던 문제(오너 v8.7 팟캐스트 사례)의
// 완전 해소책이자, 이 템플릿의 컨셉 그 자체다 — 남는 자리는 결함이 아니라 액자의 매트다.
function drawMattePhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  onWhiteBg: boolean
) {
  const r = Math.min(w, h) * 0.04;
  ctx.save();
  ctx.shadowColor = 'rgba(28,27,25,0.10)';
  ctx.shadowBlur = Math.min(w, h) * 0.06;
  ctx.shadowOffsetY = Math.min(w, h) * 0.015;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // 배경이 흰색이면 그림자만으로는 카드가 배경에 녹는다 — 이때만 실선 테두리를 더한다
  if (onWhiteBg) {
    ctx.strokeStyle = '#E5E3DF';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.004);
    ctx.stroke();
  }
  ctx.restore();

  const mat = Math.min(w, h) * MATTE_MAT_RATIO;
  const iw = w - mat * 2;
  const ih = h - mat * 2;
  if (iw <= 0 || ih <= 0) return;
  const scale = Math.min(iw / img.width, ih / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + mat + (iw - dw) / 2, y + mat + (ih - dh) / 2, dw, dh);
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
// skipped: 로드에 실패해 캔버스에서 빠진 사진 수 — 조용한 누락 대신 호출부가 알린다 (v8.1)
// skippedKeys: 어떤 슬롯이 빠졌는지 (v8.7) — 호출부가 섹션 이름을 보여주고 복구 동선을 건다
export async function renderBoardLayout(
  template: CollageTemplate,
  layout: CollageLayout,
  items: CollageItem[],
  year: string,
  size: { w: number; h: number },
  opts?: { bust?: number; deadlineMs?: number; bgColor?: string }
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

  // 상단 타이틀 밴드 — 사진보다 먼저. 수치는 lib/collageTokens가 단일 소스라
  // DOM(CollageBoard)의 padTop·폰트 비율과 자동으로 락스텝이다 (v9.0)
  {
    const t = titleTokensFor(template, aspect);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.labelInk;
    ctx.font = `600 ${Math.round(minDim * t.labelRatio)}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.fillText('V I S I O N   B O A R D', bx + bw / 2, by + minDim * t.labelY);
    ctx.fillStyle = theme.titleInk;
    ctx.font = `700 ${Math.round(minDim * t.yearRatio)}px ${SCRIPT_FONT}`;
    ctx.fillText(year, bx + bw / 2, by + minDim * t.yearY);
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
    // 매트 갤러리는 무크롭(contain) 매트 카드, 나머지는 라운드 사진(cover) — DOM과 락스텝
    const onWhite = theme.bg.toUpperCase() === '#FFFFFF';
    const draw = (dx: number, dy: number) =>
      theme.frame === 'matte'
        ? drawMattePhoto(ctx, img, dx, dy, pw, ph, onWhite)
        : drawRoundedPhoto(ctx, img, dx, dy, pw, ph, pw * PHOTO_RADIUS_RATIO, theme.dark);
    // 회전은 자유 배치 모드에서만 남는다 (v9.0) — 그리드 배치는 rot을 쓰지 않는다
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
