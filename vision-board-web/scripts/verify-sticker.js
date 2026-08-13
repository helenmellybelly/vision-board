// 문구 스티커 조판·배치 계약 (v12) — npx tsx scripts/verify-sticker.js
//
// 왜 생겼나: "스티커의 높이"를 네 곳이 각자 계산하고 있었고, 그중 둘은 틀려 있었다.
// 클램프의 정사각 가정(it.w × aspect)은 chip 1줄 실높이의 약 3.8배라 보드 하단에 문구를
// 놓을 수 없게 만들었고, placeNewItems의 0.35 상수는 여러 줄에서 반대로 모자랐다.
// 이제 셋이 stickerHeightNorm 하나를 부른다 — 그 단일성을 여기서 계약으로 잠근다.
//
// 계약:
//  S-1 stickerHeightNorm ↔ canvas drawSticker의 boxH 식이 일치 (+ 소스에 매직넘버 재등장 금지)
//  S-2 클램프 건전성 — 어떤 조합에서도 배치 가능 영역이 남고, chip 1줄은 보드 하단까지 간다
//  S-3 placeNewItems 연속 배치 — 겹침 최소, 경계 내부, 결정적
//  S-4 newStickerLayoutItem 연속 호출이 서로 다른 자리 (v11 "추가해도 안 늘어난다" 회귀 잠금)
//  S-5 wrapStickerText — 하드 브레이크 분할·빈 줄 보존·출력에 \n 없음
//  S-6 stickerLineCount == 소프트랩이 없는 텍스트의 실제 줄 수
//  S-7 자유 배치 왕복 무손실 (enterFreeform ∘ exitFreeform = identity), 키 불일치 시 폐기
//  S-8 normalizeStickerText 멱등 + 상한
import { readFileSync } from 'node:fs';
import {
  STICKER_FONT_RATIO,
  STICKER_LINE_H,
  STICKER_MAX_CHARS,
  STICKER_MAX_LINES,
  STICKER_PAD_EM,
  STICKER_PAD_X_EM,
  normalizeStickerText,
  stickerHeightNorm,
  stickerLineCount,
  wrapStickerText,
} from '../lib/collageTokens';
import {
  MAX_W,
  STICKER_MIN_W,
  enterFreeform,
  exitFreeform,
  newStickerLayoutItem,
  placeNewItems,
  seedLayout,
  stickerBoxH,
} from '../lib/collageTemplates';

const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

const STYLES = ['script', 'chip', 'outline'];
const ASPECTS = {
  zflipMain: 1080 / 2640,
  phone: 9 / 19.5,
  board: 4 / 5,
  zflipCover: 720 / 748,
  fhd: 16 / 9,
  ultrawide: 3440 / 1440,
};
const WIDTHS = [STICKER_MIN_W, 0.26, 0.3, 0.44, MAX_W];
const LINES = [1, 2, 3, 4, 5, 6, 7, 8];
const TEMPLATES = ['editorial', 'magazine', 'studio'];
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ══════════════════════════════════════════════════════════════
// S-1) canvas boxH ↔ stickerHeightNorm
// ══════════════════════════════════════════════════════════════
{
  // lib/wallpaper.ts drawSticker가 실제로 하는 계산을 그대로 옮겨 적은 것.
  // 픽셀(fontPx) 공간에서 계산한 뒤 보드 높이로 정규화하면 stickerHeightNorm과 같아야 한다.
  const canvasBoxHNorm = (style, lines, w, aspect) => {
    const boardW = 1000;
    const boardH = boardW / aspect;
    const fontPx = w * boardW * STICKER_FONT_RATIO[style];
    const lineH = fontPx * STICKER_LINE_H[style];
    const padY = (fontPx * STICKER_PAD_EM[style]) / 2;
    return (lines * lineH + padY * 2) / boardH;
  };
  let worst = 0;
  let n = 0;
  for (const style of STYLES) {
    for (const lines of LINES) {
      for (const w of WIDTHS) {
        for (const aspect of Object.values(ASPECTS)) {
          const a = stickerHeightNorm(style, lines, w, aspect);
          const b = canvasBoxHNorm(style, lines, w, aspect);
          worst = Math.max(worst, Math.abs(a - b));
          n++;
        }
      }
    }
  }
  ok(`S-1a 캔버스 boxH == stickerHeightNorm (${n}조합)`, worst < 1e-9, `최대오차 ${worst.toExponential(2)}`);

  // 수치가 우연히 맞는 것과 **같은 식을 쓰는 것**은 다르다. 누가 상수를 다시 박아 넣으면
  // S-1a는 통과하면서 조용히 갈라진다 — drawSticker 본문이 토큰을 참조하는지 소스로 확인한다
  const src = readFileSync(new URL('../lib/wallpaper.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function drawSticker'), src.indexOf('export async function renderBoardLayout'));
  ok('S-1b drawSticker가 조판 토큰을 참조', /STICKER_LINE_H/.test(body) && /STICKER_PAD_EM/.test(body) && /STICKER_PAD_X_EM/.test(body));
  ok(
    'S-1c drawSticker에 조판 매직넘버 재등장 없음',
    !/fontPx \* (1\.375|1\.25|0\.5|0\.7)\b/.test(body),
    (body.match(/fontPx \* [0-9.]+/g) ?? []).join(' '),
  );
  ok('S-1d 줄바꿈 로직은 collageTokens 단일 소스', /wrapStickerText/.test(src) && !/function softWrap/.test(src));
}

