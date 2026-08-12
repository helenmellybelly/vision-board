// 저스티파이드 배치 엔진 (v10) — 콜라주 기하의 진실 원천.
//
// ── 왜 갈아엎었나 ──
// v9까지 엔진은 개별 사진이 가로인지 세로인지 **전혀 몰랐다**. 모든 셀을 픽셀 정사각으로 가정하고
// object-cover로 잘라 넣었으니, 세로 사진은 정사각 셀에서 40~55%가 잘려 나갔다. 그 회피책으로
// 존재하던 게 매트 갤러리(흰 액자 + object-contain)였고, 대가는 "사진이 액자 안에서 작아 보임"이었다.
// 이제 사진의 실측 비율(lib/imageDims.ts)이 엔진까지 흐른다.
//
// ── 원리 ──
// 같은 행의 사진은 높이를 공유하고 폭은 각자의 원본 비율에 비례한다. 행의 폭 합이 가용폭과
// 정확히 같아지므로 빈틈이 0이다. 세로 사진은 저절로 좁고 길게, 가로 사진은 넓고 낮게 들어간다.
//
// ── 피할 수 없는 사실 ──
// 고정 크기 캔버스에서 "원본 비율 100% 보존"과 "채움률 100%"는 동시에 성립하지 않는다.
// 행이 폭을 정확히 채우는 순간 그 행의 높이가 결정돼 자유도가 사라지고, 높이들의 합이 보드 높이와
// 같아질 이유가 없다. 잔차는 셋 중 하나로 흡수할 수밖에 없다:
//   (a) 여백 — 사진이 작아진다(오너가 매트 갤러리에서 거부한 것)
//   (b) 균일 스케일 s — 전 사진이 **같은 비율로** 왜곡되고 그만큼 대칭 중앙 크롭이 생긴다
//   (c) 앰비언트 블러 배경 — 크롭 0, 대신 사진 면적이 100% 미만
// 여기서는 (b)를 CROP_TOL(기본 6%)까지만 쓰고, 그걸로 안 되면 (c)로 떨어진다.
// v9가 세로 사진을 40~55% 잘라내던 것에 비하면 6%는 실질적으로 "안 잘림"이다.
//
// 균일 스케일이 최적인 근거: Σh_i = T 제약에서 max_i |log(h_i / h_i^자연)|을 최소화하는 해는
// 모든 비율이 같을 때이므로 h_i = s·h_i^자연이 유일 최소해다. **행마다 다르게 흡수할 이유가 없다.**
//
// ── 순수 모듈 계약 ──
// ⚠️ 이 파일은 아무것도 import하지 않는다. 프로젝트 모듈은 물론 lib/collageTokens.ts도.
//    검증 스크립트(scripts/verify-justify.js)가 tsx로 단독 컴파일해 브라우저 없이 돌린다.
//    템플릿별 수치는 전부 JustifyOpts로 주입받는다 — 정책은 lib/collageTemplates.ts의 몫이다.

// ── 자료구조 ──

/** 0..1 정규화 사각형. x는 보드 폭, y는 보드 높이로 나눈 값(비등방) */
export interface NRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 배치의 진실 원천. 기하는 전부 여기서 파생된다.
 *
 * v9의 GridSpec(cols + bands)을 대체한다. 왜 블록·밴드 구조가 사라졌나:
 * 스튜디오의 "방향별 밴드"는 별도 자료구조가 아니라 **order를 방향별로 정렬한 결과**다.
 * 세로 사진만 모인 행은 Σr이 작아 저절로 높아지고, 가로만 모인 행은 낮아진다. 그래서 밴드가
 * 그냥 나온다. 덕분에 전체가 행 하나짜리 스택이라 왜곡 스케일 s가 보드 전역에서 하나다 —
 * 크롭이 전 사진 균일해진다.
 */
