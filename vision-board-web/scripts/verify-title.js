// 타이틀 기하 계약 (v11) — npx tsx scripts/verify-title.js
//
// verify-justify.js와 나눠 둔다: 저기는 **사진 솔버**의 계약이고, 여기는 **타이틀 카드**의 계약이다.
// ⚠️ .claude/run-all-v86.mjs에 등록돼 있어야 일괄 러너가 집는다(안 그러면 조용히 안 돌아간다).
//
// 계약:
//  ① 카드가 항상 보드 안 — 범위 밖 pos를 넣어도 (읽기 시점 클램프의 증명)
//  ② 폭·높이 상한을 넘지 않는다
//  ③ parts='none' → visible=false, lines=[]
//  ④ 배율 단조성 — scale↑ ⇒ 카드·글자 비감소
//  ⑤ parts 축소 — 한쪽을 지우면 그 축이 실제로 줄어든다
//  ⑥ dir='h' — 두 줄의 세로 중심이 같고, 카드가 가로로 길다
//  ⑦ 글자가 카드 안에 들어간다 (해석적 박스의 사활)
//  ⑧ 글자 크기 하한 — 가장 작은 프리셋에서도 읽을 수 있다
//  ⑨ 앵커 순서 — l<c<r, t<m<b가 엄격 단조
//  ⑩ 대비 — 3배경 × 2테마 × 최악 사진(검정/흰색)에서 ≥3.0 (clear는 그림자 필수)
//  ⑪ v10 타이포 스냅샷 — 글자 크기 비율·자간이 v10과 동일 (박스만 내용 기반으로 조여진다)
//  ⑫ aspect 교차 — A에서 저장한 pos를 B에서 읽어도 ①이 성립
//  ⑬ 순수성 — 같은 입력 → 같은 출력
//  ⑭ 조판 리듬 상수가 합리적 범위 안 (드리프트 방지)

import {
  titleLayoutFor,
  resolveTitleConfig,
  compositeContrast,
  nearestAnchor,
  titleUnit,
  TITLE_ANCHORS,
  TITLE_STYLES,
  TITLE_DIRS,
  TITLE_PARTS,
  TITLE_BGS,
  TITLE_CARD_ALPHA,
  TITLE_CARD_HEX,
  TITLE_SCALE_MIN,
  TITLE_SCALE_MAX,
  TITLE_BASE_SCALE,
  TITLE_LABEL_ADVANCE_EM,
  TITLE_LABEL_CHARS,
  TITLE_YEAR_ADVANCE_EM,
  TITLE_DEFAULT_BG,
  TEMPLATE_TITLE_DEFAULT,
  minDimNormX,
} from '../lib/collageTokens';

const EPS = 1e-9;
const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

const ASPECTS = {
  zflipMain: 1080 / 2640,
  phone: 1170 / 2532,
  tablet: 1668 / 2388,
  zflipCover: 720 / 748,
  fhd: 16 / 9,
  macbook: 2560 / 1664,
  ultrawide: 3440 / 1440,
};
const SCALES = [TITLE_SCALE_MIN, 0.85, 1, 1.3, TITLE_SCALE_MAX];
const BGS_HEX = ['#FFFFFF', '#F4F1EC', '#1C1B19']; // 라이트 2 · 다크 1
/** 범위 밖 좌표 — 클램프가 실제로 도는지 보는 입력 */
const WILD_POS = [
  { x: -0.5, y: -0.5 },
  { x: 1.4, y: 1.4 },
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0.5, y: -2 },
  { x: -3, y: 0.5 },
];

const cfg = (o) => ({
  style: 'band',
  anchor: 'mc',
  dir: 'v',
  parts: 'all',
  bg: 'soft',
  ink: 'auto',
  scale: 1,
  ...o,
});

// ── ①②⑥⑦ 전 조합 스윕 ─────────────────────────────────────────────
let swept = 0;
let inside = 0;
let capped = 0;
let overflow = 0;
let hMismatch = 0;
let hNotWide = 0;
let capViolate = 0;
let worstFit = Infinity;

