// 콜라주 기하 계약 검증 (v9.0 그리드 재설계) — npx tsx scripts/verify-collage-layout.js
//
// 계약:
//  1) 사진끼리 겹치지 않는다 (그리드는 원천 무겹침 — 임계 0.1%)
//  2) 모든 사진이 보드 경계 안
//  3) 타일링 정리: 모든 밴드가 cols를 정확히 채운다(매트의 마지막 짧은 행만 예외) → 빈틈 0
//  4) 가드레일: 사진 박스가 photoBounds를 넘지 않는다 → "왁! 큰 느낌" 회귀 방지
//  5) 여백:갭 ≥ 2 — 갤러리 조판의 숨 쉬는 여백
//  6) 자동정렬 불사: 어떤 리사이즈를 해도 그리드가 죽지 않는다 (v8.x의 null 사망 지점 회귀 테스트)
//  7) 스왑은 자리만 바꾼다 — 키 집합·타일링 불변
//  8) 매트 갤러리는 완전 균일(면적 동일·전 스팬 1×1), 모자이크는 크기 위계가 있다
//  9) reconcile: edited:false는 리시드, 그리드 모드는 상대 순서 보존 + 타일링 유지
// 10) 배경색: 팔레트 × 자동 반전 글자색 대비 ≥ 4.5:1
import {
  ASPECT,
  DEFAULT_TEMPLATE,
  TEMPLATE_ORDER,
  chooseGrid,
  normalizeBgColor,
  normalizeTemplate,
  resolveLayout,
  seedLayout,
  stickerKey,
  themeFor,
} from '../lib/collageTemplates';
import {
  assertTiling,
  gridKeys,
  gridMetrics,
  layoutCells,
  resizeInGrid,
  swapInGrid,
} from '../lib/collageGrid';
import {
  BG_PALETTE,
  GUARDRAIL_MIN_ITEMS,
  SPAN_CAP,
  boxRatioOk,
  contrastRatio,
  photoBounds,
  spacingFor,
} from '../lib/collageTokens';

const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

const mkItems = (n) => Array.from({ length: n }, (_, i) => ({ key: `${(i % 6) + 1}-${Math.floor(i / 6)}`, src: 'x' }));
const rectOf = (it, aspect) => ({ x: it.x, y: it.y, w: it.w, h: it.h ?? it.w * aspect });
const overlap = (a, b) => {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
};
const ratio = (a, b) => overlap(a, b) / Math.min(a.w * a.h, b.w * b.h);

const ASPECTS = { phone: 9 / 19.5, desktop: 16 / 9, board: ASPECT };
const COUNTS = Array.from({ length: 18 }, (_, i) => i + 1);
const TEMPLATES = TEMPLATE_ORDER;
const photoEntries = (layout) => Object.entries(layout.items).filter(([k]) => !k.startsWith('sticker:'));