export interface JustifiedSpec {
  v: 2;
  /** 배치 순서. 드래그 스왑 = 이 배열의 두 원소 교환 */
  order: string[];
  /** 매거진 히어로. 항상 order[0]이며, 자리에 귀속된다(스왑하면 새 order[0]이 히어로가 된다) */
  hero?: { key: string; side: 'top' | 'left' };
  /** 히어로를 제외한 나머지의 행별 장수. Σ = order.length − (hero ? 1 : 0) */
  rows: number[];
  /** 앰비언트 배경으로 깔 사진 키 — 크롭 0으로는 채울 수 없을 때만 (보통 n ≤ 3) */
  ambient?: string;
}

/** 솔버에 주입되는 수치 일체. 정책(템플릿별 값)은 호출부가 정한다 */
export interface JustifyOpts {
  /** 보드 가로세로비 W/H */
  aspect: number;
  /** 사진 사이 가로 간격 (폭 정규화) */
  gx: number;
  /** 사진 사이 세로 간격 (높이 정규화) — gx와 픽셀 등방이어야 한다 */
  gy: number;
  /** 허용 대칭 중앙 크롭 상한 (0.06 = 6%) */
  cropTol: number;
  /** 행 높이 하한·상한 (높이 정규화) */
  minRowH: number;
  maxRowH: number;
  /** 사진 폭 하한·상한 (폭 정규화) */
  minPhotoW: number;
  maxPhotoW: number;
  /** 한 행에 놓을 수 있는 최대 장수 — 탐색 공간을 묶어 결정성·성능을 지킨다 */
  maxPerRow: number;
  /** 행 높이 분산 가중치. 스튜디오는 양수(밴드 대비를 살린다), 에디토리얼은 0 */
  wVar: number;
  /** 행 장수 다양성 가중치. 매거진은 음수(섞이면 가점) */
  wVariety: number;
  /** 탐색 노드 상한 — 초과해도 탐색 순서가 고정이라 결과는 재현 가능하다 */
  nodeBudget: number;
}

/** 솔버 결과 */
export interface Solution {
  rows: number[];
  /** 균일 세로 스케일. 1이면 무왜곡 */
  s: number;
  /** 왜곡 배율 max(s, 1/s). D − 1이 대칭 중앙 크롭 비율의 상계 */
  d: number;
  score: number;
}

// ── 상수 ──

const EPS = 1e-9;

/**
 * 입력 비율의 안전 밴드. 이 밖의 극단 사진(초광각 파노라마·초장축 스크린샷)은 여기로 접힌다.
 *
 * 접는 이유: 비율 10:1짜리 한 장이 행 하나를 통째로 지배하면 가드레일에 걸려 후보가 전멸하고,
 * 보드 전체가 앰비언트로 떨어진다. 한 장을 3:1로 자르는 편이 18장 전부를 망치는 것보다 낫다.
 * ⚠️ 접힘이 발생한 사진은 CROP_TOL을 넘는 크롭을 받는다 — 검증 스크립트가 접힌 장수를 따로 센다.
 */
export const RATIO_MIN = 1 / 3;
export const RATIO_MAX = 3;

export const clampRatio = (r: number): number =>
  !Number.isFinite(r) || r <= 0 ? 1 : Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));

// ── 기하 ──

/**
 * 행의 자연 높이 — 이 행이 폭을 정확히 채울 때 가지는 높이(높이 정규화).
 *
 * 픽셀 비 r = wp/hp, 보드 비 A = W/H일 때 정규화 폭 w = h·r/A.
 * Σw + (k−1)gx = availW  ⇒  h·(Σr)/A = availW − (k−1)gx
 */
function rowNatural(sumR: number, k: number, availW: number, gx: number, aspect: number): number {
  const content = availW - (k - 1) * gx;
  if (content <= 0 || sumR <= 0) return Number.POSITIVE_INFINITY;
  return (aspect * content) / sumR;
}

