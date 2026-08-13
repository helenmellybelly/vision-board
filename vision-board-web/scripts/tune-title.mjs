// 타이틀 조판 상수 역산 (v11) — npx tsx scripts/tune-title.mjs [--fonts]
//
// 왜 있나: v11은 타이틀 카드 크기를 "스타일별 고정 w/h 테이블"이 아니라 **글자 내용에서 해석적으로**
// 계산한다(그래야 '연도만' → 카드 축소, '가로 배치' → 넓은 스트립이 공짜로 나온다).
// 그러려면 실제 웹폰트의 advance·ink 높이를 알아야 하는데, 그건 추측할 수 있는 값이 아니다.
// 여기서 실측해 collageTokens.ts에 박는다.
//
// 두 모드:
//   --fonts  폰트 실측만 (Step 0 — titleLayoutFor가 아직 없어도 돈다)
//   (기본)   폰트 실측 + BETA/FMAX/기본 배율 스윕 (Step 6 — collageTokens에 titleLayoutFor 필요)
//
// CI에는 넣지 않는다(느리고, 리포트지 계약이 아니다). 계약 고정은 scripts/verify-title.js가 한다.
// tune-justify.mjs와 같은 취급.

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const FONTS_ONLY = process.argv.includes('--fonts');

const LABEL = 'VISION BOARD';
const SANS = '"Pretendard Variable", Pretendard, sans-serif';
const SCRIPT = '"Enjoystories", cursive';
/** 실제로 쓰일 만한 연도 — 자릿수 폭이 가장 넓은 조합을 찾는다 */
const YEARS = Array.from({ length: 16 }, (_, i) => String(2026 + i));

const fmt = (v, d = 4) => v.toFixed(d);

// ── ① 폰트 실측 ───────────────────────────────────────────────────────────
// 1em(=100px) 기준으로 재서 em 단위 상수로 환산한다. 폰트가 바뀌지 않는 한 불변.

async function measureFonts() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  const out = await page.evaluate(
    async ({ LABEL, SANS, SCRIPT, YEARS }) => {
      await Promise.all([
        document.fonts.load('700 100px "Enjoystories"'),
        document.fonts.load('600 100px "Pretendard Variable"'),
      ]);
      await document.fonts.ready;

      const c = document.createElement('canvas');
      const g = c.getContext('2d');
      const EM = 100;
      const canTrack = 'letterSpacing' in g;

      const ink = (text) => {
        const m = g.measureText(text);
        return {
          adv: m.width / EM,
          asc: (m.actualBoundingBoxAscent ?? 0) / EM,
          desc: (m.actualBoundingBoxDescent ?? 0) / EM,
          fAsc: (m.fontBoundingBoxAscent ?? 0) / EM,
          fDesc: (m.fontBoundingBoxDescent ?? 0) / EM,
        };
      };

      // 라벨 — 자간 0에서의 순수 advance
      g.font = `600 ${EM}px ${SANS}`;
      if (canTrack) g.letterSpacing = '0px';
      const label = ink(LABEL);
      const labelCharSum =
        LABEL.split('').reduce((a, ch) => a + g.measureText(ch).width, 0) / EM;

      // 자간 모델 검증: CSS/canvas letterSpacing은 **마지막 글자 뒤에도** 붙는다(n배).
      let trackModel = null;
      if (canTrack) {
        g.letterSpacing = '0.42em';
        const w042 = g.measureText(LABEL).width / EM;
        g.letterSpacing = '0px';
        trackModel = {
          measured: w042,
          predNTimes: label.adv + 0.42 * LABEL.length,
          predNMinus1: label.adv + 0.42 * (LABEL.length - 1),
        };
      }

      // 연도 — 가장 넓은 4자리와 숫자 1자 최대폭
      g.font = `700 ${EM}px ${SCRIPT}`;
      if (canTrack) g.letterSpacing = '0px';
      let widest = { year: YEARS[0], ...ink(YEARS[0]) };
      for (const y of YEARS) {
        const m = ink(y);
        if (m.adv > widest.adv) widest = { year: y, ...m };
      }
      const digitMax = Math.max(
        ...'0123456789'.split('').map((d) => g.measureText(d).width / EM),
      );

      // 폰트가 실제로 적용됐는지 — 폴백(system sans)이면 두 측정이 같아진다
      g.font = `700 ${EM}px sans-serif`;
      const fallbackYear = g.measureText(widest.year).width / EM;

      return { canTrack, label, labelCharSum, trackModel, widest, digitMax, fallbackYear };
    },
    { LABEL, SANS, SCRIPT, YEARS },
  );

  await browser.close();
  return out;
}