// ── 1~5) 시드 기하: 무겹침·경계·타일링·가드레일 ──
for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (const template of TEMPLATES) {
    const sp = spacingFor(template, aspect);
    ok(
      `${template}/${aName} 여백:갭 ≥ 2`,
      sp.marginX / sp.gutterX >= 2 - 1e-9 && sp.marginY / sp.gutterY >= 2 - 1e-9,
      `${(sp.marginX / sp.gutterX).toFixed(2)}:1`
    );

    for (const n of COUNTS) {
      const items = mkItems(n);
      const layout = seedLayout(template, items, aspect);
      const rects = photoEntries(layout).map(([, it]) => rectOf(it, aspect));

      let maxOv = 0;
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) maxOv = Math.max(maxOv, ratio(rects[i], rects[j]));
      ok(`${template}/${aName}/n=${n} 무겹침`, maxOv <= 0.001, `최대 ${(maxOv * 100).toFixed(2)}%`);

      const outside = rects.filter((r) => r.x < -1e-6 || r.y < -1e-6 || r.x + r.w > 1 + 1e-6 || r.y + r.h > 1 + 1e-6);
      ok(`${template}/${aName}/n=${n} 경계 내부`, outside.length === 0, `${outside.length}개 이탈`);

      const grid = layout.grid;
      ok(`${template}/${aName}/n=${n} 그리드 존재`, !!grid);
      if (!grid) continue;

      ok(`${template}/${aName}/n=${n} 타일링 정리`, assertTiling(grid));

      // 빈틈 0 — center 밴드(매트 마지막 짧은 행)가 없으면 셀이 cols×행을 정확히 덮는다
      const { cells, totalRows } = layoutCells(grid);
      const hasCenter = grid.bands.some((b) => b.kind === 'row' && b.center);
      const covered = cells.reduce((s, c) => s + c.sc * c.sr, 0);
      if (!hasCenter) {
        ok(
          `${template}/${aName}/n=${n} 빈틈 0`,
          covered === grid.cols * totalRows,
          `${covered}/${grid.cols * totalRows}`
        );
      }
      ok(`${template}/${aName}/n=${n} 전 사진 배치`, cells.length === n, `${cells.length}/${n}`);

      // 가드레일 — k-축소 이후 최종 박스 기준 (v8.7의 720px 히어로 같은 병리 회귀 방지)
      if (n >= GUARDRAIL_MIN_ITEMS) {
        const b = photoBounds(aspect);
        const m = gridMetrics(grid, template, aspect);
        let bad = null;
        for (const c of cells) {
          const w = c.sc * m.unitW + (c.sc - 1) * sp.gutterX;
          const h = c.sr * m.unitH + (c.sr - 1) * sp.gutterY;
          if (h > b.maxH + 1e-9) bad = `높이 ${(h * 100).toFixed(1)}% > ${(b.maxH * 100).toFixed(0)}%`;
          else if (h < b.minH - 1e-9) bad = `높이 ${(h * 100).toFixed(1)}% < ${(b.minH * 100).toFixed(0)}%`;
          else if (!boxRatioOk(w, h, aspect, b)) bad = `박스비 이탈`;
          if (bad) break;
        }
        ok(`${template}/${aName}/n=${n} 가드레일`, bad === null, bad ?? '');
        ok(`${template}/${aName}/n=${n} 스팬 캡`, cells.every((c) => c.sc <= SPAN_CAP && c.sr <= SPAN_CAP));
      }

      // 가로·세로 센터링 — 남은 여백이 위아래(좌우) 균등
      if (n >= GUARDRAIL_MIN_ITEMS) {
        const m = gridMetrics(grid, template, aspect);
        const leftGap = m.left - sp.marginX;
        const rightGap = sp.availWidth + sp.marginX - (m.left + m.contentW);
        ok(`${template}/${aName}/n=${n} 가로 센터링`, Math.abs(leftGap - rightGap) < 0.01, `${leftGap.toFixed(3)}/${rightGap.toFixed(3)}`);
        const topGap = m.top - sp.titleBottom;
        const botGap = sp.availBottom - (m.top + m.contentH);
        ok(`${template}/${aName}/n=${n} 세로 센터링`, Math.abs(topGap - botGap) < 0.01, `${topGap.toFixed(3)}/${botGap.toFixed(3)}`);
      }
    }
  }
}

// ── 6) 자동정렬 불사 — 어떤 리사이즈를 해도 그리드가 죽지 않는다 ──
// v8.x는 inferGridSpans가 null이면 리플로우가 통째로 죽어 "자동 정렬이 영영 안 됨"이 됐다.
for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (const template of TEMPLATES) {
    for (const n of [2, 5, 9, 13, 18]) {
      const items = mkItems(n);
      const grid = seedLayout(template, items, aspect).grid;
      if (!grid) continue;
      const keys = gridKeys(grid);
      let allOk = true;
      let firstBad = '';
      for (const span of [[1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [4, 2]]) {
        for (const key of [keys[0], keys[Math.floor(keys.length / 2)], keys[keys.length - 1]]) {
          const next = resizeInGrid(grid, key, span);
          if (!next || !assertTiling(next)) {
            allOk = false;
            firstBad = `${key} → ${span.join('×')}`;
            break;
          }
          // 키 집합 불변 — 리사이즈로 사진이 사라지면 안 된다
          const before = [...keys].sort();
          const after = [...gridKeys(next)].sort();
          if (before.join('|') !== after.join('|')) {
            allOk = false;
            firstBad = `${key} 키 집합 변화`;
            break;
          }
        }
        if (!allOk) break;
      }
      ok(`${template}/${aName}/n=${n} 자동정렬 불사`, allOk, firstBad);
    }
  }
}