/**
 * 주어진 분할로 실제 사각형을 만든다. **어떤 유효한 분할이든 영역 안에 정확히 들어간다** —
 * 그래서 편집 연산이 기하를 깨뜨릴 수 없다(v9 GridSpec 대비 가장 큰 강점).
 *
 * 두 겹의 안전장치:
 *  ① s를 opts.cropTol 안으로 클램프 — 편집으로 행 구성이 크게 바뀌어도 사진을 무한정 자르지 않는다.
 *     시드는 솔버가 이미 cropTol 안에서 골랐으므로 이 클램프가 걸리지 않는다(= 정확히 꽉 참).
 *  ② 그래도 세로가 넘치면 블록 전체를 등비 축소(f)해 담는다. 정규화 공간에서 x·y를 같은 f로
 *     줄이면 픽셀 비가 보존되므로 **추가 크롭이 0**이고, 대신 살짝 여백이 남는다.
 *     ⚠️ ②가 없으면 클램프가 걸린 순간 y가 음수가 되어 사진이 화면 밖으로 나간다
 *     (verify-justify가 울트라와이드 시드와 편집 3연속에서 실제로 잡아낸 버그).
 */
export function layoutRows(
  ratios: number[],
  rows: number[],
  region: NRect,
  opts: JustifyOpts,
): NRect[] {
  const m = rows.length;
  if (!m) return [];
  const nat: number[] = [];
  let cursor = 0;
  for (const k of rows) {
    let sumR = 0;
    for (let i = 0; i < k; i++) sumR += ratios[cursor + i];
    nat.push(rowNatural(sumR, k, region.w, opts.gx, opts.aspect));
    cursor += k;
  }
  const natSum = nat.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(natSum) || natSum <= 0) return [];
  const budget = region.h - (m - 1) * opts.gy;
  const raw = budget / natSum;
  const lo = 1 / (1 + opts.cropTol);
  const hi = 1 + opts.cropTol;
  const s = Math.min(hi, Math.max(lo, raw));

  const rawH = s * natSum + (m - 1) * opts.gy;
  const f = rawH > region.h ? region.h / rawH : 1;
  const usedW = region.w * f;
  const usedH = rawH * f;
  const x0 = region.x + (region.w - usedW) / 2;
  let y = region.y + (region.h - usedH) / 2;

  const out: NRect[] = [];
  cursor = 0;
  for (let bi = 0; bi < m; bi++) {
    const k = rows[bi];
    const h = s * nat[bi] * f;
    let sumR = 0;
    for (let i = 0; i < k; i++) sumR += ratios[cursor + i];
    const content = usedW - (k - 1) * opts.gx * f;
    let x = x0;
    for (let i = 0; i < k; i++) {
      const w = (content * ratios[cursor + i]) / sumR;
      out.push({ x, y, w, h });
      x += w + opts.gx * f;
    }
    cursor += k;
    y += h + opts.gy * f;
  }
  return out;
}

// ── 분할 탐색 ──

/**
 * 순서를 유지한 채 최적 행 분할을 찾는다.
 *
 * n ≤ 18이라 순서 유지 분할(composition)은 maxPerRow 제약과 가지치기를 걸면 수만 노드다.
 * **완전 열거가 전역 최적을 보장하고 결정적이다** — DP가 필요 없다(DP는 오히려 동점 처리를
 * 흐리게 만든다). 실패하면 null: 호출부가 폴백 사다리를 한 칸 내려간다.
 */