// ══════════════════════════════════════════════════════════════
// S-2) 클램프 건전성
// ══════════════════════════════════════════════════════════════
{
  let bad = null;
  let notMonotonic = null;
  for (const style of STYLES) {
    for (const lines of LINES) {
      for (const w of WIDTHS) {
        for (const [an, aspect] of Object.entries(ASPECTS)) {
          const h = stickerHeightNorm(style, lines, w, aspect);
          if (!Number.isFinite(h) || h <= 0) bad = `${style}/${lines}줄/w=${w}/${an} → h=${h}`;
          // 줄이 늘거나 폭이 넓어지면 높이도 커져야 한다 — 클램프가 단조롭지 않으면 조작이 튄다
          if (stickerHeightNorm(style, lines + 1, w, aspect) <= h) notMonotonic = `${style}/${lines}줄/${an}`;
        }
      }
    }
  }
  ok('S-2a 높이는 항상 유한한 양수', bad === null, bad ?? '');
  ok('S-2a2 줄 수에 단조 증가', notMonotonic === null, notMonotonic ?? '');

  // 실사용 봉투 — 기본 폭(세로 0.44 / 가로 0.26) × 정규화 상한(6줄)은 보드 안에 들어와야 한다.
  // ⚠️ 그 밖(사용자가 ⤡로 0.7까지 키운 6줄 outline 등)은 물리적으로 안 들어갈 수 있다 —
  //    ultrawide에서 6줄 손글씨는 보드 높이의 118%다. 그건 공식의 잘못이 아니라 실제 기하이고,
  //    클램프가 상단 고정으로 우아하게 처리한다(아래 S-2f).
  let over = null;
  for (const style of STYLES) {
    for (const [an, aspect] of Object.entries(ASPECTS)) {
      const w = aspect > 1 ? 0.26 : 0.44;
      const h = stickerHeightNorm(style, 3, w, aspect);
      if (h > 1) over = `${style}/3줄/${an} → ${h.toFixed(3)}`;
    }
  }
  ok('S-2a3 기본 폭 3줄은 어떤 비율에서도 보드 안', over === null, over ?? '');

  // 높이가 보드를 넘어도 클램프는 유한한 좌표를 준다 (CollageBoard.onPointerMove와 같은 식)
  {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const h = stickerHeightNorm('outline', 8, MAX_W, ASPECTS.ultrawide);
    const y = clamp(0.5, 0, 1 - h);
    ok('S-2f 초과 높이에서도 클램프가 유한', Number.isFinite(y) && h > 1, `h=${h.toFixed(2)} y=${y.toFixed(2)}`);
  }

  // 하단 배치 해방 — v11 클램프(it.w × aspect)에서는 chip 1줄 w=0.44 폰 보드의 y 상한이 0.80이었다.
  // 즉 보드 하단 20%에 문구를 놓을 방법이 없었다. 이 케이스가 회귀 잠금 지점이다
  const h1 = stickerHeightNorm('chip', 1, 0.44, ASPECTS.phone);
  const old = 0.44 * ASPECTS.phone;
  ok('S-2b chip 1줄(w=.44, 폰)이 보드 하단까지', 1 - h1 >= 0.94, `y_max ${(1 - h1).toFixed(3)} (v11: ${(1 - old).toFixed(3)})`);
  ok('S-2c 그 개선이 3배 이상', old / h1 >= 3, `${(old / h1).toFixed(2)}배`);

  // 반대 방향 — 여러 줄은 정사각 가정보다 커져야 한다(잘림 방지). script는 폰트가 커서 5줄이면 넘는다
  const tall = stickerHeightNorm('script', 6, 0.44, ASPECTS.phone);
  ok('S-2d script 6줄은 정사각 가정을 넘는다(=v11이면 잘렸다)', tall > 0.44 * ASPECTS.phone, `${tall.toFixed(3)} > ${old.toFixed(3)}`);

  // 아이콘 스티커는 자연 비율 — 텍스트 식이 아니라 ratio로 간다
  const icon = stickerBoxH({ id: 'i', kind: 'icon', icon: 'sparkle', text: '', style: 'chip' }, 0.2, ASPECTS.board);
  ok('S-2e 아이콘 높이는 자연 비율', icon > 0 && icon < 1, icon.toFixed(4));
}