for (const [aName, aspect] of Object.entries(ASPECTS)) {
  const nx = minDimNormX(aspect);
  for (const style of TITLE_STYLES) {
    for (const dir of TITLE_DIRS) {
      for (const parts of TITLE_PARTS) {
        for (const bg of TITLE_BGS) {
          for (const scale of SCALES) {
            for (const anchor of TITLE_ANCHORS) {
              for (const pos of [undefined, ...WILD_POS]) {
                const L = titleLayoutFor(cfg({ style, anchor, dir, parts, bg, scale, pos }), aspect, '#FFFFFF');
                if (parts === 'none') continue;
                swept++;
                const b = L.box;
                if (b.x >= -EPS && b.y >= -EPS && b.x + b.w <= 1 + EPS && b.y + b.h <= 1 + EPS) inside++;
                if (b.w <= 0.92 + EPS && b.h <= 0.5 + EPS) capped++;
                else capViolate++;

                // ⑦ 글자가 카드 안에 — advance 예측식은 토큰의 박스 계산과 같은 규칙이다
                for (const l of L.lines) {
                  const adv =
                    l.kind === 'label'
                      ? l.size * (TITLE_LABEL_ADVANCE_EM + l.tracking * TITLE_LABEL_CHARS) * nx
                      : l.size * TITLE_YEAR_ADVANCE_EM * 4 * nx;
                  const left = l.align === 'left' ? l.x : l.align === 'right' ? l.x - adv : l.x - adv / 2;
                  const right = left + adv;
                  const slackL = left - b.x;
                  const slackR = b.x + b.w - right;
                  worstFit = Math.min(worstFit, slackL, slackR);
                  if (slackL < -1e-6 || slackR < -1e-6) overflow++;
                }

                // ⑥ dir='h'
                if (dir === 'h' && L.lines.length === 2) {
                  if (Math.abs(L.lines[0].cy - L.lines[1].cy) > 1e-9) hMismatch++;
                  if ((b.w / b.h) * aspect <= 1) hNotWide++;
                }
              }
            }
          }
        }
      }
    }
  }
  void aName;
}
ok(`① 카드가 보드 안 (${swept}조합)`, inside === swept, `${inside}/${swept}`);
ok('② 폭·높이 상한 준수', capViolate === 0, `위반 ${capViolate}`);
ok('⑥ 가로 배치 — 두 줄 세로 중심 일치', hMismatch === 0, `불일치 ${hMismatch}`);
ok('⑥ 가로 배치 — 카드가 가로로 길다', hNotWide === 0, `위반 ${hNotWide}`);
ok('⑦ 글자가 카드 안', overflow === 0, `넘침 ${overflow} · 최소 여유 ${worstFit.toFixed(5)}`);

// ①을 정확히 다시 — parts='none' 제외하고 전수 확인
{
  let bad = 0;
  for (const [, aspect] of Object.entries(ASPECTS)) {
    for (const style of TITLE_STYLES) {
      for (const anchor of TITLE_ANCHORS) {
        for (const pos of [undefined, ...WILD_POS]) {
          for (const scale of SCALES) {
            const b = titleLayoutFor(cfg({ style, anchor, scale, pos }), aspect, '#FFFFFF').box;
            if (b.x < -EPS || b.y < -EPS || b.x + b.w > 1 + EPS || b.y + b.h > 1 + EPS) bad++;
          }
        }
      }
    }
  }
  ok('① 클램프 — 범위 밖 pos도 보드 안', bad === 0, `이탈 ${bad}`);
}

// ── ③ parts='none' ────────────────────────────────────────────────
{
  let bad = 0;
  for (const [, aspect] of Object.entries(ASPECTS)) {
    for (const style of TITLE_STYLES) {
      const L = titleLayoutFor(cfg({ style, parts: 'none' }), aspect, '#FFFFFF');
      if (L.visible || L.lines.length !== 0 || L.card.alpha !== 0) bad++;
    }
  }
  ok('③ 숨기기 — visible=false·lines=[]·카드 안 그림', bad === 0, `위반 ${bad}`);
}

// ── ④ 배율 단조성 ─────────────────────────────────────────────────
{
  let bad = 0;
  for (const [, aspect] of Object.entries(ASPECTS)) {
    for (const style of TITLE_STYLES) {
      for (const dir of TITLE_DIRS) {
        let prevW = -1;
        let prevSize = -1;
        for (const scale of SCALES) {
          const L = titleLayoutFor(cfg({ style, dir, scale }), aspect, '#FFFFFF');
          const size = L.lines[L.lines.length - 1].size;
          if (L.box.w < prevW - 1e-9 || size < prevSize - 1e-12) bad++;
          prevW = L.box.w;
          prevSize = size;
        }
      }
    }
  }
  ok('④ 배율 단조 — scale↑ ⇒ 카드·글자 비감소', bad === 0, `역전 ${bad}`);
}