export function solveRows(ratios: number[], region: NRect, opts: JustifyOpts): Solution | null {
  const n = ratios.length;
  if (n === 0 || region.w <= 0 || region.h <= 0) return null;

  // 접두합으로 rowNatural을 O(1)에 — 완전 열거의 상수를 낮춘다
  const pre: number[] = [0];
  for (let i = 0; i < n; i++) pre.push(pre[i] + ratios[i]);
  const natOf = (i: number, j: number) =>
    rowNatural(pre[j] - pre[i], j - i, region.w, opts.gx, opts.aspect);

  const maxPerRow = Math.max(1, Math.min(opts.maxPerRow, n));
  let best: Solution | null = null;
  let bestRows: number[] | null = null;
  let nodes = 0;

  const acc: number[] = [];

  // 동점 타이브레이크: ① 행 수가 적은 쪽 ② 분할 배열의 사전순 작은 쪽. 순수·결정적
  const tieBetter = (a: number[], b: number[]): boolean => {
    if (a.length !== b.length) return a.length < b.length;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };

  const evaluate = (natSum: number) => {
    const m = acc.length;
    const budget = region.h - (m - 1) * opts.gy;
    if (budget <= 0) return;
    const s = budget / natSum;
    const d = Math.max(s, 1 / s);
    // ★ 가드레일 A — 크롭. 축소(s) **이후**의 최종 박스로만 판정한다 (v9 collageTokens 교훈)
    if (d > 1 + opts.cropTol + EPS) return;

    let cursor = 0;
    let hSum = 0;
    let hSqSum = 0;
    let smallPenalty = 0;
    for (let bi = 0; bi < m; bi++) {
      const k = acc[bi];
      const h = s * natOf(cursor, cursor + k);
      // ★ 가드레일 B — 행 높이
      if (h < opts.minRowH - EPS || h > opts.maxRowH + EPS) return;
      hSum += h;
      hSqSum += h * h;
      const sumR = pre[cursor + k] - pre[cursor];
      const content = region.w - (k - 1) * opts.gx;
      for (let i = 0; i < k; i++) {
        const w = (content * ratios[cursor + i]) / sumR;
        // ★ 가드레일 C — 사진 폭
        if (w < opts.minPhotoW - EPS || w > opts.maxPhotoW + EPS) return;
        if (w < opts.minPhotoW * 1.5) smallPenalty += (opts.minPhotoW * 1.5 - w) / opts.minPhotoW;
      }
      cursor += k;
    }

    // 목적함수 — 크롭이 지배항이고, 나머지는 템플릿 성격을 만드는 소수점 조정
    const mean = hSum / m;
    const variance = Math.max(0, hSqSum / m - mean * mean);
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const uniqueSizes = new Set(acc).size / m;
    const score =
      100 * (d - 1) + opts.wVar * cv + opts.wVariety * uniqueSizes + 0.05 * smallPenalty;

    if (!best || score < best.score - EPS || (Math.abs(score - best.score) <= EPS && bestRows && tieBetter(acc, bestRows))) {
      best = { rows: acc.slice(), s, d, score };
      bestRows = best.rows;
    }
  };

  const dfs = (i: number, natSum: number) => {
    if (nodes++ > opts.nodeBudget) return;
    if (i === n) {
      evaluate(natSum);
      return;
    }
    for (let k = 1; k <= Math.min(maxPerRow, n - i); k++) {
      const nat = natOf(i, i + k);
      if (!Number.isFinite(nat)) continue;
      const next = natSum + nat;
      // 가지치기: 자연 높이 합이 이미 상한을 넘으면 남은 사진을 더해도 회복되지 않는다.
      // (행을 쪼개면 자연 높이는 항상 늘어난다 — 단조성이 이 가지치기를 정당화한다)
      const budgetCeil = region.h - acc.length * opts.gy;
      if (next > budgetCeil * (1 + opts.cropTol) + EPS) continue;
      acc.push(k);
      dfs(i + k, next);
      acc.pop();
    }
  };

  dfs(0, 0);
  return best;
}

// ── 앰비언트 (크롭 0 폴백) ──

/**
 * 크롭을 한 톨도 내지 않고 배치한다. 남는 자리는 호출부가 블러 배경으로 채운다.
 *
 * 세로 사진 1장을 16:9에 넣는 경우처럼, 크롭 없이는 수학적으로 꽉 채울 수 없는 상황의 정답.
 * s = 1(무왜곡)로 두고 콘텐츠 블록 전체를 등비 축소해 가운데 정렬한다.
 */
