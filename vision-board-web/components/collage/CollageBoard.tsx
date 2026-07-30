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
import { FOREST } from '@/lib/colors';
import { SECTIONS } from '@/lib/questions';
import { SectionId } from '@/lib/types';
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
  view, active, onEditingChange, onRequestReplace, onRequestRemove, onBrokenChange,
}: Props) {
  const theme = COLLAGE_THEMES[template];
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const tapRef = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  // 탭한 사진의 구제 액션(맨 뒤로·바로 세우기) — 묻힌 사진을 꺼내는 유일한 동선 (v8.0)
  const [photoAction, setPhotoAction] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; editId?: string }>({ open: false });
  // 로드 실패 사진 (v8.1) — 사진 구성이 바뀌면 리셋, 여전히 깨졌으면 onError가 다시 채운다
  const [brokenKeys, setBrokenKeys] = useState<Set<string>>(new Set());
  const [live, setLive] = useState<CollageLayout>(() => resolveLayout(template, items, layout, aspect));
  const liveRef = useRef(live);

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
    const drag: DragState = { key, mode, startX: e.clientX, startY: e.clientY, maxDist: 0, item: next.items[key] };
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
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    saveEdited(liveRef.current);
    if (drag.maxDist < TAP_THRESHOLD && drag.mode === 'move') {
      if (drag.key.startsWith('sticker:')) {
        // 스티커를 움직이지 않고 탭하면 수정 시트 열기
        setSheet({ open: true, editId: drag.key.slice('sticker:'.length) });
      } else {
        // 사진 탭 → 구제 액션 (맨 뒤로·바로 세우기) — 묻힌 사진을 꺼내는 동선 (v8.0)
        setPhotoAction((cur) => (cur === drag.key ? null : drag.key));
      }
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

  const titleColor = theme.dark ? '#FFFFFF' : '#1C1B19';
  const labelColor = theme.dark ? '#C4C2BE' : '#6E6962';

  return (
    <div>
      <div
        ref={boardRef}
        data-testid="collage-board"
        data-view={view}
        className="relative w-full mx-auto rounded-3xl overflow-hidden select-none"
        style={{
          aspectRatio: String(aspect),
          // 숲 테마 — bgGradient 있으면 세로 그라디언트 (canvas renderBoardLayout과 동일 수치)
          background: theme.bgGradient
            ? `linear-gradient(180deg, ${theme.bgGradient[0]} 0%, ${theme.bgGradient[1]} 100%)`
            : theme.bg,
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
                      className={`w-full h-full rounded-xl overflow-hidden ${theme.dark ? 'shadow-lg' : 'shadow-sm'} ${editing && !badge ? (theme.dark ? 'ring-1 ring-white/30' : 'ring-1 ring-black/15') : ''}`}
                      style={editing && badge ? { boxShadow: `0 0 0 2px ${badge.color}` } : undefined}
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
                          src={src}
                          alt=""
                          draggable={false}
                          className={`w-full object-cover pointer-events-none ${it.h !== undefined ? 'h-full' : 'aspect-square'}`}
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
                {editing && (
                  <div
                    onPointerDown={(e) => onItemPointerDown(e, key, 'rotate')}
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-grab z-10"
                    aria-label="회전"
                  >
                    <span className="text-micro text-[#6E6962] leading-none">↻</span>
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
              style={{ backgroundColor: FOREST.card }}
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
            <button
              onClick={() => sendToBack(photoAction)}
              className="px-3 py-1.5 rounded-full bg-black/60 text-white text-caption font-medium active:opacity-70"
              aria-label="맨 뒤로"
            >
              맨 뒤로
            </button>
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

      <p className="text-micro text-[#6E6962] text-center mt-2">
        {editing
          ? '끌어서 옮기고, ⤡로 크기·↻로 각도를 바꿔봐. 사진을 탭하면 바꾸거나 지울 수도 있어.'
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