// ── ⑤ parts 축소 ──────────────────────────────────────────────────
{
  let bad = 0;
  const detail = [];
  for (const [aName, aspect] of Object.entries(ASPECTS)) {
    for (const style of TITLE_STYLES) {
      const allV = titleLayoutFor(cfg({ style, dir: 'v', parts: 'all' }), aspect, '#FFFFFF').box;
      const yrV = titleLayoutFor(cfg({ style, dir: 'v', parts: 'year' }), aspect, '#FFFFFF').box;
      const lbV = titleLayoutFor(cfg({ style, dir: 'v', parts: 'label' }), aspect, '#FFFFFF').box;
      const allH = titleLayoutFor(cfg({ style, dir: 'h', parts: 'all' }), aspect, '#FFFFFF').box;
      const yrH = titleLayoutFor(cfg({ style, dir: 'h', parts: 'year' }), aspect, '#FFFFFF').box;
      if (!(yrV.h < allV.h - 1e-9 && lbV.h < allV.h - 1e-9)) {
        bad++;
        detail.push(`${aName}/${style} v`);
      }
      if (!(yrH.w < allH.w - 1e-9)) {
        bad++;
        detail.push(`${aName}/${style} h`);
      }
    }
  }
  ok('⑤ 표시 요소 축소 — 지운 축이 실제로 줄어든다', bad === 0, detail.slice(0, 4).join(', '));
}

// ── ⑧ 글자 크기 하한 ──────────────────────────────────────────────
// 가장 작은 프리셋 = Z플립 커버 720×748. 기본 배율에서 읽을 수 있어야 한다
{
  const minDim = 720;
  let worstLabel = Infinity;
  let worstYear = Infinity;
  for (const style of TITLE_STYLES) {
    for (const dir of TITLE_DIRS) {
      const L = titleLayoutFor(cfg({ style, dir }), 720 / 748, '#FFFFFF');
      for (const l of L.lines) {
        const px = l.size * minDim * 0.73; // ink 높이 기준
        if (l.kind === 'label') worstLabel = Math.min(worstLabel, px);
        else worstYear = Math.min(worstYear, px);
      }
    }
  }
  ok('⑧ 최소 프리셋 라벨 ≥ 11px', worstLabel >= 11, `${worstLabel.toFixed(1)}px`);
  ok('⑧ 최소 프리셋 연도 ≥ 18px', worstYear >= 18, `${worstYear.toFixed(1)}px`);
}

// ── ⑨ 앵커 순서 ───────────────────────────────────────────────────
{
  let bad = 0;
  for (const [, aspect] of Object.entries(ASPECTS)) {
    for (const style of TITLE_STYLES) {
      const cx = (a) => {
        const b = titleLayoutFor(cfg({ style, anchor: a }), aspect, '#FFFFFF').box;
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      };
      if (!(cx('ml').x < cx('mc').x && cx('mc').x < cx('mr').x)) bad++;
      if (!(cx('tc').y < cx('mc').y && cx('mc').y < cx('bc').y)) bad++;
    }
  }
  ok('⑨ 앵커 순서 엄격 단조 (l<c<r · t<m<b)', bad === 0, `위반 ${bad}`);
}

// ── ⑩ 대비 ────────────────────────────────────────────────────────
{
  let bad = 0;
  const worst = [];
  // ⚠️ 잉크는 titleInkFor가 아니라 **실제로 렌더되는 색**(titleLayoutFor의 lines[].color)으로 잰다.
  //    v11에서 반투명 카드의 라벨 잉크가 solid와 달라졌기 때문 — 상수를 직접 보면 그 분기를 놓친다
  for (const bgHex of BGS_HEX) {
    const themeKey = bgHex === '#1C1B19' ? 'dark' : 'light';
    for (const bg of TITLE_BGS) {
      if (bg === 'clear') continue;
      const alpha = TITLE_CARD_ALPHA[bg][themeKey];
      const L = titleLayoutFor(cfg({ bg, ink: 'auto' }), 16 / 9, bgHex);
      for (const behind of ['#000000', '#FFFFFF']) {
        for (const l of L.lines) {
          const c = compositeContrast(TITLE_CARD_HEX[themeKey], alpha, behind, l.color);
          worst.push({ bg, themeKey, behind, kind: l.kind, c });
          if (c < 3.0) bad++;
        }
      }
    }
  }
  worst.sort((a, b) => a.c - b.c);
  ok(
    '⑩ 카드 위 글자 대비 ≥ 3.0 (최악 사진 양쪽)',
    bad === 0,
    `최악 ${worst[0].c.toFixed(2)} (${worst[0].bg}/${worst[0].themeKey}/${worst[0].kind}/뒤=${worst[0].behind})`,
  );

  let noShadow = 0;
  for (const bgHex of BGS_HEX) {
    for (const style of TITLE_STYLES) {
      const L = titleLayoutFor(cfg({ style, bg: 'clear' }), 16 / 9, bgHex);
      if (!L.shadow || L.card.alpha !== 0 || L.border.alpha !== 0) noShadow++;
    }
  }
  ok('⑩ 투명 배경 — 카드/테두리 없음 + 글자 그림자 필수', noShadow === 0, `위반 ${noShadow}`);
}