export function solveAmbient(ratios: number[], region: NRect, opts: JustifyOpts): number[] {
  const n = ratios.length;
  if (n === 0) return [];
  const pre: number[] = [0];
  for (let i = 0; i < n; i++) pre.push(pre[i] + ratios[i]);
  const natOf = (i: number, j: number) =>
    rowNatural(pre[j] - pre[i], j - i, region.w, opts.gx, opts.aspect);

  const maxPerRow = Math.max(1, Math.min(opts.maxPerRow, n));
  let best: number[] | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  const acc: number[] = [];
  let nodes = 0;

  const dfs = (i: number, natSum: number) => {
    if (nodes++ > opts.nodeBudget) return;
    if (i === n) {
      const used = natSum + (acc.length - 1) * opts.gy;
      // 넘치면 축소되고 모자라면 여백이 남는다 — 어느 쪽이든 |차이|가 작을수록 좋다
      const gap = Math.abs(used - region.h);
      if (gap < bestGap - EPS) {
        bestGap = gap;
        best = acc.slice();
      }
      return;
    }
    for (let k = 1; k <= Math.min(maxPerRow, n - i); k++) {
      const nat = natOf(i, i + k);
      if (!Number.isFinite(nat)) continue;
      acc.push(k);
      dfs(i + k, natSum + nat);
      acc.pop();
    }
  };
  dfs(0, 0);
  return best ?? [n];
}

/** 앰비언트 배치의 실제 사각형 — s = 1로 두고 블록 전체를 등비 축소·중앙 정렬 */
export function layoutAmbient(
  ratios: number[],
  rows: number[],
  region: NRect,
  opts: JustifyOpts,
): NRect[] {
  const m = rows.length;
  if (!m) return [];
  const nat: number[] = [];
  let cursor = 0;
  for (const k of rows) {
    let sumR = 0;
    for (let i = 0; i < k; i++) sumR += ratios[cursor + i];
    nat.push(rowNatural(sumR, k, region.w, opts.gx, opts.aspect));
    cursor += k;
  }
  const ch = nat.reduce((a, b) => a + b, 0) + (m - 1) * opts.gy;
  // 정규화 공간에서 x·y를 같은 f로 줄이면 픽셀 비가 보존된다(= 크롭 0)
  const f = ch > region.h ? region.h / ch : 1;
  const usedW = region.w * f;
  const usedH = ch * f;
  let y = region.y + (region.h - usedH) / 2;
  const x0 = region.x + (region.w - usedW) / 2;

  const out: NRect[] = [];
  cursor = 0;
  for (let bi = 0; bi < m; bi++) {
    const k = rows[bi];
    const h = nat[bi] * f;
    let sumR = 0;
    for (let i = 0; i < k; i++) sumR += ratios[cursor + i];
    const content = usedW - (k - 1) * opts.gx * f;
    let x = x0;
    for (let i = 0; i < k; i++) {
      const w = (content * ratios[cursor + i]) / sumR;
      out.push({ x, y, w, h });
      x += w + opts.gx * f;
    }
    cursor += k;
    y += h + opts.gy * f;
  }
  return out;
}

// ── 방향 분류 (스튜디오) ──

export type Orientation = 'P' | 'S' | 'L';

/** 세로 / 정사각 / 가로. 임계는 호출부가 주입한다 */
export function classOf(r: number, portraitMax: number, landscapeMin: number): Orientation {
  if (r < portraitMax) return 'P';
  if (r > landscapeMin) return 'L';
  return 'S';
}

/**
 * 방향별로 묶은 순서. 스튜디오 템플릿의 정체성이 전부 여기서 나온다 —
 * 세로만 모인 행은 Σr이 작아 저절로 높아지고(좁고 긴 밴드), 가로만 모인 행은 낮아진다(넓고 낮은 밴드).
 *
 * 축퇴는 전부 자연스럽게 처리된다: 한 클래스만 있으면 그냥 원순서고, 한 장뿐인 클래스는
 * 자기 자리에서 이웃과 같은 높이로 정렬될 뿐이다. 별도 분기가 필요 없다.
 * ⚠️ 클래스 **내부에서는 원순서를 보존**한다(안정 정렬) — 안 그러면 섹션 순서가 뒤죽박죽이 된다.
 */
