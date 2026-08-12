// 템플릿 정책 층 (v10) — "어떤 배치를 고를까"를 정한다.
//
// 층 구조:  collageJustify(순수 기하·아무것도 import 안 함)
//        →  collageSolve(정책 — 여기)
//        →  collageTemplates(보드 데이터·스티커·reconcile)
//        →  CollageBoard(DOM) · wallpaper(canvas)
//
// ⚠️ 이 모듈도 ./types를 import하지 않는다 — 검증 스크립트가 tsx로 단독 컴파일한다.

import {
  JustifiedSpec,
  JustifyOpts,
  NRect,
  clampRatio,
  layoutAmbient,
  layoutRows,
  orderByOrientation,
  solveAmbient,
  solveRows,
} from './collageJustify';
import {
  CROP_MAX,
  CROP_TOL,
  CROP_VS_AMBIENT_BIAS,
  CollageTemplateId,
  HERO_MAX_H,
  HERO_MIN_W,
  heroMaxWFor,
  HERO_TOP_MIN_R,
  LANDSCAPE_R,
  PORTRAIT_R,
  justifyOptsFor,
  regionFor,
} from './collageTokens';

export interface SolveItem {
  key: string;
  /** 실측 가로세로비. 아직 못 쟀으면 undefined → 1로 간주해 결정성을 지킨다 */
  ratio?: number;
}

export interface SolveResult {
  spec: JustifiedSpec;
  /** 키 → 정규화 사각형 */
  rects: Record<string, NRect>;
  /** 어느 폴백 단계에서 나온 결과인가. 3 이상이면 앰비언트(크롭 0, 사진 면적 < 100%) */
  tier: 1 | 2 | 3 | 4;
  /** 전 사진 공통 대칭 중앙 크롭 배율 − 1. 앰비언트면 0 */
  crop: number;
}

/** 히어로 사각형과 나머지 영역. 히어로를 못 쓰면 null */
function heroSplit(
  ratio: number,
  region: NRect,
  opts: JustifyOpts,
  maxW: number,
): { side: 'top' | 'left'; rect: NRect; rest: NRect } | null {
  const A = opts.aspect;
  if (ratio >= HERO_TOP_MIN_R) {
    // 가로 히어로 — 상단 풀블리드 밴드. s = 1이므로 히어로 크롭은 정확히 0
    const h = (region.w * A) / ratio;
    const rest = region.h - h - opts.gy;
    if (h <= HERO_MAX_H && rest > 0.12) {
      return {
        side: 'top',
        rect: { x: region.x, y: region.y, w: region.w, h },
        rest: { x: region.x, y: region.y + h + opts.gy, w: region.w, h: rest },
      };
    }
    return null;
  }
  // ⚠️ `ratio < 1`로 두면 안 된다 — 정확히 1.0(정사각, 그리고 **치수 미측정 기본값**)이
  //    두 분기 사이로 빠져 히어로가 아예 안 생기고, 매거진이 에디토리얼과 같은 그림이 된다.
  //    v9의 "모자이크와 미니멀이 똑같다"가 그대로 재발하는 지점이다(스크린샷에서 발견).
  if (ratio < HERO_TOP_MIN_R) {
    // 세로·정사각 히어로 — 좌측 풀하이트 컬럼. 세로 사진이면 세로 히어로가 자동으로 나온다
    const w = (region.h * ratio) / A;
    const rest = region.w - w - opts.gx;
    if (w >= HERO_MIN_W && w <= maxW && rest > 0.12) {
      return {
        side: 'left',
        rect: { x: region.x, y: region.y, w, h: region.h },
        rest: { x: region.x + w + opts.gx, y: region.y, w: rest, h: region.h },
      };
    }
  }
  return null;
}

/**
 * 배치를 푼다. **절대 실패하지 않는다** — 4단 폴백 사다리의 마지막이 안전망이다.
 *
 * v9의 chooseGrid는 후보가 전멸하면 null을 돌려줬고, 그러면 배치가 통째로 비었다.
 * 그 구조가 v8.x "자동 정렬이 영영 안 됨" 병리의 뿌리였다.
 */