// ── ② 스윕 ────────────────────────────────────────────────────────────────
// titleUnit(aspect)·기본 배율은 모든 치수에 **균일한 배수**로 곱해진다.
// 따라서 배율 m을 바꾼 결과는 baseline(m=1) 측정값에 m을 곱한 것과 같다 —
// 후보마다 titleLayoutFor를 다시 부를 필요 없이 baseline 한 번으로 전 조합을 평가할 수 있다.

/** 실제 프리셋 (lib/wallpaper.ts WALLPAPER_PRESETS와 락스텝 — 여기 값을 고칠 땐 저기도 본다) */
const PRESETS = [
  { id: 'phone', w: 1170, h: 2532 },
  { id: 'iphone-pm', w: 1290, h: 2796 },
  { id: 'zflip-main', w: 1080, h: 2640 },
  { id: 'zflip-cover', w: 720, h: 748 },
  { id: 'tablet', w: 1668, h: 2388 },
  { id: 'pc-fhd', w: 1920, h: 1080 },
  { id: 'pc-qhd', w: 2560, h: 1440 },
  { id: 'macbook', w: 2560, h: 1664 },
  { id: 'ultrawide', w: 3440, h: 1440 },
];

/** 화면상 보드의 짧은 변(px) — CollageBoard의 maxWidth 공식 그대로.
 *  --board-reserve: 모바일 13rem, lg PC뷰 20.5rem / lg 폰뷰 10rem (app/collage/page.tsx) */
function screenMinDim(aspect, vw, vh, reserveRem, padX = 32) {
  const budget = vh - reserveRem * 16;
  const w = Math.min(vw - padX, budget * aspect);
  const h = w / aspect;
  return Math.min(w, h);
}

const SCREENS = [
  { id: 'phone-390', aspect: 1170 / 2532, minDim: screenMinDim(1170 / 2532, 390, 844, 13) },
  { id: 'pc-1280', aspect: 16 / 9, minDim: screenMinDim(16 / 9, 1280, 900, 20.5, 0) },
];

