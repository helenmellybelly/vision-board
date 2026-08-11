'use client';

import { useEffect, useRef, useState } from 'react';
import { CollageLayout, CollageLayoutItem, CollageSticker, CollageTemplate } from '@/lib/types';
import {
  ASPECT,
  CollageItem,
  MAX_W,
  MIN_W,
  STICKER_FONT_RATIO,
  STICKER_MIN_W,
  applyGrid,
  chooseGrid,
  newStickerLayoutItem,
  resolveLayout,
  seedLayout,
  stickerKey,
  themeFor,
} from '@/lib/collageTemplates';
import {
  MATTE_MAT_RATIO,
  SPAN_CAP,
  spacingFor,
  titleTokensFor,
} from '@/lib/collageTokens';
import { GridSpec, gridMetrics, layoutCells, materialize, resizeInGrid, swapInGrid } from '@/lib/collageGrid';
import { SECTIONS } from '@/lib/questions';
import { SectionId } from '@/lib/types';
import { displaySrc } from '@/lib/imageSrc';
import EditableYear from './EditableYear';
import StickerSheet from './StickerSheet';
import Lightbox from '@/components/Lightbox';

interface Props {
  template: CollageTemplate;
  items: CollageItem[];
  layout: CollageLayout | undefined;
  onLayoutChange: (layout: CollageLayout) => void;
  year: string;
  onYearChange: (year: string) => void;
  /** 캔버스 비율(w/h) — 보드 4:5, 폰/PC는 선택한 기기 사이즈 비율. 좌표 공간과 시드가 비율별로 다르다 (v6.19) */
  aspect?: number;
  /** 나란히 배치 식별 (v8.1) — data-view 속성으로 노출, 테스트는 testid+view 조합 셀렉터 */
  view?: string;
  /** false로 바뀌면 편집 종료 — 나란히 두 보드의 편집 배타성 (v8.1) */
  active?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** 사진 액션 칩 '사진 바꾸기'·'지우기' (v8.1) — 핸들러가 있을 때만 칩 노출 */
  onRequestReplace?: (key: string) => void;
  onRequestRemove?: (key: string) => void;
  /** 로드 실패 사진 키 통지 (v8.1) — 부모가 저장 전 경고 배너에 사용 */
  onBrokenChange?: (keys: string[]) => void;
  /** 보드 배경색 (v9.0) — 세 템플릿 공통. 없으면 템플릿 기본색 */
  bgColor?: string;
}

