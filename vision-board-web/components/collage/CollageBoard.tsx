'use client';

import { useEffect, useRef, useState } from 'react';
import { CollageLayout, CollageLayoutItem, CollageSticker, CollageTemplate } from '@/lib/types';
import {
  ASPECT,
  COLLAGE_THEMES,
  CollageItem,
  MAX_W,
  MIN_W,
  STICKER_FONT_RATIO,
  STICKER_MIN_W,
  hasTopReserve,
  isLandscape,
  newStickerLayoutItem,
  resolveLayout,
  seedLayout,
  stickerKey,
} from '@/lib/collageTemplates';
import EditableYear from './EditableYear';
import StickerSheet from './StickerSheet';

interface Props {
  template: CollageTemplate;
  items: CollageItem[];
  layout: CollageLayout | undefined;
  onLayoutChange: (layout: CollageLayout) => void;
  year: string;
  onYearChange: (year: string) => void;
  /** 캔버스 비율(w/h) — 보드 4:5, 폰/PC는 선택한 기기 사이즈 비율. 좌표 공간과 시드가 비율별로 다르다 (v6.19) */
  aspect?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const TAP_THRESHOLD = 8; // px — 이 이하 움직임은 탭으로 간주 (스크롤/드래그와 구분)

interface DragState {
  key: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  maxDist: number;
  item: CollageLayoutItem;
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
export default function CollageBoard({ template, items, layout, onLayoutChange, year, onYearChange, aspect = ASPECT }: Props) {
  const theme = COLLAGE_THEMES[template];
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const tapRef = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [live, setLive] = useState<CollageLayout>(() => resolveLayout(template, items, layout, aspect));
  const liveRef = useRef(live);

  function commitLive(updater: (prev: CollageLayout) => CollageLayout) {
    setLive((prev) => {
      const next = updater(prev);
      liveRef.current = next;
      return next;
    });
  }

  // 템플릿 전환 시에만 편집 종료 — 저장(onLayoutChange)으로 layout 객체가 갱신될 때 풀리면 안 된다
  useEffect(() => {
    setEditing(false);
  }, [template]);

  // 외부 layout·사진 구성 변경 동기화 (드래그 중이 아닐 때)
  useEffect(() => {
    if (!dragRef.current) commitLive(() => resolveLayout(template, items, layout, aspect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, aspect, items.map((i) => i.key).join(','), layout]);

  if (items.length === 0) return null;

  const maxZ = Math.max(0, ...Object.values(live.items).map((it) => it.z));

  function save(next: CollageLayout) {
    commitLive(() => next);
    onLayoutChange(next);
  }

  function bringToFront(key: string): CollageLayout {
    const next: CollageLayout = {
      ...live,
      items: { ...live.items, [key]: { ...live.items[key], z: maxZ + 1 } },
    };
    commitLive(() => next);
    return next;
  }

  function onItemPointerDown(e: React.PointerEvent, key: string, mode: 'move' | 'resize') {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const next = bringToFront(key);
    dragRef.current = { key, mode, startX: e.clientX, startY: e.clientY, maxDist: 0, item: next.items[key] };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
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
      next = {
        ...it,
        x: clamp(it.x + dx, 0, 1 - it.w),
        y: clamp(it.y + dy, 0, 1 - hNorm),
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
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    onLayoutChange(liveRef.current);
    // 스티커를 움직이지 않고 탭하면 수정 시트 열기
    if (drag.maxDist < TAP_THRESHOLD && drag.key.startsWith('sticker:') && drag.mode === 'move') {
      setSheet({ open: true, editId: drag.key.slice('sticker:'.length) });
    }
  }

  // 보기 모드에서 보드 탭 → 편집 진입 (8px 임계값으로 페이지 스크롤과 구분)
  function onBoardPointerDown(e: React.PointerEvent) {
    if (editing) return;
    tapRef.current = { x: e.clientX, y: e.clientY };
  }
  function onBoardPointerUp(e: React.PointerEvent) {
    const tap = tapRef.current;
    tapRef.current = null;
    if (editing || !tap) return;
    if (Math.abs(e.clientX - tap.x) < TAP_THRESHOLD && Math.abs(e.clientY - tap.y) < TAP_THRESHOLD) {
      setEditing(true);
    }
  }

  function resetLayout() {
    save(seedLayout(template, items, aspect));
  }

  function handleStickerConfirm(data: { text: string; style: CollageSticker['style']; color?: string }) {
    const prev = liveRef.current;
    if (sheet.editId) {
      const sticker: CollageSticker = { ...prev.stickers![sheet.editId], ...data };
      save({ ...prev, stickers: { ...prev.stickers, [sheet.editId]: sticker } });
    } else {
      const id = `s${Date.now()}`;
      save({
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
    save({ items: nextItems, stickers });
    setSheet({ open: false });
  }

  const titleColor = theme.dark ? '#FFFFFF' : '#1C1B19';
  const labelColor = theme.dark ? '#C4C2BE' : '#6E6962';

  return (
    <div>
      <div
        ref={boardRef}
        data-testid="collage-board"
        className="relative w-full mx-auto rounded-3xl overflow-hidden select-none"
        style={{
          aspectRatio: String(aspect),
          backgroundColor: theme.bg,
          border: theme.dark ? 'none' : '1px solid #E5E3DF',
          containerType: 'size',
          // 보드 + 버튼이 한 화면에 들어오게 — 세로가 짧은 기기에선 보드 폭이 줄어든다.
          // 세로형은 비율에 비례해 좁게, 가로형(PC)은 전폭
          maxWidth: isLandscape(aspect)
            ? '100%'
            : `min(100%, calc((100dvh - 19rem) * ${aspect}))`,
          touchAction: editing ? 'none' : 'auto',
        }}
        onPointerDown={onBoardPointerDown}
        onPointerUp={editing ? onPointerUp : onBoardPointerUp}
        onPointerMove={onPointerMove}
        onPointerCancel={onPointerUp}
      >
        {/* 상단 타이틀 밴드 — mosaic·minimal */}
        {theme.titlePos === 'top' && (
          <div
            className="absolute inset-x-0 top-0 flex flex-col items-center text-center pointer-events-none z-30"
            // 세로로 긴 화면은 상단 시계·위젯 영역(~15%) 아래로 — lib/wallpaper.ts padCq와 동일 수치
            style={{ paddingTop: hasTopReserve(aspect) ? '32cqmin' : '4cqmin' }}
          >
            <p className="font-semibold tracking-[0.3em] uppercase" style={{ color: labelColor, fontSize: '2.6cqmin' }}>
              Vision Board
            </p>
            <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
              <EditableYear
                year={year}
                onYearChange={onYearChange}
                className="font-script font-bold tracking-widest"
                style={{ color: titleColor, fontSize: '7cqmin' }}
              />
            </div>
          </div>
        )}

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
                className={`absolute ${editing ? 'cursor-move' : ''}`}
                style={{
                  left: `${it.x * 100}%`,
                  top: `${it.y * 100}%`,
                  width: `${it.w * 100}%`,
                  height: it.h !== undefined ? `${it.h * 100}%` : undefined,
                  zIndex: it.z,
                  transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
                  touchAction: editing ? 'none' : 'auto',
                }}
                onPointerDown={(e) => onItemPointerDown(e, key, 'move')}
              >
                {sticker ? (
                  <StickerView sticker={sticker} it={it} dark={theme.dark} />
                ) : theme.frame === 'polaroid' ? (
                  <div className={`bg-white p-1 pb-3 rounded-sm shadow-lg ${editing ? 'ring-1 ring-white/30' : ''}`}>
                    <img src={src} alt="" draggable={false} className="w-full aspect-square object-cover pointer-events-none" />
                  </div>
                ) : (
                  <div className={`w-full h-full rounded-xl overflow-hidden shadow-sm ${editing ? 'ring-1 ring-black/15' : ''}`}>
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className={`w-full object-cover pointer-events-none ${it.h !== undefined ? 'h-full' : 'aspect-square'}`}
                    />
                  </div>
                )}
                {editing && (
                  <div
                    onPointerDown={(e) => onItemPointerDown(e, key, 'resize')}
                    className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-nwse-resize z-10"
                    aria-label="크기 조절"
                  >
                    <span className="text-micro text-[#6E6962] leading-none">⤡</span>
                  </div>
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

        {/* 중앙 연도 카드 — polaroid. 사진 위에 항상 보이는 보드의 시그니처 */}
        {theme.titlePos === 'center' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div
              className="rounded-xl px-[6cqmin] py-[4cqmin] text-center border border-white/10 shadow-xl"
              style={{ backgroundColor: '#3A3734' }}
            >
              <p className="font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase" style={{ fontSize: '2.6cqmin' }}>
                Vision Board
              </p>
              <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
                <EditableYear
                  year={year}
                  onYearChange={onYearChange}
                  className="font-script font-bold text-white tracking-widest"
                  style={{ fontSize: '9cqmin' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 상시 어포던스 칩 — 편집 가능함을 보드 위에서 바로 알린다 (v6.17 발견성 피드백) */}
        {!editing && (
          <div
            className="absolute top-[2.5cqmin] right-[2.5cqmin] z-50 pointer-events-none rounded-full bg-black/45 text-white font-medium px-[3cqmin] py-[1.5cqmin] backdrop-blur-sm"
            style={{ fontSize: '2.8cqmin' }}
            aria-hidden="true"
          >
            ✎ 탭해서 편집
          </div>
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
            </div>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 rounded-full bg-white text-[#1C1B19] text-caption font-bold shadow active:opacity-70"
            >
              완료
            </button>
          </div>
        )}
      </div>

      <p className="text-micro text-[#6E6962] text-center mt-2">
        {editing
          ? '사진과 문구를 끌어 옮기고, 오른쪽 아래 손잡이로 크기를 바꿔봐. 겹쳐도 좋아.'
          : '보드를 탭하면 배치를 직접 수정할 수 있어'}
      </p>

      {sheet.open && (
        <StickerSheet
          initial={sheet.editId ? live.stickers?.[sheet.editId] : undefined}
          onConfirm={handleStickerConfirm}
          onDelete={sheet.editId ? () => handleStickerDelete(sheet.editId!) : undefined}
          onClose={() => setSheet({ open: false })}
        />
      )}
    </div>
  );
}