// ── 7) 스왑 — 자리만 바꾼다 ──
for (const template of TEMPLATES) {
  for (const n of [3, 9, 18]) {
    const aspect = ASPECTS.desktop;
    const grid = seedLayout(template, mkItems(n), aspect).grid;
    if (!grid) continue;
    const keys = gridKeys(grid);
    const a = keys[0];
    const b = keys[keys.length - 1];
    const swapped = swapInGrid(grid, a, b);
    const before = layoutCells(grid).cells;
    const after = layoutCells(swapped).cells;
    ok(`${template}/n=${n} 스왑 타일링 유지`, assertTiling(swapped));
    ok(
      `${template}/n=${n} 스왑 키 집합 불변`,
      [...gridKeys(swapped)].sort().join('|') === [...keys].sort().join('|')
    );
    const posOfA = before.findIndex((c) => c.key === a);
    const posOfB = before.findIndex((c) => c.key === b);
    ok(
      `${template}/n=${n} 스왑은 자리 교환`,
      after[posOfA]?.key === b && after[posOfB]?.key === a
    );
  }
}

// ── 8) 템플릿 성격 차이 ──
for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (const n of [6, 12, 18]) {
    const sp = spacingFor('matte', aspect);
    const grid = seedLayout('matte', mkItems(n), aspect).grid;
    if (grid) {
      const { cells } = layoutCells(grid);
      ok(`matte/${aName}/n=${n} 전 스팬 1×1`, cells.every((c) => c.sc === 1 && c.sr === 1));
      const m = gridMetrics(grid, 'matte', aspect);
      const areas = cells.map((c) => (c.sc * m.unitW + (c.sc - 1) * sp.gutterX) * (c.sr * m.unitH + (c.sr - 1) * sp.gutterY));
      const spread = Math.max(...areas) / Math.min(...areas);
      ok(`matte/${aName}/n=${n} 면적 균일`, spread <= 1.01, `${spread.toFixed(3)}×`);
    }
  }
}
// 모자이크는 여백이 가장 좁고(밀도), 매트가 가장 넓다 — 세 템플릿의 성격 차이를 수치로 고정
for (const aspect of Object.values(ASPECTS)) {
  const g = (t) => spacingFor(t, aspect);
  ok(
    '템플릿 밀도 위계 (모자이크 < 미니멀 < 매트)',
    g('mosaic').gutterX < g('minimal').gutterX && g('minimal').gutterX < g('matte').gutterX
  );
}
// 모자이크는 적어도 한 조합에서 2×2 히어로를 쓴다 — 매거진 리듬이 살아있는지의 최소 보증
{
  const heroSeen = Object.values(ASPECTS).some((aspect) =>
    [6, 9, 12, 15].some((n) => seedLayout('mosaic', mkItems(n), aspect).grid?.bands.some((b) => b.kind === 'hero'))
  );
  ok('모자이크 히어로 밴드 존재', heroSeen);
  const minimalHero = Object.values(ASPECTS).some((aspect) =>
    COUNTS.some((n) => seedLayout('minimal', mkItems(n), aspect).grid?.bands.some((b) => b.kind === 'hero'))
  );
  ok('미니멀은 히어로를 쓰지 않는다', !minimalHero);
}