export function solveTemplate(
  template: CollageTemplateId,
  items: SolveItem[],
  aspect: number,
): SolveResult {
  const n = items.length;
  const ratioMap: Record<string, number> = {};
  for (const it of items) ratioMap[it.key] = clampRatio(it.ratio ?? 1);

  const reading = items.map((i) => i.key);
  const grouped =
    template === 'studio'
      ? orderByOrientation(reading, ratioMap, aspect, PORTRAIT_R, LANDSCAPE_R)
      : reading;

  const region = regionFor(template, aspect);
  const empty: SolveResult = {
    spec: { v: 2, order: [], rows: [] },
    rects: {},
    tier: 1,
    crop: 0,
  };
  if (n === 0) return empty;

  const regionArea = region.w * region.h;
  const fillOf = (rects: Record<string, NRect>) =>
    Object.values(rects).reduce((a, r) => a + r.w * r.h, 0) / regionArea;

  /**
   * 히어로(= 한 장을 위/옆에 통째로 예약)를 쓴 후보.
   *
   * 매거진의 정체성이지만 **세 템플릿 모두에게 연다**. 이유는 미학이 아니라 기하다:
   * 평평한 행 스택만으로는 달성 가능한 "자연 높이 합"이 띄엄띄엄하고, 그 사이에 보드 높이가
   * 끼면 크롭을 크게 물거나 앰비언트로 떨어진다(16:9 · 12장에서 2행 0.57 ↔ 3행 1.28 사이가
   * 통째로 비어 채움률 0.75까지 내려갔다 — tune 실측). 영역을 둘로 쪼개면 그 공백이 메워진다.
   * 매거진만 히어로에 가점을 줘 "항상 주인공이 있는" 성격을 유지한다.
   */
  const withHero = (order: string[], opts: JustifyOpts): SolveResult | null => {
    if (n < 4) return null;
    const split = heroSplit(ratioMap[order[0]], region, opts, heroMaxWFor(template));
    if (!split) return null;
    const restKeys = order.slice(1);
    const restRatios = restKeys.map((k) => ratioMap[k]);
    const sol = solveRows(restRatios, split.rest, opts);
    if (!sol) return null;
    const rects: Record<string, NRect> = { [order[0]]: split.rect };
    layoutRows(restRatios, sol.rows, split.rest, opts).forEach((r, i) => {
      rects[restKeys[i]] = r;
    });
    return {
      spec: { v: 2, order, rows: sol.rows, hero: { key: order[0], side: split.side } },
      rects,
      tier: sol.d - 1 <= CROP_TOL ? 1 : 2,
      crop: sol.d - 1,
    };
  };

  const flat = (order: string[], opts: JustifyOpts): SolveResult | null => {
    const ratios = order.map((k) => ratioMap[k]);
    const sol = solveRows(ratios, region, opts);
    if (!sol) return null;
    const rects: Record<string, NRect> = {};
    layoutRows(ratios, sol.rows, region, opts).forEach((r, i) => {
      rects[order[i]] = r;
    });
    return {
      spec: { v: 2, order, rows: sol.rows },
      rects,
      tier: sol.d - 1 <= CROP_TOL ? 1 : 2,
      crop: sol.d - 1,
    };
  };

  const ambientOf = (order: string[], opts: JustifyOpts): SolveResult | null => {
    const ratios = order.map((k) => ratioMap[k]);
    const rows = solveAmbient(ratios, region, opts);
    if (rows.reduce((a, b) => a + b, 0) !== n || rows.some((k) => k < 1)) return null;
    const rects: Record<string, NRect> = {};
    layoutAmbient(ratios, rows, region, opts).forEach((r, i) => {
      rects[order[i]] = r;
    });
    return { spec: { v: 2, order, rows, ambient: order[0] }, rects, tier: 3, crop: 0 };
  };

  /** 보이는 사진 내용량 — 모든 후보를 같은 저울에 올린다.
   *  크롭 c로 100% 채우면 각 사진의 (1 − c)가 보이고, 앰비언트는 보드의 f가 사진이다. */
  const value = (r: SolveResult) => (1 - r.crop) * fillOf(r.rects);

  const opts = justifyOptsFor(template, aspect, n, CROP_MAX);

  // 후보를 전부 만들어 한 저울에 올린다. 가점(bias)이 각 템플릿의 **성격**이고,
  // 저울이 **품질**이다 — 성격 때문에 품질을 크게 잃으면 성격이 물러난다.
  const cands: { r: SolveResult; bias: number }[] = [];
  const push = (r: SolveResult | null, bias: number) => {
    if (r) cands.push({ r, bias });
  };

  // 사실상 안 자르면서 꽉 채운 배치에는 가점 — 같은 '내용량'이면 여백 없는 쪽이 배경화면답다.
  // 이게 없으면 크롭 2%짜리 완벽한 배치가 채움률 0.93 앰비언트에 밀린다
  const fullBleed = (r: SolveResult | null) => (r && r.crop <= CROP_TOL ? 0.04 : 0);
  // 히어로 가점은 템플릿의 **성격**이다.
  //   매거진 +  — 주인공이 있는 게 정체성이라 기하가 비슷하면 히어로를 택한다
  //   스튜디오 − — 히어로는 "방향별 정렬"과 정면으로 충돌한다. 그래도 여는 이유는 미학이
  //                아니라 기하(행 스택만으로 못 메우는 구간)이므로, **큰 이득일 때만** 이기게 한다.
  //                가점을 0으로 두면 스튜디오가 매거진과 똑같이 거대한 좌측 히어로를 골라
  //                "두 템플릿이 비슷하다"가 그대로 재발한다(스크린샷에서 발견)
  //   에디토리얼 − — 조밀한 균질함이 정체성이라 약하게만 억제한다
  const heroBias = template === 'magazine' ? 0.06 : template === 'studio' ? -0.08 : -0.04;
  const gh = withHero(grouped, opts);
  const gf = flat(grouped, opts);
  push(gh, heroBias + fullBleed(gh));
  push(gf, fullBleed(gf));
  push(ambientOf(grouped, opts), CROP_VS_AMBIENT_BIAS);

  // 스튜디오의 방향 묶음은 **강제가 아니라 선호**다. 넓은 보드에서 세로 사진을 한 행에 모으면
  // 그 행이 보드 높이를 거의 다 먹어(16:9 · 세로 3장 = 0.91) 채움률이 무너진다(tune 실측 0.80).
  // 그럴 때는 읽기 순서로 물러나되, 가점을 줘 웬만하면 묶음이 이기게 한다.
  if (template === 'studio') {
    const rh = withHero(reading, opts);
    const rf = flat(reading, opts);
    push(rh, fullBleed(rh) - 0.05);
    push(rf, fullBleed(rf) - 0.05);
    push(ambientOf(reading, opts), CROP_VS_AMBIENT_BIAS - 0.05);
  }

  if (cands.length) {
    let best = cands[0];
    for (const c of cands) {
      if (value(c.r) + c.bias > value(best.r) + best.bias) best = c;
    }
    return best.r;
  }

  // 안전망 — 한 줄에 한 장씩. 이론상 도달하지 않지만 null을 돌려주지 않기 위한 바닥
  const ratios = grouped.map((k) => ratioMap[k]);
  const fallbackRows = grouped.map(() => 1);
  const fallbackRects: Record<string, NRect> = {};
  layoutAmbient(ratios, fallbackRows, region, opts).forEach((r, i) => {
    fallbackRects[grouped[i]] = r;
  });
  return {
    spec: { v: 2, order: grouped, rows: fallbackRows, ambient: grouped[0] },
    rects: fallbackRects,
    tier: 4,
    crop: 0,
  };
}

