// 콜라주 배치의 진실 원천 — 명시적 그리드(GridSpec) (v9.0).
//
// 왜 생겼나: v8.7까지 배치의 진실 원천은 "저장된 정규화 좌표"였고, 자동 정렬은 그 좌표에서
// 그리드를 역산(inferGridSpans)해야만 동작했다. 역산이 실패하면(오차 35% 초과, 스팬 범위 이탈)
// null을 반환하고 리플로우가 통째로 죽어, 사용자에겐 "한 번 자유롭게 옮겼더니 그 뒤로
// 자동 정렬이 영영 안 됨"으로 나타났다.
//
// 이제 스팬을 명시적으로 저장하고 좌표를 거기서 파생시킨다. 그 결과 "빈틈 0"이 사후 측정이 아니라
// 불변식이 된다:
//   - row 밴드   : sum(spans) === cols                    (center 밴드는 의도적 예외)
//   - hero 밴드  : 1 + 2×(cols−2) 항목이 정확히 cols 점유
//   ⇒ 전체 구멍 = 밴드별 정리의 합 = 0
//
// 좌표(items)는 항상 grid와 일관되게 기록되므로, grid를 모르는 구 코드가 읽어도 정상 렌더된다
// → 스키마 v4 유지, schemaVersion 상향 불필요.

import { CollageLayoutItem } from './types';
import { GridTemplate, SPAN_CAP, spacingFor } from './collageTokens';

// ── 타입 ──

/** 히어로 밴드 — 2×2 하나 + 남은 열마다 1×1 두 장 스택. 정확히 2행 × cols열을 점유한다 */
export interface HeroBand {
  kind: 'hero';
  heroKey: string;
  /** 히어로를 오른쪽 끝에 둘지 — 밴드마다 교대해 리듬을 만든다 */
  heroRight: boolean;
  /** 남은 열을 위→아래, 왼→오른쪽 순으로 채우는 키들. 길이 = 2×(cols−2) */
  stackKeys: string[];
}

/** 행 밴드 — spans가 cols를 정확히 타일한다(center면 예외적으로 짧고 가운데 정렬) */
export interface RowBand {
  kind: 'row';
  keys: string[];
  /** keys와 같은 길이. 각 항목이 차지하는 열 수 */
  spans: number[];
  /** 이 밴드의 높이(행 단위). 박스 가로세로비를 2 이하로 유지하려고 늘린다 */
  rows: number;
  /** 매트 갤러리의 마지막 짧은 행 — 채우지 않고 가운데 정렬한다(여백이 컨셉) */
  center?: boolean;
}

export type Band = HeroBand | RowBand;

export interface GridSpec {
  v: 1;
  cols: number;
  bands: Band[];
}