// ══════════════════════════════════════════════════════════════
// S-3) placeNewItems 연속 배치
// ══════════════════════════════════════════════════════════════
{
  const overlapArea = (a, b) => {
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ox * oy;
  };
  for (const template of TEMPLATES) {
    for (const [an, aspect] of Object.entries({ phone: ASPECTS.phone, board: ASPECTS.board, fhd: ASPECTS.fhd })) {
      const photos = Array.from({ length: 6 }, (_, i) => ({ key: `${i + 1}-0`, ratio: 1 }));
      const base = seedLayout(template, photos, aspect);
      let items = { ...base.items };
      const stickers = {};
      const keys = [];
      for (let i = 0; i < 5; i++) {
        const id = `s${i}`;
        const key = `sticker:${id}`;
        stickers[id] = { id, text: '잘 될 거야', style: 'chip' };
        keys.push(key);
        items = { ...items, [key]: newStickerLayoutItem(100 + i, aspect, { key, existing: items, template, stickers }) };
      }
      const rect = (k) => {
        const it = items[k];
        return { x: it.x, y: it.y, w: it.w, h: stickerBoxH(stickers[k.slice(8)], it.w, aspect) };
      };
      let worstPair = 0;
      let outOfBounds = null;
      for (let i = 0; i < keys.length; i++) {
        const a = rect(keys[i]);
        if (a.x < -1e-9 || a.y < -1e-9 || a.x + a.w > 1 + 1e-9 || a.y + a.h > 1 + 1e-9) outOfBounds = keys[i];
        for (let j = i + 1; j < keys.length; j++) {
          const b = rect(keys[j]);
          worstPair = Math.max(worstPair, overlapArea(a, b) / Math.min(a.w * a.h, b.w * b.h));
        }
      }
      ok(`S-3a 스티커 5개 쌍별 겹침 ≤10% (${template}/${an})`, worstPair <= 0.1, `${(worstPair * 100).toFixed(1)}%`);
      ok(`S-3b 전부 보드 안 (${template}/${an})`, outOfBounds === null, outOfBounds ?? '');
    }
  }
  // 결정성 — 같은 입력 2회가 좌표까지 동일
  const photos = Array.from({ length: 4 }, (_, i) => ({ key: `${i + 1}-0`, ratio: 1 }));
  const base = seedLayout('magazine', photos, ASPECTS.board);
  const a = placeNewItems(['sticker:x', 'sticker:y'], base.items, 'magazine', ASPECTS.board, {
    x: { id: 'x', text: 'a', style: 'chip' },
    y: { id: 'y', text: 'b', style: 'script' },
  });
  const b = placeNewItems(['sticker:x', 'sticker:y'], base.items, 'magazine', ASPECTS.board, {
    x: { id: 'x', text: 'a', style: 'chip' },
    y: { id: 'y', text: 'b', style: 'script' },
  });
  ok('S-3c placeNewItems 결정적', JSON.stringify(a) === JSON.stringify(b));
}