/**
 * 저장된 spec으로부터 기하를 재현한다. 편집(스왑·크게/작게) 이후의 유일한 렌더 경로.
 *
 * **어떤 유효한 spec이든 정확한 타일링을 만든다** — 그래서 편집이 기하를 깨뜨릴 수 없다.
 * s가 크게 밀리면 layoutRows가 클램프하고 세로 중앙 정렬한다(사진을 더 자르는 대신 여백).
 */
export function layoutSpec(
  spec: JustifiedSpec,
  template: CollageTemplateId,
  ratios: Record<string, number>,
  aspect: number,
): Record<string, NRect> {
  const n = spec.order.length;
  if (!n) return {};
  const opts = justifyOptsFor(template, aspect, n, CROP_MAX);
  const region = regionFor(template, aspect);
  const r = (k: string) => clampRatio(ratios[k] ?? 1);
  const out: Record<string, NRect> = {};

  let bodyRegion = region;
  let bodyKeys = spec.order;

  if (spec.hero) {
    const split = heroSplit(r(spec.hero.key), region, opts, heroMaxWFor(template));
    if (split) {
      out[spec.hero.key] = split.rect;
      bodyRegion = split.rest;
      bodyKeys = spec.order.slice(1);
    } else {
      // 스왑으로 히어로 자리에 온 사진이 히어로 기하에 안 맞는다 — 히어로 없이 평평하게.
      // spec.rows는 order.length−1개를 세고 있으므로 첫 장을 첫 행에 흡수시킨다
      const rows = spec.rows.slice();
      if (rows.length) rows[0] += 1;
      else rows.push(1);
      const rr = spec.order.map(r);
      layoutRows(rr, rows, region, opts).forEach((rect, i) => {
        out[spec.order[i]] = rect;
      });
      return out;
    }
  }

  const rr = bodyKeys.map(r);
  const rects = spec.ambient
    ? layoutAmbient(rr, spec.rows, bodyRegion, opts)
    : layoutRows(rr, spec.rows, bodyRegion, opts);
  rects.forEach((rect, i) => {
    out[bodyKeys[i]] = rect;
  });
  return out;
}