export interface GridCell {
  key: string;
  /** 열 인덱스 (center 밴드에서는 소수일 수 있다) */
  c: number;
  r: number;
  sc: number;
  sr: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// ── 분배 ──

/** cols를 k개로 균등 분배. 앞쪽 (cols % k)개가 1씩 더 갖는다 → 합이 정확히 cols (정리).
 *  layoutBalancedGrid의 행 분배(v8.4)와 같은 알고리즘을 축만 바꿔 재사용한 것 */
export function splitCols(cols: number, k: number): number[] {
  if (k <= 0) return [];
  const base = Math.floor(cols / k);
  const extra = cols % k;
  return Array.from({ length: k }, (_, j) => base + (j < extra ? 1 : 0));
}

/** 배열을 왼쪽으로 n칸 회전 — 합과 원소는 그대로다 */
function rotateLeft<T>(arr: T[], n: number): T[] {
  if (arr.length <= 1) return arr;
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/** k개가 cols를 나눠 가질 때 이 행이 가져야 할 높이(행 단위).
 *  최대 스팬이 ceil(cols/k)이므로 rows = ceil(maxSpan/2)면 박스 가로세로비가 항상 2 이하 —
 *  1행짜리 3열 스팬 같은 "띠" 사진(object-cover가 심하게 자른다)을 원천 차단한다 */
export function rowUnitsFor(cols: number, k: number): number {
  if (k <= 0) return 1;
  return Math.max(1, Math.ceil(Math.ceil(cols / k) / 2));
}

/** 키 목록을 균형 행들로 나눈다 — 행당 개수 차이 ≤1.
 *  스팬이 SPAN_CAP을 넘어야만 채울 수 있는 행(예: 6열에 사진 1장)은
 *   - 시드 경로(allowCenter=false): null → 호출자가 그 cols 후보를 버린다
 *   - 편집 경로(allowCenter=true): 캡 안에서 채우고 가운데 정렬 → **편집이 실패하지 않는다**
 *  편집 중 null을 돌려주면 v8.x의 "자동 정렬이 갑자기 안 됨"이 그대로 재발한다. */
export function buildRowBands(keys: string[], cols: number, allowCenter = false): RowBand[] | null {
  const n = keys.length;
  if (n === 0) return [];
  const rows = Math.max(1, Math.ceil(n / cols));
  const base = Math.floor(n / rows);
  const extra = n % rows;
  const bands: RowBand[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const k = base + (r < extra ? 1 : 0);
    if (k <= 0) continue;
    const slice = keys.slice(i, i + k);
    i += k;
    // 넓은 칸의 위치를 행마다 한 칸씩 돌린다 — splitCols는 항상 앞쪽에 큰 값을 주므로
    // 그대로 쓰면 넓은 사진이 전부 첫 열에 세로로 줄지어 "줄무늬"처럼 보인다(실렌더 확인).
    // 회전은 합·캡을 바꾸지 않으므로 타일링 정리는 그대로 성립한다
    const exact = rotateLeft(splitCols(cols, k), r);
    if (Math.max(...exact) <= SPAN_CAP) {
      bands.push({ kind: 'row', keys: slice, spans: exact, rows: rowUnitsFor(cols, k) });
      continue;
    }
    if (!allowCenter) return null;
    const capped = exact.map((s) => Math.min(s, SPAN_CAP));
    bands.push({
      kind: 'row',
      keys: slice,
      spans: capped,
      rows: rowUnitsFor(cols, k),
      ...(sum(capped) < cols ? { center: true } : {}),
    });
  }
  return bands;
}

/** 매트 갤러리 — 전 항목 1×1 균일. 마지막 짧은 행은 채우지 않고 가운데 정렬한다 */
export function buildUniformBands(keys: string[], cols: number): RowBand[] {
  const bands: RowBand[] = [];
  for (let i = 0; i < keys.length; i += cols) {
    const slice = keys.slice(i, i + cols);
    bands.push({
      kind: 'row',
      keys: slice,
      spans: slice.map(() => 1),
      rows: 1,
      ...(slice.length < cols ? { center: true } : {}),
    });
  }
  return bands;
}

export interface BandRecipe {
  /** 2×2 히어로 밴드로 시작할지 (모자이크·미니멀의 매거진 리듬) */
  hero?: boolean;
  /** 히어로 밴드 최대 개수 */
  heroMax?: number;
  /** 전 항목 1×1 균일 + 짧은 행 가운데 정렬 (매트 갤러리) */
  uniform?: boolean;
}

export function heroSizeFor(cols: number): number {
  return 1 + 2 * (cols - 2);
}

/** 키 목록 → 밴드 구성. 구성 불가(스팬 캡 초과 등)면 null */
export function buildBands(keys: string[], cols: number, recipe: BandRecipe = {}): Band[] | null {
  // cols=1(세로 스택)도 유효한 후보다 — 사진이 1~2장일 때 이걸 막으면 사진이 셀 하나에 갇혀
  // 허공에 뜬다(폰 매트 n=1에서 채움률 0.22, 사진 411px/2532px). 큰 화면에서는 채움률이 알아서 진다
  if (cols < 1) return null;
  if (keys.length === 0) return [];
  if (recipe.uniform) return buildUniformBands(keys, cols);

  const bands: Band[] = [];
  let rest = keys;

  if (recipe.hero && cols >= 3) {
    const hs = heroSizeFor(cols);
    const heroMax = recipe.heroMax ?? 1;
    // 히어로 뒤에 최소 한 행이 남아야 "크고 작은 리듬"이 생긴다 — 히어로만 있으면 그냥 큰 그리드다
    for (let h = 0; h < heroMax && rest.length >= hs + cols; h++) {
      bands.push({
        kind: 'hero',
        heroKey: rest[0],
        heroRight: h % 2 === 1,
        stackKeys: rest.slice(1, hs),
      });
      rest = rest.slice(hs);
    }
  }

  const rows = buildRowBands(rest, cols);
  if (!rows) return null;
  bands.push(...rows);
  return bands;
}

// ── 그리드 → 셀 좌표 ──

/** 밴드를 격자 좌표로 펼친다. materialize·assertTiling·검증이 모두 이 함수를 공유한다 */
export function layoutCells(grid: GridSpec): { cells: GridCell[]; totalRows: number } {
  const { cols, bands } = grid;
  const cells: GridCell[] = [];
  let r = 0;
  for (const band of bands) {
    if (band.kind === 'hero') {
      const heroCol = band.heroRight ? cols - 2 : 0;
      cells.push({ key: band.heroKey, c: heroCol, r, sc: 2, sr: 2 });
      let i = 0;
      for (let c = 0; c < cols; c++) {
        if (c >= heroCol && c < heroCol + 2) continue;
        for (let rr = 0; rr < 2; rr++) {
          const key = band.stackKeys[i++];
          if (key === undefined) continue;
          cells.push({ key, c, r: r + rr, sc: 1, sr: 1 });
        }
      }
      r += 2;
    } else {
      const total = sum(band.spans);
      let c = band.center ? (cols - total) / 2 : 0;
      band.keys.forEach((key, j) => {
        cells.push({ key, c, r, sc: band.spans[j], sr: band.rows });
        c += band.spans[j];
      });
      r += band.rows;
    }
  }
  return { cells, totalRows: r };
}

/** 읽기 순서(위→아래, 왼→오른쪽)대로의 키 목록. reconcile이 "상대 순서 보존"을 판정하는 기준 */
export function gridKeys(grid: GridSpec): string[] {
  const out: string[] = [];
  for (const band of grid.bands) {
    if (band.kind === 'hero') out.push(band.heroKey, ...band.stackKeys);
    else out.push(...band.keys);
  }
  return out;
}

/** 불변식 검사 — 모든 row 밴드가 cols를 정확히 타일하고, hero 밴드 스택 수가 맞는가.
 *  center 밴드(매트의 마지막 짧은 행)만 예외로 허용한다 */
export function assertTiling(grid: GridSpec): boolean {
  if (grid.cols < 1) return false;
  for (const band of grid.bands) {
    if (band.kind === 'hero') {
      if (grid.cols < 3) return false;
      if (band.stackKeys.length !== 2 * (grid.cols - 2)) return false;
    } else {
      if (band.keys.length !== band.spans.length) return false;
      if (band.spans.some((s) => s < 1 || s > SPAN_CAP)) return false;
      if (band.rows < 1) return false;
      const total = sum(band.spans);
      if (band.center ? total > grid.cols : total !== grid.cols) return false;
    }
  }
  return true;
}

// ── 그리드 → 정규화 좌표 ──

export interface GridMetrics {
  unitW: number;
  unitH: number;
  left: number;
  top: number;
  contentW: number;
  contentH: number;
  totalRows: number;
  /** 프레임을 얼마나 채웠는가 — cols 탐색의 목적함수 */
  fill: number;
}

/** 셀 크기·정렬 계산. k-축소(세로 초과 시 셀 축소)까지 반영한 **최종** 수치를 돌려준다.
 *  ⚠️ 가드레일 검사는 반드시 이 결과에 적용할 것 — 축소 전 값으로 판정하면 멀쩡한 후보를 잘못 버린다 */
export function gridMetrics(grid: GridSpec, template: GridTemplate, aspect: number): GridMetrics {
  const sp = spacingFor(template, aspect);
  const { totalRows } = layoutCells(grid);
  const cols = grid.cols;

  let unitW = (sp.availWidth - (cols - 1) * sp.gutterX) / cols;
  let unitH = unitW * aspect; // 픽셀 정사각

  const needed = totalRows * unitH + (totalRows - 1) * sp.gutterY;
  if (needed > sp.availHeight) {
    // 갭은 축소하지 않으므로 갭을 제외한 셀 예산으로 k를 구한다 —
    // availHeight/needed 방식은 (1−k)×갭만큼 하단이 넘친다 (v8.2에서 발견된 오차)
    const k = Math.max(0.01, (sp.availHeight - (totalRows - 1) * sp.gutterY) / (totalRows * unitH));
    unitW *= k;
    unitH *= k;
  }

  const contentW = cols * unitW + (cols - 1) * sp.gutterX;
  const contentH = totalRows * unitH + (totalRows - 1) * sp.gutterY;
  const left = sp.marginX + Math.max(0, (sp.availWidth - contentW) / 2);
  const top = sp.titleBottom + Math.max(0, (sp.availHeight - contentH) / 2);
  const fill =
    sp.availWidth > 0 && sp.availHeight > 0
      ? (contentW / sp.availWidth) * (contentH / sp.availHeight)
      : 0;

  return { unitW, unitH, left, top, contentW, contentH, totalRows, fill };
}

/** 그리드 → 정규화 좌표 items. z는 호출자가 정한다(리플로우는 기존 z 보존) */
export function materialize(
  grid: GridSpec,
  template: GridTemplate,
  aspect: number,
  zOf: (key: string, index: number) => number = (_k, i) => i + 1
): Record<string, CollageLayoutItem> {
  const sp = spacingFor(template, aspect);
  const m = gridMetrics(grid, template, aspect);
  const { cells } = layoutCells(grid);
  const stepX = m.unitW + sp.gutterX;
  const stepY = m.unitH + sp.gutterY;

  const out: Record<string, CollageLayoutItem> = {};
  cells.forEach((cell, i) => {
    out[cell.key] = {
      x: m.left + cell.c * stepX,
      y: m.top + cell.r * stepY,
      w: cell.sc * m.unitW + (cell.sc - 1) * sp.gutterX,
      h: cell.sr * m.unitH + (cell.sr - 1) * sp.gutterY,
      z: zOf(cell.key, i),
    };
  });
  return out;
}

// ── 편집 연산 ──
// 공통 원리: 편집한 밴드까지만 국소 수정하고, 그 뒤 밴드들은 키만 모아 표준 분배로 재구성한다.
// "국소 편집 + 하류 재구성" — 항상 타일링이 유지되고 상대 순서도 보존된다.

/** 히어로 밴드를 두 개의 행 밴드로 분해. 리사이즈처럼 히어로 구조를 유지할 수 없는 편집의 전처리 */
function decomposeHero(band: HeroBand, cols: number): RowBand[] {
  const left = band.heroRight ? [] : [band.heroKey];
  const right = band.heroRight ? [band.heroKey] : [];
  const tops: string[] = [];
  const bottoms: string[] = [];
  for (let i = 0; i < band.stackKeys.length; i += 2) {
    tops.push(band.stackKeys[i]);
    if (band.stackKeys[i + 1] !== undefined) bottoms.push(band.stackKeys[i + 1]);
  }
  const row1Keys = [...left, ...tops, ...right];
  const row1Spans = row1Keys.map((k) => (k === band.heroKey ? 2 : 1));
  const bands: RowBand[] = [{ kind: 'row', keys: row1Keys, spans: row1Spans, rows: 1 }];
  if (bottoms.length) {
    const spans = splitCols(cols, bottoms.length);
    bands.push({ kind: 'row', keys: bottoms, spans, rows: rowUnitsFor(cols, bottoms.length) });
  }
  return bands;
}

/** 밴드 배열에서 key가 있는 밴드 인덱스 */
function bandIndexOf(bands: Band[], key: string): number {
  return bands.findIndex((b) =>
    b.kind === 'hero' ? b.heroKey === key || b.stackKeys.includes(key) : b.keys.includes(key)
  );
}

/** key가 히어로 밴드에 있으면 그 밴드만 행 밴드로 분해한 새 밴드 배열 */
function flattenHeroAt(bands: Band[], cols: number, key: string): Band[] {
  const bi = bandIndexOf(bands, key);
  if (bi < 0) return bands;
  const band = bands[bi];
  if (band.kind !== 'hero') return bands;
  return [...bands.slice(0, bi), ...decomposeHero(band, cols), ...bands.slice(bi + 1)];
}

/** 한 행에서 fixedIndex의 스팬을 고정하고 나머지가 slack을 흡수하도록 재분배.
 *  자리가 모자라면 **뒤쪽부터** 밀어낸다(evicted) — 고정 항목은 절대 밀리지 않는다.
 *  캡 때문에 cols를 정확히 못 채우면 center로 표시한다(실패 대신 여백) */
function rebalanceRow(
  keys: string[],
  fixedIndex: number,
  fixedSpan: number,
  cols: number
): { keys: string[]; spans: number[]; evicted: string[]; center: boolean } {
  const fixed = clamp(Math.round(fixedSpan), 1, Math.min(cols, SPAN_CAP));
  const remaining = Math.max(0, cols - fixed);

  // 나머지는 각자 최소 1칸이 필요하므로 remaining개까지만 이 행에 남을 수 있다
  const otherIdx = keys.map((_, i) => i).filter((i) => i !== fixedIndex);
  const keepCount = Math.min(otherIdx.length, remaining);
  const keptOtherIdx = otherIdx.slice(0, keepCount);
  const evicted = otherIdx.slice(keepCount).map((i) => keys[i]);

  const keptIdx = [...keptOtherIdx, fixedIndex].sort((a, b) => a - b);
  const kept = keptIdx.map((i) => keys[i]);
  const otherSpans = splitCols(remaining, keptOtherIdx.length).map((s) => Math.min(s, SPAN_CAP));

  let oi = 0;
  const spans = keptIdx.map((i) => (i === fixedIndex ? fixed : otherSpans[oi++] ?? 1));
  return { keys: kept, spans, evicted, center: sum(spans) < cols };
}

/** 사진 하나의 스팬을 바꾸고 나머지가 자리를 내주게 한다. 결과는 항상 타일링을 만족한다.
 *  세로 스팬(sr)은 행 단위 속성 — "이 줄이 통째로 커진다" */
export function resizeInGrid(grid: GridSpec, key: string, span: [number, number]): GridSpec | null {
  const cols = grid.cols;
  let bands = flattenHeroAt(grid.bands, cols, key);
  const bi = bandIndexOf(bands, key);
  if (bi < 0) return null;
  const band = bands[bi];
  if (band.kind !== 'row') return null;

  const idx = band.keys.indexOf(key);
  const { keys, spans, evicted, center } = rebalanceRow(band.keys, idx, span[0], cols);
  const nextBand: RowBand = {
    kind: 'row',
    keys,
    spans,
    rows: clamp(Math.round(span[1]), 1, SPAN_CAP),
    ...(center ? { center: true } : {}),
  };
  bands = [...bands.slice(0, bi), nextBand, ...bands.slice(bi + 1)];

  if (evicted.length) {
    // 밀려난 키를 다음 밴드 앞에 넣고 하류를 재구성 — 읽기 순서가 보존된다
    const tailKeys: string[] = [...evicted];
    for (const b of bands.slice(bi + 1)) {
      if (b.kind === 'hero') tailKeys.push(b.heroKey, ...b.stackKeys);
      else tailKeys.push(...b.keys);
    }
    // allowCenter — 편집 경로는 실패하면 안 된다(자동 정렬 불사 계약)
    const tail = buildRowBands(tailKeys, cols, true);
    if (!tail) return null;
    bands = [...bands.slice(0, bi + 1), ...tail];
  }

  const next: GridSpec = { v: 1, cols, bands };
  return assertTiling(next) ? next : null;
}

/** 두 사진의 자리를 맞바꾼다. 스팬은 '자리'에 귀속되므로 레이아웃은 그대로고 사진만 교환된다 —
 *  이것이 "자리만 스왑하는 쉬운 편집"의 메커니즘이자, 그리드가 깨질 수 없는 이유다 */
export function swapInGrid(grid: GridSpec, a: string, b: string): GridSpec {
  if (a === b) return grid;
  const swap = (k: string) => (k === a ? b : k === b ? a : k);
  return {
    v: 1,
    cols: grid.cols,
    bands: grid.bands.map((band) =>
      band.kind === 'hero'
        ? { ...band, heroKey: swap(band.heroKey), stackKeys: band.stackKeys.map(swap) }
        : { ...band, keys: band.keys.map(swap) }
    ),
  };
}

/** 새 사진을 끝에 붙인다. 마지막 히어로 밴드 이후를 재구성하므로 앞쪽 편집은 보존된다 */
export function insertKeys(grid: GridSpec, keys: string[], uniform = false): GridSpec | null {
  if (keys.length === 0) return grid;
  const cols = grid.cols;
  const lastHero = grid.bands.reduce((m, b, i) => (b.kind === 'hero' ? i : m), -1);
  const head = grid.bands.slice(0, lastHero + 1);
  const tailKeys: string[] = [];
  for (const b of grid.bands.slice(lastHero + 1)) {
    if (b.kind === 'hero') tailKeys.push(b.heroKey, ...b.stackKeys);
    else tailKeys.push(...b.keys);
  }
  tailKeys.push(...keys);
  const tail = uniform ? buildUniformBands(tailKeys, cols) : buildRowBands(tailKeys, cols, true);
  if (!tail) return null;
  const next: GridSpec = { v: 1, cols, bands: [...head, ...tail] };
  return assertTiling(next) ? next : null;
}

/** 사진을 뺀다. 히어로가 빠지면 그 밴드를 분해한 뒤 재구성한다 */
export function removeKeys(grid: GridSpec, keys: string[], uniform = false): GridSpec | null {
  const drop = new Set(keys);
  if (drop.size === 0) return grid;
  const cols = grid.cols;
  const bands: Band[] = [];
  let dirtyFrom = -1;
  grid.bands.forEach((band) => {
    if (band.kind === 'hero') {
      if (drop.has(band.heroKey) || band.stackKeys.some((k) => drop.has(k))) {
        if (dirtyFrom < 0) dirtyFrom = bands.length;
        bands.push(...decomposeHero(band, cols));
      } else bands.push(band);
    } else {
      if (band.keys.some((k) => drop.has(k))) {
        if (dirtyFrom < 0) dirtyFrom = bands.length;
      }
      bands.push(band);
    }
  });
  if (dirtyFrom < 0) return grid;

  // 삭제된 키를 걷어내고 하류 재구성
  const head = bands.slice(0, dirtyFrom);
  const tailKeys: string[] = [];
  for (const b of bands.slice(dirtyFrom)) {
    if (b.kind === 'hero') tailKeys.push(b.heroKey, ...b.stackKeys);
    else tailKeys.push(...b.keys);
  }
  const kept = tailKeys.filter((k) => !drop.has(k));
  const tail = uniform ? buildUniformBands(kept, cols) : buildRowBands(kept, cols, true);
  if (!tail) return null;
  const next: GridSpec = { v: 1, cols, bands: [...head, ...tail] };
  return assertTiling(next) ? next : null;
}

/** 레거시(그리드 메타가 없는) 배치의 지연 백필 — 역산한 스팬을 읽기 순서대로 행으로 묶는다.
 *  정확히 cols로 떨어지지 않으면 null → 호출부가 freeform으로 취급(현행과 동일 동작) */
export function gridFromSpans(
  spans: Record<string, [number, number]>,
  order: string[],
  cols: number
): GridSpec | null {
  if (cols < 2 || order.length === 0) return null;
  const bands: Band[] = [];
  let keys: string[] = [];
  let widths: number[] = [];
  let acc = 0;
  let maxRows = 1;

  for (const key of order) {
    const sp = spans[key];
    if (!sp) return null;
    const [sc, sr] = sp;
    if (sc < 1 || sc > SPAN_CAP || sr < 1 || sr > SPAN_CAP) return null;
    if (acc + sc > cols) return null; // 행 경계를 넘어 걸치는 배치 — 밴드로 표현 불가
    keys.push(key);
    widths.push(sc);
    acc += sc;
    maxRows = Math.max(maxRows, sr);
    if (acc === cols) {
      bands.push({ kind: 'row', keys, spans: widths, rows: maxRows });
      keys = [];
      widths = [];
      acc = 0;
      maxRows = 1;
    }
  }
  if (keys.length) {
    // 마지막 행이 덜 찼으면 균등 분배로 채워 타일링을 완성한다
    bands.push({
      kind: 'row',
      keys,
      spans: splitCols(cols, keys.length),
      rows: maxRows,
    });
  }
  const grid: GridSpec = { v: 1, cols, bands };
  return assertTiling(grid) ? grid : null;
}