// ── 9) reconcile ──
for (const template of TEMPLATES) {
  const aspect = ASPECTS.board;

  // edited:false → 사진이 늘면 신선한 시드
  {
    const seeded = seedLayout(template, mkItems(6), aspect);
    const grown = resolveLayout(template, mkItems(9), seeded, aspect);
    ok(`${template} edited:false 리시드`, Object.keys(grown.items).length === 9 && grown.grid !== undefined);
    const fresh = seedLayout(template, mkItems(9), aspect);
    const same = Object.keys(fresh.items).every(
      (k) => Math.abs(fresh.items[k].x - grown.items[k].x) < 1e-9 && Math.abs(fresh.items[k].y - grown.items[k].y) < 1e-9
    );
    ok(`${template} edited:false는 시드와 동일`, same);
  }

  // 그리드 모드에서 사진 추가/삭제 — 상대 순서 보존 + 타일링 유지
  // ⚠️ v9.0 계약 변경: 기존 사진 "좌표"는 움직인다. 보존되는 것은 읽기 순서다
  {
    const base = { ...seedLayout(template, mkItems(9), aspect), edited: true };
    const orderBefore = gridKeys(base.grid).filter((k) => !k.startsWith('sticker:'));

    const added = resolveLayout(template, mkItems(12), base, aspect);
    ok(`${template} 추가 후 타일링`, !!added.grid && assertTiling(added.grid));
    const orderAfter = gridKeys(added.grid).filter((k) => !k.startsWith('sticker:'));
    const keptOrder = orderBefore.filter((k) => orderAfter.includes(k));
    const projected = orderAfter.filter((k) => orderBefore.includes(k));
    ok(`${template} 추가 후 상대 순서 보존`, keptOrder.join('|') === projected.join('|'));
    ok(`${template} 추가 후 전 사진 존재`, Object.keys(added.items).filter((k) => !k.startsWith('sticker:')).length === 12);

    const removed = resolveLayout(template, mkItems(5), base, aspect);
    ok(`${template} 삭제 후 타일링`, !!removed.grid && assertTiling(removed.grid));
    ok(`${template} 삭제 후 사진 수`, Object.keys(removed.items).filter((k) => !k.startsWith('sticker:')).length === 5);
  }

  // 고아 스티커 복원 — 위치 정보가 유실돼도 사라지지 않고 빈 자리에 놓인다
  {
    const base = { ...seedLayout(template, mkItems(6), aspect), edited: true };
    base.stickers = { s1: { id: 's1', text: '잘 될 거야', style: 'chip' } };
    const out = resolveLayout(template, mkItems(6), base, aspect);
    ok(`${template} 고아 스티커 복원`, !!out.items[stickerKey('s1')]);
  }

  // 비율이 바뀌면 리시드
  {
    const base = { ...seedLayout(template, mkItems(9), ASPECTS.phone), edited: true };
    const out = resolveLayout(template, mkItems(9), base, ASPECTS.desktop);
    ok(`${template} 비율 변경 리시드`, out.aspect === ASPECTS.desktop && !!out.grid);
  }

  // 자유 배치는 좌표를 보존한다 (v8.x 동작 유지)
  {
    const base = { ...seedLayout(template, mkItems(6), aspect), edited: true, freeform: true };
    const keep = base.items['1-0'];
    const out = resolveLayout(template, mkItems(6), base, aspect);
    ok(
      `${template} 자유 배치 좌표 보존`,
      Math.abs(out.items['1-0'].x - keep.x) < 1e-9 && Math.abs(out.items['1-0'].y - keep.y) < 1e-9
    );
  }
}

// ── 10) 배경색 ──
for (const template of TEMPLATES) {
  for (const s of BG_PALETTE) {
    const theme = themeFor(template, s.hex);
    ok(
      `배경 ${s.label}/${template} 연도 대비 ≥ 4.5`,
      contrastRatio(theme.bg, theme.titleInk) >= 4.5,
      contrastRatio(theme.bg, theme.titleInk).toFixed(1)
    );
    ok(
      `배경 ${s.label}/${template} 라벨 대비 ≥ 3`,
      contrastRatio(theme.bg, theme.labelInk) >= 3,
      contrastRatio(theme.bg, theme.labelInk).toFixed(1)
    );
  }
  ok(`${template} 배경색 미설정 폴백`, normalizeBgColor(undefined, template) === (template === 'mosaic' ? '#FAF9F7' : '#FFFFFF'));
  ok(`${template} 손상 배경색 폴백`, normalizeBgColor('#NOPE!!', template) === (template === 'mosaic' ? '#FAF9F7' : '#FFFFFF'));
}

// ── 11) 레거시 템플릿 정규화 (숲 삭제) ──
ok("normalizeTemplate('polaroid') → 기본값", normalizeTemplate('polaroid') === DEFAULT_TEMPLATE);
ok("normalizeTemplate('custom') → 기본값", normalizeTemplate('custom') === DEFAULT_TEMPLATE);
ok("normalizeTemplate('matte') 유지", normalizeTemplate('matte') === 'matte');
ok('TEMPLATE_ORDER에 polaroid 없음', !TEMPLATE_ORDER.includes('polaroid'));
ok('chooseGrid(0장) → null', chooseGrid('mosaic', [], ASPECT) === null);

const pass = results.filter((r) => r.startsWith('PASS')).length;
const fail = results.filter((r) => r.startsWith('FAIL'));
for (const f of fail) console.log(f);
console.log(`\n${pass} PASS / ${fail.length} FAIL (총 ${results.length})`);
process.exit(fail.length ? 1 : 0);