// 사진 키 `${sectionId}-${slotIdx}` → 출처 섹션 배지 (v8.1 편집 모드)
function sectionBadge(key: string): { color: string; label: string } | null {
  const m = /^(\d+)-\d+$/.exec(key);
  if (!m) return null;
  const section = SECTIONS.find((s) => s.id === (Number(m[1]) as SectionId));
  if (!section) return null;
  return { color: section.color, label: section.shortTitle ?? section.title.split(' — ')[0] };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const TAP_THRESHOLD = 8; // px — 이 이하 움직임은 탭으로 간주 (스크롤/드래그와 구분)
const ROT_MAX = 30; // 회전 클램프(±도) — 경계 수학이 감당 가능한 범위
const ROT_SNAP = 3; // 이 이하는 0°로 스냅

// 회전 bbox 여백 (v8.0) — 회전한 사진의 모서리가 보드(overflow-hidden) 밖으로 잘리지 않게
// 이동·회전 클램프를 회전 bbox 기준으로 한다. 정규화 좌표는 축별 분모가 달라 aspect 보정 필요
function rotatedPad(it: CollageLayoutItem, hNorm: number, aspect: number): { padX: number; padY: number } {
  const rad = ((it.rot ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = it.w * cos + (hNorm * sin) / aspect;
  const bh = it.w * sin * aspect + hNorm * cos;
  return { padX: Math.max(0, (bw - it.w) / 2), padY: Math.max(0, (bh - hNorm) / 2) };
}

interface DragState {
  key: string;
  mode: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  maxDist: number;
  item: CollageLayoutItem;
  /** rotate 모드 — 항목 중심(px)과 시작 각도 */
  centerX?: number;
  centerY?: number;
  startAngle?: number;
  /** 드래그 시작 시점의 배치 스냅샷 (v9.0) — 스왑 대상 히트테스트는 움직이기 전 좌표로 해야 한다 */
  baseItems: Record<string, CollageLayoutItem>;
  /** resize 모드 — 마지막 프리뷰 스팬. 정수 스팬이 바뀔 때만 프리뷰를 다시 계산 */
  previewSpan?: [number, number];
}

// 문구 스티커 1개 — 글자 크기는 cqi(보드 폭 %)로, canvas 렌더(lib/wallpaper.ts)와 같은 비율식
function StickerView({
  sticker,
  it,
  dark,
}: {
  sticker: CollageSticker;
  it: CollageLayoutItem;
  dark: boolean;
}) {
  const fontSize = `${it.w * 100 * STICKER_FONT_RATIO[sticker.style]}cqi`;
  if (sticker.style === 'chip') {
    return (
      <div
        className="w-full bg-white rounded-md shadow-md px-[0.7em] py-[0.5em] text-center font-semibold text-[#1C1B19] leading-snug"
        style={{ fontSize }}
      >
        {sticker.text}
      </div>
    );
  }
  if (sticker.style === 'outline') {
    return (
      <div
        className="w-full text-center font-extrabold uppercase leading-tight tracking-wide"
        style={{
          fontSize,
          color: '#FFFFFF',
          WebkitTextStroke: '0.07em #1C1B19',
          paintOrder: 'stroke fill',
        }}
      >
        {sticker.text}
      </div>
    );
  }
  return (
    <div
      className="font-script w-full text-center font-bold leading-tight"
      style={{
        fontSize,
        color: sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19'),
        textShadow: dark ? '0 2px 12px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {sticker.text}
    </div>
  );
}

// 통합 콜라주 보드 — 모든 템플릿이 같은 드래그 엔진을 쓴다.
// 보드를 탭하면 편집 모드: 사진·스티커 이동/리사이즈, + 문구 추가, 변경 즉시 저장.
export default function CollageBoard({
  template, items, layout, onLayoutChange, year, onYearChange, aspect = ASPECT,
  view, active, onEditingChange, onRequestReplace, onRequestRemove, onBrokenChange, bgColor,
}: Props) {
  // 배경색은 세 템플릿 공통 — canvas(lib/wallpaper.ts)도 같은 themeFor()를 호출한다 (v9.0 락스텝)
  const theme = themeFor(template, bgColor);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const tapRef = useRef<{ x: number; y: number } | null>(null);
  // pointer-up 이벤트에는 좌표가 없을 수 있어(pointercancel) 마지막 move 좌표를 들고 있는다
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  // 탭한 사진의 구제 액션(맨 뒤로·바로 세우기) — 묻힌 사진을 꺼내는 유일한 동선 (v8.0)
  const [photoAction, setPhotoAction] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; editId?: string }>({ open: false });
  // 로드 실패 사진 (v8.1) — 사진 구성이 바뀌면 리셋, 여전히 깨졌으면 onError가 다시 채운다
  const [brokenKeys, setBrokenKeys] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<CollageLayout>(() => resolveLayout(template, items, layout, aspect));
  const liveRef = useRef(live);
  // 감상 모드 사진 탭 확대 (v8.2)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // 리플로우 정착 모션 (v8.2) — 커밋 직후 300ms 동안 나머지 사진이 새 자리로 미끄러진다
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<number | null>(null);
  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);
  // 반자동 리사이즈 고스트 프리뷰 (v8.5) — 드래그 중 "놓으면 이렇게 정렬돼"를 점선으로 미리 보여준다.
  // 실사진은 pointer-up에만 이동(커밋 경로 불변)
  const [previewLayout, setPreviewLayout] = useState<Record<string, CollageLayoutItem> | null>(null);
  // 드래그 중 자리를 맞바꿀 대상 (v9.0) — 그리드 모드의 이동은 좌표 이동이 아니라 스왑이다
  const [swapTarget, setSwapTarget] = useState<string | null>(null);

  // 편집 상태 전환은 이 함수로만 — 부모(나란히 배타 편집)에 항상 통지 (v8.1)
  function switchEditing(next: boolean) {
    setEditing(next);
    if (!next) setPhotoAction(null);
    onEditingChange?.(next);
  }

  // 다른 쪽 보드가 편집을 가져가면 이쪽은 감상 모드로 (StickerSheet 중복 방지)
  useEffect(() => {
    if (active === false) {
      setEditing(false);
      setPhotoAction(null);
      setSheet({ open: false });
    }
  }, [active]);

  function markBroken(key: string) {
    setBrokenKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev).add(key);
      onBrokenChange?.([...next]);
      return next;
    });
  }

  // 사진 교체·삭제로 구성이 바뀌면 깨짐 판정 초기화 — 새 src가 실패하면 onError가 재판정
  useEffect(() => {
    setBrokenKeys((prev) => {
      if (prev.size === 0) return prev;
      onBrokenChange?.([]);
      return new Set();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.key}:${i.src.slice(0, 40)}`).join(',')]);

  function commitLive(updater: (prev: CollageLayout) => CollageLayout) {
    setLive((prev) => {
      const next = updater(prev);
      liveRef.current = next;
      return next;
    });
  }

  // 템플릿 전환 시에만 편집 종료 — 저장(onLayoutChange)으로 layout 객체가 갱신될 때 풀리면 안 된다
  useEffect(() => {
    switchEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // 외부 layout·사진 구성 변경 동기화 (드래그 중이 아닐 때)
  useEffect(() => {
    if (!dragRef.current) commitLive(() => resolveLayout(template, items, layout, aspect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, aspect, items.map((i) => i.key).join(','), layout]);

  if (items.length === 0) return null;

  const maxZ = Math.max(0, ...Object.values(live.items).map((it) => it.z));
  // 그리드 모드인가 (v9.0) — 자유 배치를 켰거나 백필에 실패한 레거시 배치면 null(구 자유 편집 그대로)
  const gridSpec: GridSpec | null = live.freeform ? null : live.grid ?? null;

  function save(next: CollageLayout) {
    commitLive(() => next);
    onLayoutChange(next);
  }

  // 사용자 상호작용(드래그·리사이즈·회전·스티커·z 조작)에 의한 저장 — edited 표시 (v8.0 reconcile 계약)
  function saveEdited(next: CollageLayout) {
    save({ ...next, edited: true });
  }

  function bringToFront(key: string): CollageLayout {
    const next: CollageLayout = {
      ...live,
      items: { ...live.items, [key]: { ...live.items[key], z: maxZ + 1 } },
    };
    commitLive(() => next);
    return next;
  }

  function onItemPointerDown(e: React.PointerEvent, key: string, mode: 'move' | 'resize' | 'rotate') {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // 회전은 z를 건드리지 않는다 — '맨 뒤로' 보낸 항목이 회전만으로 다시 앞으로 오지 않게
    const next = mode === 'rotate' ? liveRef.current : bringToFront(key);
    const drag: DragState = {
      key, mode, startX: e.clientX, startY: e.clientY, maxDist: 0,
      item: next.items[key],
      baseItems: liveRef.current.items,
    };
    if (mode === 'rotate') {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const it = drag.item;
        const hNorm = it.h ?? it.w * aspect;
        drag.centerX = rect.left + (it.x + it.w / 2) * rect.width;
        drag.centerY = rect.top + (it.y + hNorm / 2) * rect.height;
        drag.startAngle = Math.atan2(e.clientY - drag.centerY, e.clientX - drag.centerX);
      }
    }
    dragRef.current = drag;
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (!drag || !rect) return;
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    drag.maxDist = Math.max(drag.maxDist, Math.abs(dxPx), Math.abs(dyPx));
    const dx = dxPx / rect.width;
    const dy = dyPx / rect.height;
    const it = drag.item;
    const isSticker = drag.key.startsWith('sticker:');
    const hNorm = it.h ?? it.w * aspect;
    let next: CollageLayoutItem;
    if (drag.mode === 'move') {
      // 회전 bbox 기준 클램프 — 회전한 모서리가 보드 밖으로 잘리지 않게 (v8.0)
      const { padX, padY } = rotatedPad(it, hNorm, aspect);
      const loX = Math.min(padX, (1 - it.w) / 2);
      const loY = Math.min(padY, (1 - hNorm) / 2);
      next = {
        ...it,
        x: clamp(it.x + dx, loX, 1 - it.w - loX),
        y: clamp(it.y + dy, loY, 1 - hNorm - loY),
      };
    } else if (drag.mode === 'rotate') {
      const { centerX, centerY, startAngle } = drag;
      if (centerX === undefined || centerY === undefined || startAngle === undefined) return;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      let rot = (it.rot ?? 0) + ((angle - startAngle) * 180) / Math.PI;
      while (rot > 180) rot -= 360;
      while (rot < -180) rot += 360;
      rot = clamp(rot, -ROT_MAX, ROT_MAX);
      if (Math.abs(rot) < ROT_SNAP) rot = 0; // 0° 스냅 — 반듯하게 세우기 쉽게
      const rotated = { ...it, rot: rot || undefined };
      // 회전으로 bbox가 커져 경계를 넘으면 안쪽으로 밀어넣는다
      const { padX, padY } = rotatedPad(rotated, hNorm, aspect);
      const loX = Math.min(padX, (1 - it.w) / 2);
      const loY = Math.min(padY, (1 - hNorm) / 2);
      next = {
        ...rotated,
        x: clamp(it.x, loX, Math.max(loX, 1 - it.w - loX)),
        y: clamp(it.y, loY, Math.max(loY, 1 - hNorm - loY)),
      };
    } else {
      const minW = isSticker ? STICKER_MIN_W : MIN_W;
      // 가로 경계 + 세로 경계(가로형 보드에서 정사각 사진이 아래로 넘치지 않게) 동시 클램프
      const vBound = it.h !== undefined ? (it.w * (1 - it.y)) / it.h : (1 - it.y) / aspect;
      const w = clamp(it.w + dx, minW, Math.min(MAX_W, 1 - it.x, isSticker ? 1 - it.x : vBound));
      // 비정사각(h 지정) 항목은 비율을 유지하며 함께 스케일
      next = { ...it, w, h: it.h !== undefined ? it.h * (w / it.w) : undefined };
    }
    commitLive((prev) => ({ ...prev, items: { ...prev.items, [drag.key]: next } }));

    if (isSticker || !gridSpec) return;

    // 고스트 프리뷰 — 정수 스팬이 바뀔 때만 다시 계산해 프레임당 재계산을 피한다
    if (drag.mode === 'resize') {
      const [tw, th] = snapSpan(next.w, next.h ?? next.w * aspect);
      if (!drag.previewSpan || drag.previewSpan[0] !== tw || drag.previewSpan[1] !== th) {
        drag.previewSpan = [tw, th];
        const nextGrid = resizeInGrid(gridSpec, drag.key, [tw, th]);
        setPreviewLayout(nextGrid ? materialize(nextGrid, template, aspect) : null);
      }
    } else if (drag.mode === 'move') {
      // 이동은 좌표 이동이 아니라 자리 맞바꾸기 — 어디에 놓을지 실시간으로 보여준다
      setSwapTarget(photoAtPoint(e.clientX, e.clientY, drag.baseItems, drag.key));
    }
  }

  /** 픽셀 크기를 스팬 등급(1..4)으로 스냅. 그리드 셀 크기가 기준이라 역산이 필요 없다 (v9.0) */
  function snapSpan(w: number, h: number): [number, number] {
    if (!gridSpec) return [1, 1];
    const sp = spacingFor(template, aspect);
    const m = gridMetrics(gridSpec, template, aspect);
    return [
      clamp(Math.round((w + sp.gutterX) / (m.unitW + sp.gutterX)), 1, SPAN_CAP),
      clamp(Math.round((h + sp.gutterY) / (m.unitH + sp.gutterY)), 1, SPAN_CAP),
    ];
  }

  /** 그리드를 갈아끼우고 좌표를 다시 만든다 — grid와 items의 일관성은 applyGrid가 보장한다 */
  function commitGrid(nextGrid: GridSpec) {
    setSettling(true);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), 300);
    saveEdited(applyGrid({ ...liveRef.current, grid: nextGrid }, template, aspect));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setPreviewLayout(null);
    setSwapTarget(null);
    const isSticker = drag.key.startsWith('sticker:');
    const moved = drag.maxDist >= TAP_THRESHOLD;

    // ── 그리드 모드 (v9.0) ──
    // 이동=스왑, 리사이즈=스팬 스냅. 좌표를 자유롭게 바꾸는 경로가 없으므로 그리드는 깨질 수 없다 —
    // v8.x에서 "한 번 자유롭게 옮겼더니 그 뒤로 자동 정렬이 영영 안 되던" 지점이 구조적으로 사라졌다.
    if (gridSpec && !isSticker && moved) {
      if (drag.mode === 'resize') {
        const finalIt = liveRef.current.items[drag.key];
        const span = snapSpan(finalIt.w, finalIt.h ?? finalIt.w * aspect);
        // 실패해도 원래 그리드를 다시 적용하면 제자리로 미끄러진다(스냅백)
        commitGrid(resizeInGrid(gridSpec, drag.key, span) ?? gridSpec);
        return;
      }
      if (drag.mode === 'move') {
        const p = lastPointer.current;
        const hit = p ? photoAtPoint(p.x, p.y, drag.baseItems, drag.key) : null;
        // 빈 곳에 놓으면 제자리로 — 그리드 모드에 "아무 데나 두기"는 없다
        commitGrid(hit ? swapInGrid(gridSpec, drag.key, hit) : gridSpec);
        return;
      }
    }

    saveEdited(liveRef.current);
    if (!moved && drag.mode === 'move') {
      if (isSticker) {
        // 스티커를 움직이지 않고 탭하면 수정 시트 열기
        setSheet({ open: true, editId: drag.key.slice('sticker:'.length) });
      } else {
        // 사진 탭 → 액션 칩 (크게·작게·맨 뒤로·교체·삭제)
        setPhotoAction((cur) => (cur === drag.key ? null : drag.key));
      }
    }
  }

  /** 탭 액션 '크게'·'작게' (v9.0) — 핸들 정밀 드래그 없이 스팬 등급을 한 단계씩 바꾼다.
   *  등급 점프(1→2는 폭 2배)를 손가락으로 맞추기 어려운 모바일의 주 동선 */
  function bumpSpan(key: string, delta: number) {
    if (!gridSpec) return;
    const cell = layoutCells(gridSpec).cells.find((c) => c.key === key);
    if (!cell) return;
    const next = resizeInGrid(gridSpec, key, [clamp(cell.sc + delta, 1, SPAN_CAP), cell.sr]);
    if (next) commitGrid(next);
  }

  /** 자유 배치 토글 — 그리드를 벗어나 원하는 곳에 두고 회전까지 하고 싶을 때의 명시적 탈출구.
   *  되돌리면 지금 장수의 표준 그리드로 다시 정렬된다 */
  function toggleFreeform() {
    const prev = liveRef.current;
    if (prev.freeform) {
      const g = chooseGrid(template, items, aspect);
      if (g) saveEdited(applyGrid({ ...prev, grid: g, freeform: false }, template, aspect));
      return;
    }
    saveEdited({ ...prev, freeform: true });
  }

  // 보기 모드에서 보드 탭 → 편집 진입 (8px 임계값으로 페이지 스크롤과 구분)
  function onBoardPointerDown(e: React.PointerEvent) {
    if (editing) return;
    tapRef.current = { x: e.clientX, y: e.clientY };
  }

  // 탭 지점의 최상단 사진 키 (v8.2 라이트박스 히트테스트) — img가 pointer-events-none이라
  // DOM 타깃 대신 좌표로 판정한다. 회전 항목은 픽셀 공간에서 역회전 후 rect 검사(rotatedPad와 같은 삼각법)
  function photoAtPoint(
    clientX: number,
    clientY: number,
    source: Record<string, CollageLayoutItem> = live.items,
    excludeKey?: string
  ): string | null {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const photos = Object.entries(source)
      .filter(([k]) => !k.startsWith('sticker:') && k !== excludeKey && !brokenKeys.has(k))
      .sort(([, a], [, b]) => b.z - a.z);
    for (const [key, it] of photos) {
      const hNorm = it.h ?? it.w * aspect;
      let lx = px - (it.x + it.w / 2);
      let ly = py - (it.y + hNorm / 2);
      if (it.rot) {
        // 정규화 좌표는 비등방(보드 w≠h) — 픽셀 공간으로 환산해 회전해야 정확하다
        const rad = (-it.rot * Math.PI) / 180;
        const pxU = lx * rect.width;
        const pyU = ly * rect.height;
        lx = (pxU * Math.cos(rad) - pyU * Math.sin(rad)) / rect.width;
        ly = (pxU * Math.sin(rad) + pyU * Math.cos(rad)) / rect.height;
      }
      if (Math.abs(lx) <= it.w / 2 && Math.abs(ly) <= hNorm / 2) return key;
    }
    return null;
  }

  function onBoardPointerUp(e: React.PointerEvent) {
    const tap = tapRef.current;
    tapRef.current = null;
    if (editing || !tap) return;
    if (Math.abs(e.clientX - tap.x) < TAP_THRESHOLD && Math.abs(e.clientY - tap.y) < TAP_THRESHOLD) {
      // v8.2 — 사진을 탭하면 크게 보기, 배경(여백)을 탭하면 편집 진입(기존 계약 유지)
      const hit = photoAtPoint(e.clientX, e.clientY);
      const src = hit ? items.find((i) => i.key === hit)?.src : undefined;
      if (src) {
        setLightboxSrc(src);
        return;
      }
      switchEditing(true);
    }
  }

  function resetLayout() {
    // 시드는 edited:false — 이후 사진이 추가되면 자동 배치가 신선하게 다시 깔린다 (v8.0)
    setPhotoAction(null);
    save(seedLayout(template, items, aspect));
  }

  function sendToBack(key: string) {
    const prev = liveRef.current;
    const minZ = Math.min(...Object.values(prev.items).map((it) => it.z));
    saveEdited({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], z: minZ - 1 } } });
    setPhotoAction(null);
  }

  function straighten(key: string) {
    const prev = liveRef.current;
    saveEdited({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], rot: undefined } } });
    setPhotoAction(null);
  }

  function handleStickerConfirm(data: { text: string; style: CollageSticker['style']; color?: string }) {
    const prev = liveRef.current;
    if (sheet.editId) {
      const sticker: CollageSticker = { ...prev.stickers![sheet.editId], ...data };
      saveEdited({ ...prev, stickers: { ...prev.stickers, [sheet.editId]: sticker } });
    } else {
      const id = `s${Date.now()}`;
      saveEdited({
        items: { ...prev.items, [stickerKey(id)]: newStickerLayoutItem(maxZ, aspect) },
        stickers: { ...prev.stickers, [id]: { id, ...data } },
      });
    }
    setSheet({ open: false });
  }

  function handleStickerDelete(id: string) {
    const prev = liveRef.current;
    const stickers = { ...prev.stickers };
    delete stickers[id];
    const nextItems = { ...prev.items };
    delete nextItems[stickerKey(id)];
    saveEdited({ items: nextItems, stickers });
    setSheet({ open: false });
  }

  const titleTokens = titleTokensFor(template, aspect);
  const isMatte = theme.frame === 'matte';
  // 흰 배경에서는 흰 매트 카드가 배경에 녹는다 — 그때만 실선 테두리 (canvas drawMattePhoto와 락스텝)
  const matteOnWhite = isMatte && theme.bg.toUpperCase() === '#FFFFFF';

  return (
    <div>
      {/* 사용법 안내 (v9.0) — 보드 아래 회색 잔글씨는 "안 보인다"는 오너 피드백.
          보드 바로 위 알약으로 올리고 대비·크기를 키워 여백 텍스트가 아니라 UI로 읽히게 했다.
          PC 뷰는 보드가 넓어 하단 중앙이 시야 밖이라 상단 앵커가 특히 유효하다 */}
      <p
        data-testid="board-hint"
        // lg에서 세로 예산을 아낀다 — PC 무스크롤(V87-4d)과 보드 폭 ≥1000px(V87-4e)이 서로 반대
        // 방향이라, 예산을 더 키우는 대신 크롬을 줄이는 쪽이 보드 폭에 유리하다
        className="mx-auto mb-2 lg:mb-1 w-fit max-w-full rounded-full bg-[#F1EFEA] px-3.5 py-1.5 lg:py-1 text-caption text-[#4A463F] text-center"
      >
        {editing
          ? gridSpec
            ? '사진을 끌어 자리를 바꾸고, 탭하면 크게·작게 할 수 있어. 빈틈은 알아서 채워져.'
            : '자유 배치야 — 원하는 곳에 두고 ⤡ 크기·↻ 각도까지 바꿀 수 있어.'
          : '사진을 탭하면 크게 보여. 빈 곳을 탭하면 직접 꾸밀 수 있어.'}
      </p>
      <div
        ref={boardRef}
        data-testid="collage-board"
        data-view={view}
        className="relative w-full mx-auto rounded-3xl overflow-hidden select-none"
        style={{
          aspectRatio: String(aspect),
          // 배경색은 사용자가 고른 단색 (v9.0) — canvas renderBoardLayout과 같은 themeFor() 결과
          background: theme.bg,
          border: theme.dark ? 'none' : '1px solid #E5E3DF',
          containerType: 'size',
          // 높이 예산 (v8.2) — 저장 버튼이 sticky 바로 내려가 "보드+버튼 한 화면" 제약이 풀렸다.
          // 예산은 부모가 --board-reserve로 주입(기본 19rem 폴백), 가로형도 같은 식으로 통일
          // (16:9는 대부분 min()의 100%로 수렴하고, 낮은 창에서만 높이에 맞춰 줄어든다)
          maxWidth: `min(100%, calc((100dvh - var(--board-reserve, 19rem)) * ${aspect}))`,
          touchAction: editing ? 'none' : 'auto',
        }}
        onPointerDown={onBoardPointerDown}
        onPointerUp={editing ? onPointerUp : onBoardPointerUp}
        onPointerMove={onPointerMove}
        onPointerCancel={onPointerUp}
      >
        {/* 상단 타이틀 밴드 — 전 템플릿 공통. 수치는 lib/collageTokens가 단일 소스라
            canvas(lib/wallpaper.ts)의 titleTokensFor와 자동 락스텝 (v9.0) */}
        <div
          className="absolute inset-x-0 top-0 flex flex-col items-center text-center pointer-events-none z-30"
          style={{ paddingTop: `${titleTokens.padTop * 100}cqmin` }}
        >
          <p
            className="font-semibold tracking-[0.3em] uppercase"
            style={{ color: theme.labelInk, fontSize: `${titleTokens.labelRatio * 100}cqmin` }}
          >
            Vision Board
          </p>
          <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <EditableYear
              year={year}
              onYearChange={onYearChange}
              className="font-script font-bold tracking-widest"
              style={{ color: theme.titleInk, fontSize: `${titleTokens.yearRatio * 100}cqmin` }}
            />
          </div>
        </div>

        {/* 사진 + 스티커 — z 순서대로 */}
        {Object.entries(live.items)
          .sort(([, a], [, b]) => a.z - b.z)
          .map(([key, it]) => {
            const isSticker = key.startsWith('sticker:');
            const sticker = isSticker ? live.stickers?.[key.slice('sticker:'.length)] : undefined;
            const src = isSticker ? undefined : items.find((i) => i.key === key)?.src;
            if (!sticker && !src) return null;
            return (
              <div
                key={key}
                className={`absolute ${editing ? 'cursor-move' : !isSticker ? 'cursor-zoom-in' : ''} ${settling ? 'collage-item-settle' : ''}`}
                style={{
                  left: `${it.x * 100}%`,
                  top: `${it.y * 100}%`,
                  width: `${it.w * 100}%`,
                  height: it.h !== undefined ? `${it.h * 100}%` : undefined,
                  zIndex: it.z,
                  transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
                  // 스티커는 canvas 렌더(drawSticker: top-center 피벗)와 회전 원점을 맞춘다 (v8.0 락스텝)
                  transformOrigin: isSticker ? 'top center' : 'center',
                  touchAction: editing ? 'none' : 'auto',
                }}
                onPointerDown={(e) => onItemPointerDown(e, key, 'move')}
              >
                {sticker ? (
                  <StickerView sticker={sticker} it={it} dark={theme.dark} />
                ) : (() => {
                  const badge = sectionBadge(key);
                  return (
                    // v7.6 프레임리스 — 흰 폴라로이드 프레임 제거, 전 템플릿 사진만 + 라운드·그림자.
                    // 편집 모드의 링은 출처 섹션 색 2px — 어느 칸의 사진인지 보드 위에서 바로 보인다 (v8.1)
                    <div
                      className={`w-full h-full ${isMatte ? 'rounded-lg bg-white' : 'rounded-xl'} overflow-hidden ${
                        // 어두운 배경에서는 그림자가 안 보인다 — 밝은 링으로 바꿔야 사진 경계가 산다 (v9.0)
                        theme.dark ? 'shadow-none ring-1 ring-white/15' : 'shadow-sm'
                      } ${matteOnWhite ? 'ring-1 ring-[#E5E3DF]' : ''} ${
                        editing && !badge ? (theme.dark ? 'ring-1 ring-white/40' : 'ring-1 ring-black/15') : ''
                      }`}
                      style={{
                        ...(editing && badge ? { boxShadow: `0 0 0 2px ${badge.color}` } : {}),
                        // 매트 갤러리 — 셀 짧은 변 기준 매트 여백.
                        // ⚠️ cqmin(보드 기준)이나 %(컨테이닝 블록 폭 기준)로는 canvas와 어긋난다.
                        // canvas는 min(셀폭px, 셀높이px)×비율이므로, 보드 폭 대비 cqw로 환산해야 일치한다
                        ...(isMatte
                          ? {
                              padding: `${
                                Math.min(it.w, (it.h ?? it.w * aspect) / aspect) * MATTE_MAT_RATIO * 100
                              }cqw`,
                            }
                          : {}),
                      }}
                    >
                      {brokenKeys.has(key) ? (
                        <div
                          data-broken-photo={key}
                          className={`w-full bg-[#EDECEA] flex flex-col items-center justify-center text-center px-[1cqmin] ${it.h !== undefined ? 'h-full' : 'aspect-square'}`}
                        >
                          <span aria-hidden="true" style={{ fontSize: '5cqmin' }}>⚠️</span>
                          <span className="text-[#6E6962] leading-tight" style={{ fontSize: '2.4cqmin' }}>
                            사진을 못 불러왔어
                          </span>
                        </div>
                      ) : (
                        <img
                          // displaySrc (v8.7) — 캔버스 내보내기와 동일한 URL·동일한 CORS 모드.
                          // 캐시 엔트리를 공유해야 저장 시 재로드가 없고, onError가 내보내기 실패와
                          // 같은 조건에서 발화해 ⚠️ 타일·저장 경고가 비로소 진실해진다.
                          src={displaySrc(src ?? '')}
                          alt=""
                          draggable={false}
                          // 매트 갤러리만 무크롭(contain) — 세로 스크린샷이 잘려 글자가 안 보이던 문제의
                          // 완전 해소책이자 이 템플릿의 컨셉. 나머지는 cover (canvas drawCover와 락스텝)
                          className={`w-full ${isMatte ? 'object-contain' : 'object-cover'} pointer-events-none ${
                            it.h !== undefined ? 'h-full' : 'aspect-square'
                          }`}
                          onError={() => markBroken(key)}
                        />
                      )}
                      {/* 출처 섹션 칩 (v8.1) — 편집 모드에서만, 좌상단 */}
                      {editing && badge && (
                        <span
                          className="absolute top-0 left-0 z-10 rounded-tl-xl rounded-br-md px-[1.6cqmin] py-[0.6cqmin] font-semibold text-white pointer-events-none"
                          style={{ backgroundColor: badge.color, fontSize: '2.2cqmin' }}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {editing && (
                  <div
                    onPointerDown={(e) => onItemPointerDown(e, key, 'resize')}
                    className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-nwse-resize z-10"
                    aria-label="크기 조절"
                  >
                    <span className="text-micro text-[#6E6962] leading-none">⤡</span>
                  </div>
                )}
                {/* 회전은 자유 배치·스티커에서만 (v9.0) — 회전 bbox가 이웃 셀을 침범해
                    "빈틈 0"과 논리적으로 모순이고, 핸들 난립도 함께 해소된다 */}
                {editing && (!gridSpec || isSticker) && (
                  <div
                    onPointerDown={(e) => onItemPointerDown(e, key, 'rotate')}
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-grab z-10"
                    aria-label="회전"
                  >
                    <span className="text-micro text-[#6E6962] leading-none">↻</span>
                  </div>
                )}
                {/* 스왑 대상 하이라이트 — 여기에 놓으면 자리가 바뀐다 */}
                {swapTarget === key && (
                  <div
                    data-testid="swap-target"
                    aria-hidden="true"
                    className="absolute -inset-1 rounded-xl border-2 border-dashed border-[#6366F1] pointer-events-none z-20"
                  />
                )}
                {editing && isSticker && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => handleStickerDelete(key.slice('sticker:'.length))}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/60 text-white text-caption flex items-center justify-center z-10"
                    aria-label="스티커 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

        {/* 고스트 프리뷰 (v8.5) — 놓으면 정렬될 자리를 점선으로. 실사진은 pointer-up에 이동 */}
        {previewLayout && (
          <div
            data-testid="reflow-preview"
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-40"
          >
            {Object.entries(previewLayout).map(([k, it]) => (
              <div
                key={k}
                className="absolute rounded-xl border-2 border-dashed"
                style={{
                  left: `${it.x * 100}%`,
                  top: `${it.y * 100}%`,
                  width: `${it.w * 100}%`,
                  height: `${(it.h ?? it.w * aspect) * 100}%`,
                  borderColor: theme.dark ? 'rgba(255,255,255,0.55)' : 'rgba(28,27,25,0.35)',
                }}
              />
            ))}
          </div>
        )}

        {/* 상시 어포던스 칩 (v6.17) → 실제 버튼 (v8.2) — 사진 탭이 확대로 바뀌어도
            어느 템플릿에서든 결정적인 편집 진입점이 하나는 남는다 */}
        {!editing && (
          <button
            onClick={() => switchEditing(true)}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            className="absolute top-[2.5cqmin] right-[2.5cqmin] z-50 rounded-full bg-black/45 text-white font-medium px-[3cqmin] py-[1.5cqmin] backdrop-blur-sm active:opacity-70"
            style={{ fontSize: '2.8cqmin' }}
          >
            ✎ 탭해서 편집
          </button>
        )}

        {/* 편집 툴바 — 보드 상단 플로팅 */}
        {editing && (
          <div
            className="absolute top-2 inset-x-2 flex items-center justify-between z-50"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1.5">
              <button
                onClick={resetLayout}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
              >
                기본 배치로
              </button>
              <button
                onClick={() => setSheet({ open: true })}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
              >
                + 문구
              </button>
              {/* 자유 배치 토글 (v9.0) — 그리드를 벗어나 아무 데나 두고 회전까지 하고 싶을 때의
                  명시적 탈출구. 자동 정렬이 조용히 죽는 대신 사용자가 켜고 끈다 */}
              <button
                onClick={toggleFreeform}
                aria-pressed={!gridSpec}
                className={`px-3 py-1.5 rounded-full text-caption font-medium active:opacity-70 ${
                  gridSpec ? 'bg-black/60 text-white' : 'bg-white text-[#1C1B19] shadow'
                }`}
              >
                자유 배치
              </button>
            </div>
            <button
              onClick={() => switchEditing(false)}
              className="px-4 py-1.5 rounded-full bg-white text-[#1C1B19] text-caption font-bold shadow active:opacity-70"
            >
              완료
            </button>
          </div>
        )}

        {/* 사진 구제 액션 (v8.0) — 뒤로 보내기·세우기에 더해 교체·삭제 (v8.1, 백로그 '사진 개별 삭제' 흡수) */}
        {editing && photoAction && live.items[photoAction] && (
          <div
            className="absolute top-12 inset-x-2 flex flex-wrap items-center gap-1.5 z-50"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {onRequestReplace && (
              <button
                onClick={() => { onRequestReplace(photoAction); setPhotoAction(null); }}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                aria-label="사진 바꾸기"
              >
                {brokenKeys.has(photoAction) ? '⚠️ 사진 바꾸기' : '사진 바꾸기'}
              </button>
            )}
            {onRequestRemove && (
              <button
                onClick={() => { onRequestRemove(photoAction); setPhotoAction(null); }}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                aria-label="사진 지우기"
              >
                지우기
              </button>
            )}
            {/* 크게·작게 (v9.0) — 핸들 정밀 드래그 없이 스팬 등급을 한 단계씩. 모바일 주 동선 */}
            {gridSpec && (
              <>
                <button
                  onClick={() => bumpSpan(photoAction, 1)}
                  className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                  aria-label="크게"
                >
                  크게
                </button>
                <button
                  onClick={() => bumpSpan(photoAction, -1)}
                  className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                  aria-label="작게"
                >
                  작게
                </button>
              </>
            )}
            {!gridSpec && (
              <button
                onClick={() => sendToBack(photoAction)}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                aria-label="맨 뒤로"
              >
                맨 뒤로
              </button>
            )}
            {!!live.items[photoAction].rot && (
              <button
                onClick={() => straighten(photoAction)}
                className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
                aria-label="바로 세우기"
              >
                바로 세우기
              </button>
            )}
            <button
              onClick={() => setPhotoAction(null)}
              className="px-3 py-1.5 rounded-full bg-black/40 text-white text-caption active:opacity-70"
              aria-label="사진 액션 닫기"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {sheet.open && (
        <StickerSheet
          initial={sheet.editId ? live.stickers?.[sheet.editId] : undefined}
          onConfirm={handleStickerConfirm}
          onDelete={sheet.editId ? () => handleStickerDelete(sheet.editId!) : undefined}
          onClose={() => setSheet({ open: false })}
        />
      )}

      {/* 사진 확대 (v8.2) — 보드에선 크롭돼 보이므로 확대는 원본 비율 전체 */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} fit="contain" />
    </div>
  );
}