async function sweep(fonts) {
  let tokens;
  try {
    tokens = await import('../lib/collageTokens');
  } catch (e) {
    console.log(`\n[스윕 생략] collageTokens 로드 실패 — ${String(e).slice(0, 120)}`);
    return;
  }
  if (typeof tokens.titleLayoutFor !== 'function') {
    console.log('\n[스윕 생략] titleLayoutFor가 아직 없다 (Step 1 이후에 다시 돌릴 것)');
    return;
  }
  const { titleLayoutFor, TEMPLATE_TITLE_DEFAULT } = tokens;

  const TEMPLATES = ['editorial', 'magazine', 'studio'];

  /**
   * 배율 1 기준선.
   *
   * ⚠️ 정규화가 필수다 — titleLayoutFor는 **이미 박힌** TITLE_BASE_SCALE·TITLE_UNIT_BETA를
   *    적용해 돌려준다. 그걸 그대로 기준선으로 쓰면 후보 배율이 이중으로 곱해져,
   *    상수를 한 번 박은 뒤 스크립트를 다시 돌리는 순간 결과가 조용히 틀린다.
   *    반환값의 `effScale`로 나누면 어떤 상수 상태에서도 같은 기준선이 나온다(전부 eff에 선형).
   */
  const base = (style, anchor, dir, parts, aspect) => {
    const L = titleLayoutFor(
      { style, anchor, dir, parts, bg: 'soft', ink: 'auto', scale: 1 },
      aspect,
      '#FFFFFF',
    );
    const e = L.effScale;
    return {
      box: { w: L.box.w / e, h: L.box.h / e },
      lines: L.lines.map((l) => ({ kind: l.kind, size: l.size / e })),
    };
  };

  // 후보 배율
  const mult = (aspect, beta, fmax, s) => {
    const r = Math.sqrt(Math.max(aspect, 1 / aspect));
    return s * Math.min(fmax, 1 + beta * (r - 1));
  };

  const cands = [];
  for (let beta = 0; beta <= 1.0001; beta += 0.05) {
    for (let fmax = 1.0; fmax <= 1.5001; fmax += 0.05) {
      for (let s = 0.85; s <= 1.4001; s += 0.05) cands.push({ beta, fmax, s });
    }
  }

  // ⚠️ 하한은 **폰트 크기(px)**로 잰다. ink 높이(=0.73×폰트)로 재면 같은 숫자라도 훨씬 엄한 조건이
  //    되어(첫 스윕에서 통과 후보 0건) 실제로 필요한 것보다 타이틀을 크게 만든다.
  // ⚠️ 하한 검사는 **템플릿 기본 스타일**에만 건다. bold·line을 일부러 고른 사용자에게까지
  //    band 기준을 강요하면 band가 보드를 잡아먹는다 — 기본 상태가 읽히면 되는 것이 계약이다.
  // 실제 코드는 상한(w≤0.92 · h≤0.5)에 걸리면 박스를 자르는 대신 **배율을 낮춘다**.
  // 스윕도 같은 규칙을 써야 "요청 배율"이 아니라 "실제 적용 배율"로 하한을 판정한다
  const effMult = (L, m) => Math.min(m, 0.92 / L.box.w, 0.5 / L.box.h);

  const scored = [];
  for (const c of cands) {
    // 목적함수: 프리셋 전반에서 "연도 존재감(연도 ink 높이 / 보드 대각선)"의 변동 최소화 —
    // 폰에서만 작아 보이던 구조 원인이 바로 이 값의 1.8배 편차였다
    // ⚠️ 존재감 변동은 **템플릿별로** 잰 뒤 평균한다. 세 템플릿을 한 통에 넣으면 스타일 차이
    //    (라인의 연도는 원래 작다)가 분산을 지배해 정작 재고 싶은 **비율 간 편차**가 묻힌다
    const presenceBy = { editorial: [], magazine: [], studio: [] };
    let worstScreenLabel = Infinity;
    let worstScreenYear = Infinity;
    let worstExportYear = Infinity;
    let maxAreaDefault = 0;

    for (const p of PRESETS) {
      const aspect = p.w / p.h;
      const minDim = Math.min(p.w, p.h);
      const diag = Math.hypot(p.w, p.h);
      const m = mult(aspect, c.beta, c.fmax, c.s);

      for (const t of TEMPLATES) {
        const d = TEMPLATE_TITLE_DEFAULT[t];
        const L = base(d.style, d.anchor, d.style === 'line' ? 'h' : 'v', 'all', aspect);
        const yr = L.lines.find((l) => l.kind === 'year');
        if (!yr) continue;
        const me = effMult(L, m);
        presenceBy[t].push((yr.size * minDim * me * fonts.inkYear) / diag);
        maxAreaDefault = Math.max(maxAreaDefault, L.box.w * L.box.h * me * me);
        worstExportYear = Math.min(worstExportYear, yr.size * minDim * me);
      }
    }

    for (const sc of SCREENS) {
      const m = mult(sc.aspect, c.beta, c.fmax, c.s);
      for (const t of TEMPLATES) {
        const d = TEMPLATE_TITLE_DEFAULT[t];
        const L = base(d.style, d.anchor, d.style === 'line' ? 'h' : 'v', 'all', sc.aspect);
        const lb = L.lines.find((l) => l.kind === 'label');
        const yr = L.lines.find((l) => l.kind === 'year');
        const me = effMult(L, m);
        if (lb) worstScreenLabel = Math.min(worstScreenLabel, lb.size * sc.minDim * me);
        if (yr) worstScreenYear = Math.min(worstScreenYear, yr.size * sc.minDim * me);
      }
    }

    const cvs = Object.values(presenceBy).map((list) => {
      const mean = list.reduce((a, v) => a + v, 0) / list.length;
      const varc = list.reduce((a, v) => a + (v - mean) ** 2, 0) / list.length;
      return Math.sqrt(varc) / mean;
    });
    scored.push({
      ...c,
      cv: cvs.reduce((a, v) => a + v, 0) / cvs.length, // 템플릿별 변동계수의 평균
      screenLabel: worstScreenLabel,
      screenYear: worstScreenYear,
      exportYear: worstExportYear,
      area: maxAreaDefault,
    });
  }

  // 하드 제약
  //  화면 라벨 11px = 기존 타입스케일 text-micro (새 숫자를 지어내지 않는다)
  //  화면 연도 20px = 라인 스타일(얇은 스트립·작은 연도)까지 감안한 선. 24px로 잡으면
  //    라인이 밴드만큼 커져야 해서 "얇은 스트립"이라는 스타일 정체성이 사라진다
  //  내보내기 연도 28px = 가장 작은 프리셋(720×748)에서도 주인공으로 읽히는 선
  //  면적 14% = 오너가 지적한 "정중앙 밴드가 사진을 통째로 덮는다"의 정량화
  const PASS = (r) =>
    r.screenLabel >= 11 && r.screenYear >= 20 && r.exportYear >= 28 && r.area <= 0.14;

  const pass = scored.filter(PASS).sort((a, b) => a.cv - b.cv || Math.abs(a.s - 1) - Math.abs(b.s - 1));

  console.log('\n== 스윕 결과 ==');
  console.log(`후보 ${scored.length}건 · 제약 통과 ${pass.length}건`);
  if (!pass.length) {
    console.log('제약을 통과하는 조합이 없다 — 제약별 최악값 상위 5건:');
    scored
      .slice()
      .sort((a, b) => a.cv - b.cv)
      .slice(0, 5)
      .forEach((r) =>
        console.log(
          `  β=${fmt(r.beta, 2)} fmax=${fmt(r.fmax, 2)} s=${fmt(r.s, 2)}  cv=${fmt(r.cv)}  ` +
            `화면라벨=${fmt(r.screenLabel, 1)} 화면연도=${fmt(r.screenYear, 1)} ` +
            `내보내기연도=${fmt(r.exportYear, 1)} 면적=${fmt(r.area, 3)}`,
        ),
      );
    return;
  }
  console.log('상위 10:');
  pass.slice(0, 10).forEach((r) =>
    console.log(
      `  β=${fmt(r.beta, 2)} fmax=${fmt(r.fmax, 2)} s=${fmt(r.s, 2)}  cv=${fmt(r.cv)}  ` +
        `화면라벨=${fmt(r.screenLabel, 1)}px 화면연도=${fmt(r.screenYear, 1)}px ` +
        `내보내기연도=${fmt(r.exportYear, 1)}px 면적=${fmt(r.area, 3)}`,
    ),
  );
  const best = pass[0];
  console.log(
    `\n>> 채택 후보: TITLE_UNIT_BETA=${fmt(best.beta, 2)} TITLE_UNIT_FMAX=${fmt(best.fmax, 2)} ` +
      `TITLE_BASE_SCALE=${fmt(best.s, 2)}`,
  );

  // 채택안의 프리셋별 실측 — 이 표가 "폰에서만 작다"가 실제로 해소됐는지의 증거다
  console.log('\n== 채택안 프리셋별 (템플릿 기본 스타일) ==');
  console.log('  프리셋        비율   배율   연도px  라벨px  존재감(연도/대각선)  카드면적');
  for (const p of PRESETS) {
    const aspect = p.w / p.h;
    const minDim = Math.min(p.w, p.h);
    const diag = Math.hypot(p.w, p.h);
    const m = mult(aspect, best.beta, best.fmax, best.s);
    const d = TEMPLATE_TITLE_DEFAULT.editorial;
    const L = base(d.style, d.anchor, 'v', 'all', aspect);
    const yr = L.lines.find((l) => l.kind === 'year');
    const lb = L.lines.find((l) => l.kind === 'label');
    console.log(
      `  ${p.id.padEnd(12)} ${fmt(aspect, 2)}  ${fmt(m, 2)}  ` +
        `${(yr.size * minDim * m).toFixed(0).padStart(5)}  ${(lb.size * minDim * m).toFixed(0).padStart(5)}  ` +
        `${fmt((yr.size * minDim * m * fonts.inkYear) / diag, 4).padStart(16)}  ` +
        `${fmt(L.box.w * L.box.h * m * m, 3).padStart(7)}`,
    );
  }
  console.log('\n== 화면 미리보기 (실제 보드 폭) ==');
  for (const sc of SCREENS) {
    const m = mult(sc.aspect, best.beta, best.fmax, best.s);
    for (const t of TEMPLATES) {
      const d = TEMPLATE_TITLE_DEFAULT[t];
      const L = base(d.style, d.anchor, d.style === 'line' ? 'h' : 'v', 'all', sc.aspect);
      const yr = L.lines.find((l) => l.kind === 'year');
      const lb = L.lines.find((l) => l.kind === 'label');
      console.log(
        `  ${sc.id.padEnd(10)} ${t.padEnd(10)} 보드 ${sc.minDim.toFixed(0)}px → ` +
          `라벨 ${(lb.size * sc.minDim * m).toFixed(1)}px · 연도 ${(yr.size * sc.minDim * m).toFixed(1)}px`,
      );
    }
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────────

const f = await measureFonts();

console.log('== 폰트 실측 (1em 기준) ==');
console.log(`ctx.letterSpacing 지원: ${f.canTrack}`);
console.log(
  `라벨 '${LABEL}'  advance=${fmt(f.label.adv)}em  (글자합=${fmt(f.labelCharSum)}em)  ` +
    `ink asc=${fmt(f.label.asc)} desc=${fmt(f.label.desc)} → 높이 ${fmt(f.label.asc + f.label.desc)}em`,
);
console.log(
  `  font box: asc=${fmt(f.label.fAsc)} desc=${fmt(f.label.fDesc)} → ${fmt(f.label.fAsc + f.label.fDesc)}em`,
);
if (f.trackModel) {
  const t = f.trackModel;
  const dN = Math.abs(t.measured - t.predNTimes);
  const dN1 = Math.abs(t.measured - t.predNMinus1);
  console.log(
    `  자간 0.42em 실측=${fmt(t.measured)}  n배예측=${fmt(t.predNTimes)}(Δ${fmt(dN)})  ` +
      `n-1배예측=${fmt(t.predNMinus1)}(Δ${fmt(dN1)}) → 모델: ${dN <= dN1 ? 'n배 (마지막 글자 뒤에도 붙음)' : 'n-1배'}`,
  );
}
console.log(
  `연도 최대폭 '${f.widest.year}'  advance=${fmt(f.widest.adv)}em (자당 ${fmt(f.widest.adv / 4)}em)  ` +
    `숫자1자 최대=${fmt(f.digitMax)}em`,
);
console.log(
  `  ink asc=${fmt(f.widest.asc)} desc=${fmt(f.widest.desc)} → 높이 ${fmt(f.widest.asc + f.widest.desc)}em  ` +
    `font box=${fmt(f.widest.fAsc + f.widest.fDesc)}em`,
);
console.log(
  `  폰트 적용 확인: Enjoystories=${fmt(f.widest.adv)} vs system sans=${fmt(f.fallbackYear)} → ` +
    (Math.abs(f.widest.adv - f.fallbackYear) > 0.01 ? '✅ 웹폰트 적용됨' : '⚠️ 폴백 의심 — 측정 무효'),
);

console.log('\n== collageTokens.ts에 박을 값 ==');
console.log(`  LABEL_ADVANCE_EM = ${fmt(f.label.adv, 3)}   // 'VISION BOARD' 자간 0`);
console.log(`  YEAR_ADVANCE_EM  = ${fmt(f.digitMax, 3)}   // 숫자 1자 최대폭`);
console.log(`  LINE_H_SANS      = ${fmt(f.label.asc + f.label.desc, 3)}   // 라벨 ink 높이`);
console.log(`  LINE_H_SCRIPT    = ${fmt(f.widest.asc + f.widest.desc, 3)}   // 연도 ink 높이`);

if (!FONTS_ONLY) {
  await sweep({
    inkLabel: f.label.asc + f.label.desc,
    inkYear: f.widest.asc + f.widest.desc,
  });
}