// ── ⑪ v10 타이포 스냅샷 ───────────────────────────────────────────
// 스타일의 **타이포 정체성**(세 스타일의 상대 크기·자간)은 v10과 같아야 한다.
// 전체 크기는 TITLE_BASE_SCALE × titleUnit(aspect)만큼 일률적으로 올라간다(v11 모바일 개선) —
// 즉 v10 비율에 그 배수를 곱한 값과 정확히 일치해야 한다. 박스는 내용 기반으로 다시 계산된다.
{
  const V10_TYPE = {
    band: { label: 0.031, year: 0.072, tracking: 0.42 },
    bold: { label: 0.022, year: 0.088, tracking: 0.2 },
    line: { label: 0.026, year: 0.038, tracking: 0.34 },
  };
  const V10_BOX = { band: { w: 0.66, h: 0.2 }, bold: { w: 0.46, h: 0.19 }, line: { w: 0.78, h: 0.078 } };
  let bad = 0;
  let ratioBad = 0;
  const shrink = [];
  for (const [aName, aspect] of Object.entries(ASPECTS)) {
    const uplift = TITLE_BASE_SCALE * titleUnit(aspect);
    for (const style of TITLE_STYLES) {
      const t = V10_TYPE[style];
      const L = titleLayoutFor(cfg({ style, dir: style === 'line' ? 'h' : 'v' }), aspect, '#FFFFFF');
      const lb = L.lines.find((l) => l.kind === 'label');
      const yr = L.lines.find((l) => l.kind === 'year');
      // 상한에 걸려 배율이 깎인 조합은 제외 — 그건 의도된 클램프다
      if (L.effScale < uplift - 1e-9) continue;
      if (Math.abs(lb.size - t.label * uplift) > 1e-9) bad++;
      if (Math.abs(yr.size - t.year * uplift) > 1e-9) bad++;
      if (Math.abs(lb.tracking - t.tracking) > 1e-9) bad++;
      if (Math.abs(yr.tracking) > 1e-9) bad++; // 연도는 자간 0 (v10 canvas setTrack(0) 계약)
      // 세 스타일의 상대 크기 = 타이포 정체성. 어떤 비율에서도 보존돼야 한다
      if (Math.abs(yr.size / lb.size - t.year / t.label) > 1e-9) ratioBad++;
    }
    void aName;
  }
  ok('⑪ 글자 크기 = v10 비율 × (기본 배율 × titleUnit)', bad === 0, `불일치 ${bad}`);
  ok('⑪ 스타일별 라벨:연도 비가 v10과 동일', ratioBad === 0, `불일치 ${ratioBad}`);

  for (const style of TITLE_STYLES) {
    const L = titleLayoutFor(cfg({ style, dir: style === 'line' ? 'h' : 'v' }), 16 / 9, '#FFFFFF');
    const v = V10_BOX[style];
    const nx = minDimNormX(16 / 9);
    shrink.push(
      `${style} 면적 ${((L.box.w * L.box.h) / (Math.min(0.92, v.w * nx) * v.h)).toFixed(2)}×`,
    );
  }
  ok('⑪ FHD 카드 면적 vs v10 (참고)', true, shrink.join(' | '));
}

// 기본 앵커·기본 배율에서 카드 면적 ≤ 보드의 14% (오너 지적 "사진을 통째로 덮는다"의 정량화)
{
  let worst = 0;
  let worstAt = '';
  for (const [aName, aspect] of Object.entries(ASPECTS)) {
    for (const [tpl, d] of Object.entries(TEMPLATE_TITLE_DEFAULT)) {
      const L = titleLayoutFor(
        cfg({ style: d.style, anchor: d.anchor, dir: d.style === 'line' ? 'h' : 'v', bg: TITLE_DEFAULT_BG }),
        aspect,
        '#FFFFFF',
      );
      const area = L.box.w * L.box.h;
      if (area > worst) {
        worst = area;
        worstAt = `${aName}/${tpl}`;
      }
    }
  }
  ok('⑪ 기본 상태 카드 면적 ≤ 보드 14%', worst <= 0.14, `최대 ${(worst * 100).toFixed(1)}% (${worstAt})`);
}