export function orderByOrientation(
  keys: string[],
  ratios: Record<string, number>,
  aspect: number,
  portraitMax: number,
  landscapeMin: number,
): string[] {
  // 가로 보드는 넓고 낮은 밴드부터(위→아래로 시선이 눕는다), 세로 보드는 반대
  const rank: Record<Orientation, number> =
    aspect > 1 ? { L: 0, S: 1, P: 2 } : { P: 0, S: 1, L: 2 };
  return keys
    .map((key, i) => ({ key, i, c: classOf(ratios[key] ?? 1, portraitMax, landscapeMin) }))
    .sort((a, b) => (rank[a.c] !== rank[b.c] ? rank[a.c] - rank[b.c] : a.i - b.i))
    .map((e) => e.key);
}

// ── 불변식 ──

/** v9 타일링 정리의 후계. O(n)이고, 이게 통과하면 layoutRows가 빈틈 0을 보장한다 */
export function assertPartition(spec: JustifiedSpec): boolean {
  if (spec.v !== 2) return false;
  if (!Array.isArray(spec.order) || !Array.isArray(spec.rows)) return false;
  if (new Set(spec.order).size !== spec.order.length) return false;
  if (spec.hero && !spec.order.includes(spec.hero.key)) return false;
  if (spec.rows.some((k) => !Number.isInteger(k) || k < 1)) return false;
  const expected = spec.order.length - (spec.hero ? 1 : 0);
  const total = spec.rows.reduce((a, b) => a + b, 0);
  if (total !== expected) return false;
  // 사진이 히어로뿐이면 rows는 비어 있어야 하고, 그 외에는 최소 1행
  if (expected > 0 && spec.rows.length === 0) return false;
  return true;
}

// ── 편집 연산 (전부 total — null을 반환하지 않는다) ──

/**
 * 자리 교환. 스팬(= 행 안에서 몇 번째 자리인지)은 '자리'에 귀속되므로 rows는 그대로다.
 * 그래서 기하가 깨질 수 없다 — v9 swapInGrid와 같은 원리.
 * 히어로는 항상 order[0]이라, 히어로와 스왑하면 새로 온 사진이 히어로가 된다.
 */
export function swapInSpec(spec: JustifiedSpec, a: string, b: string): JustifiedSpec {
  const ia = spec.order.indexOf(a);
  const ib = spec.order.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return spec;
  const order = spec.order.slice();
  order[ia] = b;
  order[ib] = a;
  return { ...spec, order, hero: spec.hero ? { ...spec.hero, key: order[0] } : undefined };
}

/** key가 들어있는 행의 인덱스와 그 행의 시작 오프셋 */
function locate(spec: JustifiedSpec, key: string): { row: number; start: number } | null {
  const base = spec.hero ? 1 : 0;
  const idx = spec.order.indexOf(key);
  if (idx < base) return null;
  const pos = idx - base;
  let cursor = 0;
  for (let r = 0; r < spec.rows.length; r++) {
    if (pos < cursor + spec.rows[r]) return { row: r, start: cursor };
    cursor += spec.rows[r];
  }
  return null;
}

/**
 * 크게 / 작게 — 폭 가중치가 아니라 **행 경계를 옮긴다**.
 *
 * 가중치 방식(그 사진만 넓게)을 쓰지 않는 이유: 그 사진만 왜곡되고 그만큼 추가로 잘린다.
 * "크롭 금지"와 정면 충돌한다. 행 장수를 줄이면 그 행 전체가 커지는데, 추가 크롭이 **0**이고
 * 변화 폭도 오히려 크다(1→2배가 아니라 행이 통째로 재조판된다).
 *
 * 불가능하면(예: 1장짜리 행을 더 줄이기) 원본을 그대로 돌려준다 — 실패는 없다.
 */
