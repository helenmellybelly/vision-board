'use client';

import { useEffect, useRef, useState } from 'react';
import { CollageLayout, CollageLayoutItem } from '@/lib/types';
import EditableYear from './EditableYear';

export interface CollageItem {
  key: string; // `${sectionId}-${slotIdx}` — 사진 교체·삭제에도 안정적
  src: string;
}

interface Props {
  items: CollageItem[];
  layout: CollageLayout | undefined;
  onLayoutChange: (layout: CollageLayout) => void;
  editing: boolean;
  year: string;
  onYearChange: (year: string) => void;
}

// 4:5 보드 — 정사각 사진이라 높이 비율은 w × ASPECT
const ASPECT = 4 / 5;
const MIN_W = 0.12;
const MAX_W = 0.7;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// 기본 배치 — 인덱스 기반 결정적 산포 (4열, 살짝 지터)
const JITTERS: [number, number][] = [
  [0.01, 0.012], [-0.012, 0.006], [0.008, -0.01], [-0.006, 0.014],
  [0.014, -0.006], [-0.01, -0.012], [0.006, 0.01], [-0.014, 0.008],
];

export function defaultLayout(items: CollageItem[]): CollageLayout {
  const result: Record<string, CollageLayoutItem> = {};
  items.forEach((item, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const [jx, jy] = JITTERS[i % JITTERS.length];
    result[item.key] = {
      x: clamp(0.03 + col * 0.24 + jx, 0, 1 - 0.22),
      y: clamp(0.05 + row * 0.2 + jy, 0, 1 - 0.22 * ASPECT),
      w: 0.22,
      z: i + 1,
    };
  });
  return { items: result };
}

// 저장된 배치에 새 사진을 더하고, 사라진 사진 키는 정리(prune)
function reconcile(items: CollageItem[], layout: CollageLayout | undefined): CollageLayout {
  if (!layout) return defaultLayout(items);
  const fallback = defaultLayout(items);
  const result: Record<string, CollageLayoutItem> = {};
  for (const item of items) {
    result[item.key] = layout.items[item.key] ?? fallback.items[item.key];
  }
  return { items: result };
}

interface DragState {
  key: string;
  mode: 'move' | 'resize';
  startX: number; // pointer px
  startY: number;
  item: CollageLayoutItem;
}

// 커스텀 배치 보드 — 라이브러리 없이 Pointer Events로 드래그 이동 + 우하단 핸들 리사이즈
export default function CollageCustom({ items, layout, onLayoutChange, editing, year, onYearChange }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [live, setLive] = useState<CollageLayout>(() => reconcile(items, layout));
  // pointerup 시점에 마지막 move까지 반영된 상태를 확실히 저장하기 위한 미러
  const liveRef = useRef(live);

  function commitLive(updater: (prev: CollageLayout) => CollageLayout) {
    setLive((prev) => {
      const next = updater(prev);
      liveRef.current = next;
      return next;
    });
  }

  // 외부 layout/사진 구성 변경 동기화 (편집 중이 아닐 때)
  useEffect(() => {
    if (!dragRef.current) commitLive(() => reconcile(items, layout));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.key).join(','), layout]);

  if (items.length === 0) return null;

  const maxZ = Math.max(0, ...Object.values(live.items).map((it) => it.z));

  function bringToFront(key: string): CollageLayout {
    const next = {
      items: { ...live.items, [key]: { ...live.items[key], z: maxZ + 1 } },
    };
    commitLive(() => next);
    return next;
  }

  function onPointerDown(e: React.PointerEvent, key: string, mode: 'move' | 'resize') {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const next = bringToFront(key);
    dragRef.current = { key, mode, startX: e.clientX, startY: e.clientY, item: next.items[key] };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const it = drag.item;
    let next: CollageLayoutItem;
    if (drag.mode === 'move') {
      next = {
        ...it,
        x: clamp(it.x + dx, 0, 1 - it.w),
        y: clamp(it.y + dy, 0, 1 - it.w * ASPECT),
      };
    } else {
      const w = clamp(it.w + dx, MIN_W, Math.min(MAX_W, 1 - it.x, (1 - it.y) / ASPECT));
      next = { ...it, w };
    }
    commitLive((prev) => ({ items: { ...prev.items, [drag.key]: next } }));
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    onLayoutChange(liveRef.current);
  }

  return (
    <div
      ref={boardRef}
      className="relative w-full rounded-3xl overflow-hidden select-none"
      style={{ aspectRatio: '4 / 5', backgroundColor: '#2D2B29', touchAction: editing ? 'none' : 'auto' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 중앙 타이틀 — 사진 뒤에 깔리는 배경 레이어 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <p className="text-micro font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase">Vision Board</p>
        <div className="pointer-events-auto">
          <EditableYear
            year={year}
            onYearChange={onYearChange}
            className="font-display text-4xl md:text-5xl font-bold text-white tracking-widest"
          />
        </div>
      </div>

      {Object.entries(live.items)
        .sort(([, a], [, b]) => a.z - b.z)
        .map(([key, it]) => {
          const src = items.find((i) => i.key === key)?.src;
          if (!src) return null;
          return (
            <div
              key={key}
              className={`absolute bg-white p-1 pb-3 rounded-sm shadow-lg ${editing ? 'cursor-move ring-1 ring-white/30' : ''}`}
              style={{
                left: `${it.x * 100}%`,
                top: `${it.y * 100}%`,
                width: `${it.w * 100}%`,
                zIndex: it.z,
                touchAction: editing ? 'none' : 'auto',
              }}
              onPointerDown={(e) => onPointerDown(e, key, 'move')}
            >
              <img src={src} alt="" draggable={false} className="w-full aspect-square object-cover pointer-events-none" />
              {editing && (
                <div
                  onPointerDown={(e) => onPointerDown(e, key, 'resize')}
                  className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-nwse-resize"
                  aria-label="크기 조절"
                >
                  <span className="text-micro text-[#6E6962] leading-none">⤡</span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