// ── ⑫ aspect 교차 ─────────────────────────────────────────────────
{
  let bad = 0;
  const A = Object.values(ASPECTS);
  for (const a1 of A) {
    for (const a2 of A) {
      for (const style of TITLE_STYLES) {
        const src = titleLayoutFor(cfg({ style }), a1, '#FFFFFF').box;
        const b = titleLayoutFor(cfg({ style, pos: { x: src.x, y: src.y } }), a2, '#FFFFFF').box;
        if (b.x < -EPS || b.y < -EPS || b.x + b.w > 1 + EPS || b.y + b.h > 1 + EPS) bad++;
      }
    }
  }
  ok('⑫ aspect 교차 — 기기 프리셋을 바꿔도 보드 안', bad === 0, `이탈 ${bad}`);
}

// ── ⑬ 순수성 · resolveTitleConfig ─────────────────────────────────
{
  const a = titleLayoutFor(cfg({ style: 'bold', anchor: 'br', scale: 1.3 }), 16 / 9, '#F4F1EC');
  const b = titleLayoutFor(cfg({ style: 'bold', anchor: 'br', scale: 1.3 }), 16 / 9, '#F4F1EC');
  ok('⑬ 순수 — 같은 입력 → 같은 출력', JSON.stringify(a) === JSON.stringify(b));

  // 손상된 저장값이 렌더를 깨뜨리지 않는다
  const junk = resolveTitleConfig(
    { anchor: 'ZZ', pos: { x: NaN, y: 3 } },
    { style: 'nope', dir: 'x', parts: 'q', bg: 'glass', ink: 'neon', scale: 99 },
    'magazine',
  );
  ok(
    '⑬ 화이트리스트 — 손상 값이 템플릿 기본으로 접힌다',
    junk.anchor === 'tl' && junk.style === 'bold' && junk.dir === 'v' && junk.parts === 'all' &&
      junk.bg === TITLE_DEFAULT_BG && junk.ink === 'auto' && junk.scale === TITLE_SCALE_MAX && !junk.pos,
    JSON.stringify(junk),
  );

  // 미설정 = 템플릿 기본 (세 템플릿이 계속 서로 달라야 한다 — V10-3a 계약의 근거)
  const styles = new Set(
    ['editorial', 'magazine', 'studio'].map((t) => resolveTitleConfig(undefined, undefined, t).style),
  );
  const anchors = new Set(
    ['editorial', 'magazine', 'studio'].map((t) => resolveTitleConfig(undefined, undefined, t).anchor),
  );
  ok('⑬ 미설정 → 템플릿별 스타일·앵커가 서로 다르다', styles.size === 3 && anchors.size === 3);

  // 전역이 설정되면 템플릿과 무관하게 따라온다
  const g = { style: 'line', scale: 1.2 };
  const same = new Set(
    ['editorial', 'magazine', 'studio'].map((t) => resolveTitleConfig(undefined, g, t).style),
  );
  ok('⑬ 전역 설정은 세 템플릿에 공통 적용', same.size === 1 && [...same][0] === 'line');

  ok('⑬ titleUnit 하한 1', Object.values(ASPECTS).every((a2) => titleUnit(a2) >= 1 - 1e-12));

  const na = nearestAnchor({ x: 0.02, y: 0.9, w: 0.2, h: 0.05 });
  ok('⑬ nearestAnchor — 좌하단', na === 'bl', na);
}

// ── ⑭ 조판 리듬 드리프트 ──────────────────────────────────────────
// 간격은 타이포 선택이지만, 무한정 벌어지면 "카드"가 아니게 된다.
{
  let bad = 0;
  for (const style of TITLE_STYLES) {
    const L = titleLayoutFor(cfg({ style, dir: 'v' }), 1, '#FFFFFF');
    const lb = L.lines.find((l) => l.kind === 'label');
    const yr = L.lines.find((l) => l.kind === 'year');
    const gap = yr.cy - lb.cy - (lb.size * 0.73) / 2 - (yr.size * 0.73) / 2;
    const r = gap / lb.size;
    if (!(r >= 0.5 && r <= 2.0)) bad++;
  }
  ok('⑭ 라벨↔연도 간격이 labelSize의 0.5~2.0배', bad === 0, `이탈 ${bad}`);
}

const fails = results.filter((r) => r.startsWith('FAIL'));
results.filter((r) => r.includes('참고')).forEach((r) => console.log(r));
fails.forEach((r) => console.log(r));
console.log(`${results.length - fails.length} PASS / ${fails.length} FAIL (총 ${results.length})`);
process.exit(fails.length ? 1 : 0);