export function bumpRowInSpec(spec: JustifiedSpec, key: string, dir: 'up' | 'down'): JustifiedSpec {
  const loc = locate(spec, key);
  if (!loc) return spec;
  const base = spec.hero ? 1 : 0;
  const rows = spec.rows.slice();
  const r = loc.row;
  const k = rows[r];

  // ★ order를 건드릴 필요가 전혀 없다 — 행은 순서열의 **절단점**일 뿐이라
  //   "이 행의 마지막 장을 다음 행으로" = rows[r]−1, rows[r+1]+1 이다. 사진은 제자리에 있다.
  //   이 성질이 편집 연산의 정확성을 자명하게 만든다(v9는 여기서 키 배열을 재구성하다 깨졌다).
  const tappedLocal = spec.order.indexOf(key) - base - loc.start;

  if (dir === 'up') {
    if (k <= 1) return spec; // 이미 혼자 쓰는 행 — 더 키울 수 없다
    // 탭한 사진이 행의 끝에 있으면 앞쪽을 덜어내야 그 사진이 남는다
    if (tappedLocal === k - 1) {
      rows[r] = k - 1;
      if (r === 0) rows.unshift(1);
      else rows[r - 1] += 1;
    } else {
      rows[r] = k - 1;
      if (r + 1 < rows.length) rows[r + 1] += 1;
      else rows.push(1);
    }
  } else {
    if (r + 1 < rows.length) {
      rows[r] = k + 1;
      rows[r + 1] -= 1;
      if (rows[r + 1] === 0) rows.splice(r + 1, 1);
    } else if (r > 0) {
      rows[r] = k + 1;
      rows[r - 1] -= 1;
      if (rows[r - 1] === 0) rows.splice(r - 1, 1);
    } else {
      return spec; // 행이 하나뿐 — 더 줄일 수 없다
    }
  }

  const next: JustifiedSpec = { ...spec, rows };
  // 편집은 절대 실패하지 않는다는 계약 — 혹시라도 불변식이 깨지면 원본을 돌려준다
  return assertPartition(next) ? next : spec;
}

/** 사진 추가 — 읽기 순서 끝에 붙인다. 기존 상대 순서는 보존되지만 좌표는 움직인다(v9부터의 계약) */
export function insertKeys(spec: JustifiedSpec, keys: string[], maxPerRow: number): JustifiedSpec {
  const fresh = keys.filter((k) => !spec.order.includes(k));
  if (!fresh.length) return spec;
  const order = [...spec.order, ...fresh];
  const rows = spec.rows.slice();
  for (let i = 0; i < fresh.length; i++) {
    if (rows.length && rows[rows.length - 1] < maxPerRow) rows[rows.length - 1] += 1;
    else rows.push(1);
  }
  const next: JustifiedSpec = { ...spec, order, rows };
  return assertPartition(next) ? next : spec;
}

/**
 * 사진 삭제. 각 행에서 살아남은 장수를 세고 빈 행을 버린다.
 *
 * 히어로가 지워지면 히어로 자체를 해제한다 — 다음 사진이 조용히 승격되면 사용자가 놀란다.
 * 그래도 별도 보정이 필요 없다: 히어로가 빠지면 order와 rows의 합이 자동으로 맞는다
 * (원래 rows는 히어로를 뺀 나머지를 세고 있었고, 히어로가 사라지면 hero 플래그도 같이 사라지므로).
 */
export function removeKeys(spec: JustifiedSpec, keys: string[]): JustifiedSpec {
  const gone = new Set(keys.filter((k) => spec.order.includes(k)));
  if (!gone.size) return spec;
  const base = spec.hero ? 1 : 0;
  const heroGone = !!spec.hero && gone.has(spec.hero.key);

  const rows: number[] = [];
  let cursor = 0;
  for (const k of spec.rows) {
    let alive = 0;
    for (let i = 0; i < k; i++) if (!gone.has(spec.order[base + cursor + i])) alive += 1;
    if (alive > 0) rows.push(alive);
    cursor += k;
  }
  const order = spec.order.filter((k) => !gone.has(k));
  const next: JustifiedSpec = {
    v: 2,
    order,
    rows,
    hero: !spec.hero || heroGone ? undefined : { ...spec.hero, key: order[0] },
    ambient: spec.ambient && order.includes(spec.ambient) ? spec.ambient : undefined,
  };
  return assertPartition(next) ? next : spec;
}