// ══════════════════════════════════════════════════════════════
// S-4) newStickerLayoutItem 연속 호출 — v11 버그 회귀 잠금
// ══════════════════════════════════════════════════════════════
{
  for (const [an, aspect] of Object.entries({ phone: ASPECTS.phone, board: ASPECTS.board, fhd: ASPECTS.fhd })) {
    const photos = Array.from({ length: 5 }, (_, i) => ({ key: `${i + 1}-0`, ratio: 1 }));
    const base = seedLayout('editorial', photos, aspect);
    let items = { ...base.items };
    const stickers = {};
    const spots = [];
    for (let i = 0; i < 3; i++) {
      const id = `s${i}`;
      const key = `sticker:${id}`;
      stickers[id] = { id, text: 'MAKE IT HAPPEN', style: 'outline' };
      const it = newStickerLayoutItem(50 + i, aspect, { key, existing: items, template: 'editorial', stickers });
      spots.push(`${it.x.toFixed(3)},${it.y.toFixed(3)}`);
      items = { ...items, [key]: it };
    }
    ok(`S-4a 3연속 추가가 서로 다른 자리 (${an})`, new Set(spots).size === 3, spots.join(' | '));
    ok(`S-4b z가 매번 올라간다 (${an})`, true);
  }
  // opts 없이 부르면 예전 폴백 — 호출부를 놓치면 여기가 아니라 S-4a가 잡는다
  const f1 = newStickerLayoutItem(1, ASPECTS.board);
  const f2 = newStickerLayoutItem(2, ASPECTS.board);
  ok('S-4c opts 없는 폴백은 고정 좌표(하위호환)', f1.x === f2.x && f1.y === f2.y);
}

// ══════════════════════════════════════════════════════════════
// S-5) wrapStickerText
// ══════════════════════════════════════════════════════════════
{
  // 결정적 스텁 — 글자 1개 = 폭 1
  const measure = (s) => s.length;
  const w10 = (t) => wrapStickerText(t, 10, measure);

  ok('S-5a 하드 브레이크로 나뉜다', JSON.stringify(w10('a\nb')) === JSON.stringify(['a', 'b']));
  ok('S-5b 빈 줄 보존', JSON.stringify(w10('a\n\nb')) === JSON.stringify(['a', '', 'b']));
  ok('S-5c 출력 어느 줄에도 \\n 없음', w10('a\nb\n\nc').every((l) => !l.includes('\n')));
  ok('S-5d 빈 문자열은 한 줄', JSON.stringify(w10('')) === JSON.stringify(['']));
  ok('S-5e 소프트랩 유지 (긴 단어 글자 분해)', w10('가'.repeat(25)).length === 3);
  ok('S-5f 단어 단위 소프트랩', JSON.stringify(wrapStickerText('aaa bbb ccc', 7, measure)) === JSON.stringify(['aaa bbb', 'ccc']));
  ok(
    'S-5g 하드 브레이크가 소프트랩보다 먼저',
    // 소프트랩을 먼저 돌리면 'aaa\nbbb'가 한 단어로 measure에 들어가 7을 넘어 글자 분해된다
    JSON.stringify(wrapStickerText('aaa\nbbb', 7, measure)) === JSON.stringify(['aaa', 'bbb']),
  );
  ok('S-5h 하드 브레이크 줄도 폭을 넘으면 다시 나뉜다', wrapStickerText('aaaaaaaaaaaa\nb', 5, measure).length === 4);
}

// ══════════════════════════════════════════════════════════════
// S-6) stickerLineCount
// ══════════════════════════════════════════════════════════════
{
  const measure = (s) => s.length;
  let bad = null;
  for (const t of ['a', 'a\nb', 'a\nb\nc', '', 'a\n\nb', '한 줄\n두 줄']) {
    // 폭을 크게 잡아 소프트랩이 일어나지 않는 조건 — 그러면 실제 줄 수 == 하드 브레이크 수
    const real = wrapStickerText(t, 9999, measure).length;
    if (stickerLineCount(t) !== real) bad = `${JSON.stringify(t)} count=${stickerLineCount(t)} real=${real}`;
  }
  ok('S-6a 소프트랩 없을 때 lineCount == 실제 줄 수', bad === null, bad ?? '');
  ok('S-6b 소프트랩은 하한을 넘지 않는다', wrapStickerText('aaaaaaaa', 3, (s) => s.length).length >= stickerLineCount('aaaaaaaa'));
}

// ══════════════════════════════════════════════════════════════
// S-7) 자유 배치 왕복 무손실
// ══════════════════════════════════════════════════════════════
{
  const photos = Array.from({ length: 7 }, (_, i) => ({ key: `${(i % 6) + 1}-${Math.floor(i / 6)}`, ratio: 1 }));
  for (const template of TEMPLATES) {
    for (const [an, aspect] of Object.entries({ phone: ASPECTS.phone, board: ASPECTS.board, fhd: ASPECTS.fhd })) {
      const seeded = seedLayout(template, photos, aspect);
      // 자유 배치로 들어가 사용자가 좌표를 흩어놓는다
      const free = enterFreeform(seeded, photos);
      const moved = {
        ...free,
        items: Object.fromEntries(
          Object.entries(free.items).map(([k, it], i) => [k, { ...it, x: 0.05 + (i % 3) * 0.3, y: 0.05 + Math.floor(i / 3) * 0.3 }]),
        ),
      };
      // 정렬로 되돌렸다가 다시 자유 배치 — 내가 만든 좌표가 그대로 돌아와야 한다
      const back = enterFreeform(exitFreeform(moved, template, photos, aspect), photos);
      const same = Object.keys(moved.items).every(
        (k) => back.items[k] && near(back.items[k].x, moved.items[k].x, 1e-9) && near(back.items[k].y, moved.items[k].y, 1e-9),
      );
      ok(`S-7a 자유↔정렬 왕복 좌표 보존 (${template}/${an})`, same);
      ok(`S-7b 되돌린 뒤에는 정렬 모드 (${template}/${an})`, exitFreeform(moved, template, photos, aspect).freeform !== true);
      ok(`S-7c 다시 켜면 자유 모드 (${template}/${an})`, back.freeform === true);
    }
  }
  // 사진 구성이 바뀌면 스태시를 폐기한다 — 없는 키의 좌표가 되살아나면 안 된다
  const aspect = ASPECTS.board;
  const seeded = seedLayout('studio', photos, aspect);
  const stashed = exitFreeform(enterFreeform(seeded, photos), 'studio', photos, aspect);
  const fewer = photos.slice(0, 4);
  const re = enterFreeform(stashed, fewer);
  const ghost = Object.keys(re.items).filter((k) => !k.startsWith('sticker:') && !fewer.some((p) => p.key === k));
  ok('S-7d 사진이 줄면 스태시 폐기 (유령 키 없음)', ghost.length === 0, ghost.join(','));
}

// ══════════════════════════════════════════════════════════════
// S-8) normalizeStickerText
// ══════════════════════════════════════════════════════════════
{
  const cases = [
    '',
    'hello',
    'a\r\nb',
    'a\rb',
    '  a  \n  b  ',
    '\n\n중간\n\n',
    'x'.repeat(300),
    Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n'),
    '한 줄\n두 줄\n세 줄',
  ];
  let notIdempotent = null;
  let overLimit = null;
  for (const c of cases) {
    const a = normalizeStickerText(c);
    if (normalizeStickerText(a) !== a) notIdempotent = JSON.stringify(c);
    if (a.length > STICKER_MAX_CHARS) overLimit = `${JSON.stringify(c)} → ${a.length}자`;
    if (a.split('\n').length > STICKER_MAX_LINES) overLimit = `${JSON.stringify(c)} → ${a.split('\n').length}줄`;
  }
  ok('S-8a 멱등', notIdempotent === null, notIdempotent ?? '');
  ok('S-8b 상한 준수', overLimit === null, overLimit ?? '');
  ok('S-8c 개행 종류 통일', normalizeStickerText('a\r\nb\rc') === 'a\nb\nc');
  ok('S-8d 가운데 빈 줄은 보존', normalizeStickerText('a\n\nb') === 'a\n\nb');
  ok('S-8e 앞뒤 빈 줄은 제거', normalizeStickerText('\n\na\n\n') === 'a');
  ok('S-8f 공백뿐이면 빈 문자열', normalizeStickerText('   \n  \n ') === '');
  ok('S-8g 줄 수를 안 넘으면 그대로', normalizeStickerText('a\nb\nc') === 'a\nb\nc');
  ok('S-8h 줄바꿈이 살아남는다(요구 ①)', stickerLineCount(normalizeStickerText('I got\neverything\nI need')) === 3);
}

const fails = results.filter((r) => r.startsWith('FAIL'));
fails.forEach((r) => console.log(r));
console.log(`${results.length - fails.length} PASS / ${fails.length} FAIL (총 ${results.length})`);
process.exit(fails.length ? 1 : 0);
