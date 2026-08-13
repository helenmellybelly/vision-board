'use client';

import { useEffect, useRef, useState } from 'react';
import { BoardData, CollageLayout, CollageLayoutItem, CollageSticker, CollageTemplate } from '@/lib/types';
import {
  ASPECT,
  CollageItem,
  MAX_W,
  MIN_W,
  STICKER_FONT_RATIO,
  STICKER_MIN_W,
  bumpPhoto,
  newStickerLayoutItem,
  resolveLayout,
  seedLayout,
  stickerKey,
  swapPhotos,
  themeFor,
  titleFor,
} from '@/lib/collageTemplates';
import {
  AMBIENT_SCALE,
  AMBIENT_SCRIM_ALPHA,
  TITLE_LABEL_TEXT,
  TITLE_SCALE_MAX,
  TITLE_SCALE_MIN,
  TitleAnchor,
  nearestAnchor,
  titleLayoutFor,
} from '@/lib/collageTokens';
import { bumpRowInSpec } from '@/lib/collageJustify';
import { ICONS, isIconId } from '@/lib/stickerArt';
import { SECTIONS } from '@/lib/questions';
import { SectionId } from '@/lib/types';
import { displaySrc } from '@/lib/imageSrc';
import EditableYear from './EditableYear';
import StickerSheet from './StickerSheet';
import TitleSheet from './TitleSheet';
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
  /** 타이틀 **모양** 전역 설정 (v11) — 배경색과 같은 축이라 보드 배치가 아니라 BoardData에 산다.
   *  위치만 layout.title에 기기·템플릿별로 저장된다 */
  titleGlobal?: BoardData['collageTitle'];
  /** 전역 타이틀 설정 변경 — 부모(app/collage/page.tsx)가 saveCollageTitle로 잇는다 */
  onTitleGlobalChange?: (patch: NonNullable<BoardData['collageTitle']>) => void;
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

/** #RRGGBB + 알파 → rgba(). canvas(withAlpha)와 같은 규칙이라 타이틀 카드 색이 락스텝이다 */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

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

/** 타이틀 카드의 드래그 키 — items 맵에 넣지 않는다 (v11).
 *  넣으면 photoAtPoint·withStickers·resolveLayout·applySpec·wallpaper z정렬·bringToFront·
 *  isLayoutBroken 일곱 곳이 전부 이걸 사진으로 오인한다. 하나만 놓쳐도 조용한 데이터 손상이라,
 *  드래그 엔진에 분기 하나를 두는 쪽이 훨씬 안전하다. 좌표는 layout.title.pos에 산다 */
const TITLE_KEY = 'title';

interface DragState {
  key: string;
  mode: 'move' | 'resize' | 'rotate';
  startX: number;
  startY: number;
  maxDist: number;
  /** 타이틀 드래그에는 items 항목이 없다 */
  item?: CollageLayoutItem;
  /** 타이틀 드래그 시작 상태 (v11) — 카드 좌상단·폭·배율 */
  titleStart?: { x: number; y: number; w: number; scale: number };
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
  // 라인 아이콘 (v10) — canvas(lib/wallpaper.ts)와 **같은 단위 path**를 그린다.
  // viewBox="0 0 1 1" + preserveAspectRatio="none"이면 박스가 곧 좌표계라 두 렌더러가 자동 일치한다
  if (sticker.kind === 'icon' && isIconId(sticker.icon)) {
    const def = ICONS[sticker.icon];
    const ink = sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19');
    // ⚠️ 선 굵기는 **아이콘 박스의 짧은 변** 기준이어야 canvas(lineWidth = stroke × min(w,h))와 맞는다.
    //    `${def.stroke * 100}cqi`로 두면 보드 폭 기준이 되어 화살표 선이 50px로 뭉개진다
    //    (실측: 검은 덩어리). cqi는 보드 폭의 %이므로 박스 짧은 변을 cqi로 환산해 곱한다.
    const shortSideCqi = it.w * 100 * Math.min(1, 1 / def.ratio);
    return (
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="w-full block"
        style={{ aspectRatio: String(def.ratio), overflow: 'visible' }}
        aria-hidden="true"
      >
        <path
          d={def.d}
          fill={def.mode === 'fill' ? ink : 'none'}
          fillOpacity={def.mode === 'fill' ? def.alpha ?? 1 : undefined}
          stroke={def.mode === 'stroke' ? ink : 'none'}
          // 비등방 viewBox에서도 선 굵기가 찌그러지지 않게 — canvas의 lineWidth 처리와 같은 의도
          vectorEffect="non-scaling-stroke"
          strokeWidth={def.mode === 'stroke' ? `${def.stroke * shortSideCqi}cqi` : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
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
  titleGlobal, onTitleGlobalChange,
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
  // 드래그 중 자리를 맞바꿀 대상 (v9.0) — 정렬 모드의 이동은 좌표 이동이 아니라 스왑이다
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  // 타이틀 설정 시트 열림 (v11) — v10의 보드 안 9점 패널을 대체한다.
  // 컨트롤이 6종으로 늘어 모바일 보드 폭(약 294px)에 얹으면 보드를 거의 다 가린다
  const [titleSheet, setTitleSheet] = useState(false);
  // 리사이즈 드래그 중 미리보기 배율 (v11) — 배율은 전역(BoardData)이라 live에 없다.
  // 드래그가 끝나야 onTitleGlobalChange로 커밋한다
  const [titleScaleDraft, setTitleScaleDraft] = useState<number | null>(null);

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
  // 정렬 모드인가 (v10) — 자유 배치를 켰으면 null(좌표 자유 편집 + 회전)
  const spec = live.freeform ? null : live.spec ?? null;

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
    // ⚠️ 캡처는 핸들이 아니라 **보드**에 건다 (v10).
    // 핸들에 걸면 포인터가 보드 밖으로 나가는 순간 move/up이 보드 핸들러에 안 닿아 제스처가 끊긴다.
    // v10은 풀블리드라 사진이 보드 가장자리에 붙어 있어(마지막 행의 ⤡ 핸들은 보드 하단에 있다)
    // 아래로 조금만 끌어도 바로 이탈한다 — 실측으로 확인한 결함이다. 드래그의 주인은 보드다.
    (boardRef.current ?? (e.currentTarget as HTMLElement)).setPointerCapture(e.pointerId);
    // 타이틀은 items에 없고 z도 없다(항상 맨 위) — bringToFront를 건너뛴다
    if (key === TITLE_KEY) {
      dragRef.current = {
        key, mode, startX: e.clientX, startY: e.clientY, maxDist: 0,
        titleStart: { x: titleLayout.box.x, y: titleLayout.box.y, w: titleLayout.box.w, scale: titleCfg.scale },
        baseItems: liveRef.current.items,
      };
      return;
    }
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
        const it = drag.item!;
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

    // ── 타이틀 (v11) ──
    // ⚠️ 여기서 반드시 return — 아래 스왑/고스트 프리뷰 경로에 흘러가면 spec이 없는 키로
    //    swapPhotos를 부르게 되어 배치가 조용히 깨진다
    if (drag.key === TITLE_KEY) {
      const st = drag.titleStart!;
      if (drag.mode === 'move') {
        // 경계 클램프는 titleLayoutFor가 읽기 시점에 한다 — 원시 좌표만 넘긴다
        commitLive((prev) => ({
          ...prev,
          title: { ...prev.title, pos: { x: st.x + dx, y: st.y + dy } },
        }));
      } else {
        // 시작 폭 대비 증가율이 곧 배율. 대각 두 성분의 평균으로 방향 노이즈를 줄인다
        const grow = 1 + (dx + dy * (rect.height / rect.width)) / 2 / Math.max(st.w, 0.02);
        setTitleScaleDraft(clamp(st.scale * grow, TITLE_SCALE_MIN, TITLE_SCALE_MAX));
      }
      return;
    }

    const it = drag.item!;
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

    if (isSticker || !spec) return;

    // 고스트 프리뷰 — 방향이 바뀔 때만 다시 계산해 프레임당 재계산을 피한다
    if (drag.mode === 'resize') {
      const dir = resizeDir(dxPx, dyPx, rect);
      const cur = dir === 'up' ? 1 : dir === 'down' ? -1 : 0;
      if (!drag.previewSpan || drag.previewSpan[0] !== cur) {
        drag.previewSpan = [cur, 0];
        setPreviewLayout(
          dir ? bumpPhoto(liveRef.current, template, items, aspect, drag.key, dir).items : null
        );
      }
    } else if (drag.mode === 'move') {
      // 이동은 좌표 이동이 아니라 자리 맞바꾸기 — 어디에 놓을지 실시간으로 보여준다
      setSwapTarget(photoAtPoint(e.clientX, e.clientY, drag.baseItems, drag.key));
    }
  }

  /** 리사이즈 핸들 드래그 → 행 경계 이동 방향 (v10).
   *  v9의 "스팬 등급 스냅"을 대체한다 — 저스티파이드에는 정수 스팬이 없고, 크기는
   *  "이 행에 사진이 몇 장인가"로 정해진다. 그래서 조작의 실체는 한 칸 밀기/당기기다.
   *
   *  ⚠️ 의도는 **원시 드래그 거리**로 잰다. 클램프된 결과 폭으로 재면 안 된다 —
   *  히어로 옆 사진처럼 `1 − x`에 막힌 항목은 아무리 끌어도 폭이 2%밖에 안 늘어
   *  "끌어도 아무 반응이 없다"가 된다(실측: 고스트 프리뷰가 한 번도 안 떴다). */
  function resizeDir(dxPx: number, dyPx: number, rect: DOMRect): 'up' | 'down' | null {
    const unit = Math.min(rect.width, rect.height);
    const delta = (dxPx + dyPx) / 2 / unit;
    if (delta > 0.05) return 'up';
    if (delta < -0.05) return 'down';
    return null;
  }

  /** 배치를 갈아끼우고 정착 모션을 켠다 — spec과 items의 일관성은 applySpec이 보장한다 */
  function commitSpec(next: CollageLayout) {
    setSettling(true);
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), 300);
    saveEdited(next);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setPreviewLayout(null);
    setSwapTarget(null);
    const isSticker = drag.key.startsWith('sticker:');
    const moved = drag.maxDist >= TAP_THRESHOLD;

    // ── 타이틀 (v11) ── 위치는 배치에, 배율은 전역에. 스왑 경로에 진입하지 않는다
    if (drag.key === TITLE_KEY) {
      if (drag.mode === 'resize') {
        if (titleScaleDraft !== null) setTitleGlobal({ scale: titleScaleDraft });
        setTitleScaleDraft(null);
      } else if (moved) {
        saveEdited(liveRef.current);
      } else {
        setTitleSheet(true); // 움직이지 않고 탭 → 설정 시트
      }
      return;
    }

    // ── 정렬 모드 (v10) ──
    // 이동=스왑, 리사이즈=행 경계 이동. 좌표를 자유롭게 바꾸는 경로가 없으므로 배치는 깨질 수 없다 —
    // v8.x에서 "한 번 자유롭게 옮겼더니 그 뒤로 자동 정렬이 영영 안 되던" 지점이 구조적으로 사라졌다.
    if (spec && !isSticker && moved) {
      // 커밋 대상은 드래그 이전의 배치 — 드래그 중 임시로 밀어둔 좌표(live)를 쓰면 안 된다
      const base: CollageLayout = { ...liveRef.current, items: drag.baseItems };
      if (drag.mode === 'resize') {
        // 드래그 중 계산해 둔 방향을 그대로 쓴다 — 프리뷰가 보여준 것과 커밋 결과가 어긋나면 안 된다
        const dir = drag.previewSpan?.[0] === 1 ? 'up' : drag.previewSpan?.[0] === -1 ? 'down' : null;
        // 방향이 애매하면 원래 배치를 다시 적용해 제자리로 미끄러진다(스냅백)
        commitSpec(dir ? bumpPhoto(base, template, items, aspect, drag.key, dir) : base);
        return;
      }
      if (drag.mode === 'move') {
        const p = lastPointer.current;
        const hit = p ? photoAtPoint(p.x, p.y, drag.baseItems, drag.key) : null;
        // 빈 곳에 놓으면 제자리로 — 정렬 모드에 "아무 데나 두기"는 없다
        commitSpec(hit ? swapPhotos(base, template, items, aspect, drag.key, hit) : base);
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

  /** 탭 액션 '크게'·'작게' (v10) — 핸들 정밀 드래그 없이 행 경계를 한 칸씩 옮긴다.
   *  손가락으로 정밀 조작이 어려운 모바일의 주 동선 */
  function bumpSize(key: string, dir: 'up' | 'down') {
    if (!spec) return;
    const next = bumpPhoto(liveRef.current, template, items, aspect, key, dir);
    if (next !== liveRef.current) commitSpec(next);
  }

  /** 자유 배치 토글 — 정렬을 벗어나 원하는 곳에 두고 회전까지 하고 싶을 때의 명시적 탈출구.
   *  되돌리면 지금 장수의 표준 배치로 다시 정렬된다 */
  function toggleFreeform() {
    const prev = liveRef.current;
    if (prev.freeform) {
      const fresh = seedLayout(template, items, aspect, { kitRemoved: prev.kitRemoved });
      // 스티커는 배치 밖 오버레이라 자유 배치에서 옮겨둔 자리를 그대로 지킨다
      const stickerItems = Object.fromEntries(
        Object.entries(prev.items).filter(([k]) => k.startsWith('sticker:'))
      );
      saveEdited({
        ...fresh,
        items: { ...fresh.items, ...stickerItems },
        stickers: { ...fresh.stickers, ...prev.stickers },
        edited: true,
        freeform: false,
      });
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
    // 시드는 edited:false — 이후 사진이 추가되면 자동 배치가 신선하게 다시 깔린다 (v8.0).
    // kitRemoved를 넘기지 않는 게 의도다 (v10): '기본 배치로'는 지운 기본 스티커까지 되살린다 —
    // 그게 "기본으로 돌아간다"의 정직한 의미이고, 킷을 실수로 지운 사용자의 유일한 복구 동선이다
    setPhotoAction(null);
    setTitleSheet(false);
    // ⚠️ 타이틀 **모양**(전역 collageTitle)은 건드리지 않는다 — 배경색이 '기본 배치로'에
    //    영향받지 않는 것과 같은 계약. 위치는 시드에 title이 없어 템플릿 기본 앵커로 돌아간다
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
    // ⚠️ prev를 펼쳐야 한다 — {items, stickers}만 저장하면 spec·title·aspect가 통째로 사라져
    //    다음 렌더에서 resolveLayout이 배치를 새로 깔아버린다(v9에서도 grid가 같은 식으로 날아갔다)
    // 기본 킷 스티커는 지운 사실을 기억해 템플릿을 다시 골라도 안 돌아오게 한다 (v10).
    // '기본 배치로'를 누르면 kitRemoved가 비워져 되살아난다
    const kitRemoved = id.startsWith('kit:')
      ? [...new Set([...(prev.kitRemoved ?? []), id])]
      : prev.kitRemoved;
    saveEdited({ ...prev, items: nextItems, stickers, kitRemoved });
    setSheet({ open: false });
  }

  // 타이틀 카드 (v10~v11) — 상단 예약 밴드를 없애고 사진 위에 얹는다.
  // 기하·색은 collageTokens.titleLayoutFor가 단일 소스라 canvas(drawTitleCard)와 자동 락스텝이다.
  // ⚠️ 여기서 좌표를 계산하지 말 것 — 표시 리스트(titleLayout.lines)를 그리기만 한다
  const baseTitleCfg = titleFor(template, live.title, titleGlobal);
  const titleCfg =
    titleScaleDraft !== null ? { ...baseTitleCfg, scale: titleScaleDraft } : baseTitleCfg;
  const titleLayout = titleLayoutFor(titleCfg, aspect, theme.bg);

  /** 위치는 기기·템플릿별 — 앵커를 고르면 자유 좌표를 버린다(프리셋으로 되돌아간다) */
  const setTitleAnchor = (anchor: TitleAnchor) =>
    saveEdited({ ...liveRef.current, title: { anchor, pos: undefined } });
  /** 모양은 전역 — 템플릿을 바꿔도 따라온다 */
  const setTitleGlobal = (patch: NonNullable<BoardData['collageTitle']>) =>
    onTitleGlobalChange?.(patch);
  /** '깔끔한 자리로' — 지금 카드 중심에서 가장 가까운 9점으로 스냅 */
  const snapTitleToAnchor = () => setTitleAnchor(nearestAnchor(titleLayout.box));
  // 앰비언트 배경 (v10) — 크롭 없이 꽉 채울 수 없는 배치에서만 존재한다
  const ambientSrc = spec?.ambient ? items.find((i) => i.key === spec.ambient)?.src : undefined;

  return (
    <div>
      {/* 사용법 안내 (v9.0) — 보드 아래 회색 잔글씨는 "안 보인다"는 오너 피드백.
          보드 바로 위 알약으로 올리고 대비·크기를 키워 여백 텍스트가 아니라 UI로 읽히게 했다.
          PC 뷰는 보드가 넓어 하단 중앙이 시야 밖이라 상단 앵커가 특히 유효하다 */}
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
        {/* 앰비언트 배경 (v10) — 사진 뒤(z-0). 크롭 0으로는 꽉 채울 수 없는 배치에서만 나온다.
            같은 사진을 크게 흐려 깔아 "빈 공간"이 아니라 의도된 배경으로 읽히게 한다 */}
        {ambientSrc && (
          <div
            data-testid="collage-ambient"
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc(ambientSrc)}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: 'blur(6cqmin)', transform: `scale(${AMBIENT_SCALE})` }}
            />
            <div className="absolute inset-0" style={{ background: theme.bg, opacity: AMBIENT_SCRIM_ALPHA }} />
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
                      className={`w-full h-full rounded-xl overflow-hidden ${
                        // 어두운 배경에서는 그림자가 안 보인다 — 밝은 링으로 바꿔야 사진 경계가 산다 (v9.0)
                        theme.dark ? 'shadow-none ring-1 ring-white/15' : 'shadow-sm'
                      } ${
                        editing && !badge ? (theme.dark ? 'ring-1 ring-white/40' : 'ring-1 ring-black/15') : ''
                      }`}
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
                          // displaySrc (v8.7) — 캔버스 내보내기와 동일한 URL·동일한 CORS 모드.
                          // 캐시 엔트리를 공유해야 저장 시 재로드가 없고, onError가 내보내기 실패와
                          // 같은 조건에서 발화해 ⚠️ 타일·저장 경고가 비로소 진실해진다.
                          src={displaySrc(src ?? '')}
                          alt=""
                          // 앰비언트 배경도 <img>라 검증이 사진과 구분할 표식이 필요하다 (v10)
                          data-photo={key}
                          draggable={false}
                          // v10 — 전 템플릿 단일 경로(cover). 액자(object-contain)가 필요 없어졌다:
                          // 박스가 사진의 원본 비율에 맞춰 만들어지므로 cover가 잘라낼 게 거의 없다
                          // (crop ≤ 6%가 계약 — scripts/verify-justify.js). canvas drawCover와 락스텝
                          className={`w-full object-cover pointer-events-none ${
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
                    // 스티커에도 같은 핸들이 붙는다 — 검증이 사진 핸들만 집도록 표식을 준다.
                    // 표식이 없어 nth(1)이 킷 스티커 핸들을 잡는 바람에 고스트 프리뷰 검증이 헛돌았다
                    data-resize-for={key}
                  >
                    <span className="text-micro text-[#6E6962] leading-none">⤡</span>
                  </div>
                )}
                {/* 회전은 자유 배치·스티커에서만 (v9.0) — 회전 bbox가 이웃 셀을 침범해
                    "빈틈 0"과 논리적으로 모순이고, 핸들 난립도 함께 해소된다 */}
                {editing && (!spec || isSticker) && (
                  <div
                    onPointerDown={(e) => onItemPointerDown(e, key, 'rotate')}
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-grab z-10"
                    aria-label="회전"
                    // 스티커는 정렬 모드에서도 회전이 살아 있다 — 검증이 사진 핸들만 세도록 표식을 준다
                    data-rot-for={key}
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

        {/* 타이틀 카드 (v10~v11) — 사진 **위에** 얹힌다. v9의 상단 예약 밴드를 없앤 만큼 사진이 커졌다.
            v11부터 좌표·색을 여기서 계산하지 않는다: titleLayoutFor의 표시 리스트를 그리기만 해
            canvas drawTitleCard와 구조적으로 락스텝이다(v10은 세로 정렬·연도 자간이 실제로 갈라져 있었다).
            ⚠️ backdrop-filter 금지 — canvas로 재현할 수 없어 화면과 저장 이미지가 갈라진다 */}
        {titleLayout.visible && (
          <div
            data-testid="board-title"
            // ⚠️ 카드 자체는 항상 pointer-events-none (v11). 편집 모드에서 카드 전체를 잡게 두면
            //    카드가 덮은 사진을 아예 탭할 수 없다 — V10-7a가 실제로 그렇게 깨졌다.
            //    잡는 대상은 **보이는 글자**뿐이고, 그건 사용자가 무엇을 집는지 눈에 보인다는 뜻이기도 하다
            className="absolute z-30 pointer-events-none"
            style={{
              left: `${titleLayout.box.x * 100}%`,
              top: `${titleLayout.box.y * 100}%`,
              width: `${titleLayout.box.w * 100}%`,
              height: `${titleLayout.box.h * 100}%`,
              background:
                titleLayout.card.alpha > 0 ? rgba(titleLayout.card.color, titleLayout.card.alpha) : 'transparent',
              border:
                titleLayout.border.alpha > 0
                  ? `1px solid ${rgba(titleLayout.border.color, titleLayout.border.alpha)}`
                  : 'none',
              borderRadius: `${titleLayout.radius * 100}cqmin`,
              outline: editing ? '2px dashed rgba(255,255,255,0.65)' : undefined,
              outlineOffset: editing ? '2px' : undefined,
            }}
          >
            {titleLayout.lines.map((l) => {
              const style: React.CSSProperties = {
                position: 'absolute',
                left: `${((l.x - titleLayout.box.x) / titleLayout.box.w) * 100}%`,
                top: `${((l.cy - titleLayout.box.y) / titleLayout.box.h) * 100}%`,
                transform: `translate(${l.align === 'left' ? '0' : l.align === 'right' ? '-100%' : '-50%'}, -50%)`,
                color: l.color,
                fontSize: `${l.size * 100}cqmin`,
                letterSpacing: `${l.tracking}em`,
                whiteSpace: 'nowrap',
                textShadow: titleLayout.shadow
                  ? `0 ${titleLayout.shadow.dy * 100}cqmin ${titleLayout.shadow.blur * 100}cqmin ${titleLayout.shadow.color}`
                  : undefined,
              };
              // 편집 모드에서 **글자만** 잡는다 — 끌면 이동, 움직이지 않고 탭하면 설정 시트.
              // ⚠️ 핸들러는 인라인 화살표로 둘 것 — 객체에 담아 prop으로 펼치면
              //    react-hooks/refs가 "렌더 중 ref 접근"으로 잡는다(주변 핸들 코드와 같은 형태 유지)
              const grabCls = editing ? 'pointer-events-auto cursor-move' : '';
              const grabStyle = editing ? { ...style, touchAction: 'none' as const } : style;
              if (l.kind === 'label') {
                return (
                  <span
                    key="label"
                    className={`font-semibold ${grabCls}`}
                    style={grabStyle}
                    onPointerDown={editing ? (e) => onItemPointerDown(e, TITLE_KEY, 'move') : undefined}
                  >
                    {TITLE_LABEL_TEXT}
                  </span>
                );
              }
              // 감상 모드에서만 연도 인라인 편집 — 편집 모드에서는 글자가 드래그 핸들이라
              // 탭이 시트를 열어야 한다(연도는 시트 안에서 고친다)
              return editing ? (
                <span
                  key="year"
                  className={`font-script font-bold ${grabCls}`}
                  style={grabStyle}
                  onPointerDown={(e) => onItemPointerDown(e, TITLE_KEY, 'move')}
                >
                  {year}
                </span>
              ) : (
                <span key="year" className="pointer-events-auto" style={style}>
                  <EditableYear
                    year={year}
                    onYearChange={onYearChange}
                    className="font-script font-bold"
                    style={{ color: l.color, fontSize: 'inherit', letterSpacing: 'inherit' }}
                  />
                </span>
              );
            })}
            {/* ⚠️ 핸들은 카드 **안쪽**에 둔다 (v11). 사진 핸들처럼 -bottom-2 -right-2로 띄우면
                카드 밖 24px가 새로 클릭을 삼켜, 그 자리 사진을 탭할 수 없게 된다 —
                verify-v10r1 V10-7a가 실제로 여기 걸렸다(사진 중심이 핸들에 가려 액션 칩이 안 열림).
                카드가 이미 가리는 영역 안에 두면 새로 막히는 곳이 0이다 */}
            {editing && (
              <div
                onPointerDown={(e) => onItemPointerDown(e, TITLE_KEY, 'resize')}
                // ⚠️ 표식이 `data-resize-for`면 안 된다 — 그 속성은 **items 항목**(사진·스티커)의
                //    핸들이라는 뜻이고, 기존 스위트가 `[data-resize-for]:not([...^="sticker:"])`로
                //    사진 핸들을 고른다. 타이틀은 items에 없으므로 여기 끼면 `.last()`가 타이틀을
                //    집어 "사진을 리사이즈했는데 아무 일도 안 일어난다"가 된다(V85-8d가 실제로 그랬다)
                data-title-resize="1"
                aria-label="타이틀 크기 조절"
                // ⚠️ pointer-events는 상속된다 — 카드가 none이므로 핸들이 명시적으로 auto를 켜야 잡힌다
                className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 shadow-md border border-[#E5E3DF] flex items-center justify-center text-[#4A463F] text-micro cursor-nwse-resize z-10 pointer-events-auto"
                style={{ touchAction: 'none' }}
              >
                <span className="pointer-events-none">⤡</span>
              </div>
            )}
          </div>
        )}

        {/* 편집 가이드 (v10) — 보드 **안쪽** 하단 플로팅.
            v9는 보드 위 알약이었는데, 타이틀 예약이 사라지며 보드가 커진 만큼 페이지 세로 예산이
            부족해졌다(PC 무스크롤 V87-4d ↔ 보드 폭 ≥1000 V87-4e가 반대 방향). 안으로 넣으면
            페이지 높이를 0 먹으면서 대비는 오히려 좋아진다.
            감상 모드에서는 띄우지 않는다 — 배경화면 미리보기를 글자가 덮으면 안 되고,
            진입 어포던스는 '✎ 탭해서 편집' 버튼이 이미 맡고 있다 */}
        {editing && (
          <p
            data-testid="board-hint"
            className="absolute bottom-[2.5cqmin] inset-x-[6cqmin] z-40 mx-auto w-fit max-w-full rounded-full bg-black/60 px-[3cqmin] py-[1.4cqmin] text-white text-center pointer-events-none"
            style={{ fontSize: '2.6cqmin' }}
          >
            {spec
              ? '사진을 끌어 자리를 바꾸고, 탭하면 크게·작게 할 수 있어. 빈틈은 알아서 채워져.'
              : '자유 배치야 — 원하는 곳에 두고 ⤡ 크기·↻ 각도까지 바꿀 수 있어.'}
          </p>
        )}

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
              {/* 타이틀 설정 (v11) — 바텀시트로 연다. 컨트롤이 6종이라 보드 안 패널로는 안 들어가고,
                  페이지 크롬에 붙이면 --board-reserve 예산이 늘어 PC 보드 폭(V87-4e)이 줄어든다.
                  시트는 fixed 오버레이라 페이지 높이를 0 먹는다 */}
              <button
                onClick={() => setTitleSheet(true)}
                aria-pressed={titleSheet}
                aria-label="타이틀 설정"
                className={`px-3 py-1.5 rounded-full text-caption font-medium active:opacity-70 ${
                  titleSheet ? 'bg-white text-[#1C1B19] shadow' : 'bg-black/60 text-white'
                }`}
              >
                타이틀
              </button>
              {/* 자유 배치 토글 (v9.0) — 그리드를 벗어나 아무 데나 두고 회전까지 하고 싶을 때의
                  명시적 탈출구. 자동 정렬이 조용히 죽는 대신 사용자가 켜고 끈다 */}
              <button
                onClick={toggleFreeform}
                aria-pressed={!spec}
                className={`px-3 py-1.5 rounded-full text-caption font-medium active:opacity-70 ${
                  spec ? 'bg-black/60 text-white' : 'bg-white text-[#1C1B19] shadow'
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
            {/* 크게·작게 (v10) — 핸들 정밀 드래그 없이 행 경계를 한 칸씩. 모바일 주 동선.
                더 갈 곳이 없으면(혼자 쓰는 행을 더 키우기 등) 비활성화한다 —
                눌러도 아무 일이 없으면 사용자는 앱이 고장 났다고 읽는다 */}
            {spec &&
              (['up', 'down'] as const).map((dir) => {
                const enabled = bumpRowInSpec(spec, photoAction, dir) !== spec;
                return (
                  <button
                    key={dir}
                    onClick={() => bumpSize(photoAction, dir)}
                    disabled={!enabled}
                    className={`px-3 py-1.5 rounded-full text-caption font-medium ${
                      enabled ? 'bg-black/60 text-white active:opacity-70' : 'bg-black/25 text-white/50 cursor-default'
                    }`}
                    aria-label={dir === 'up' ? '크게' : '작게'}
                  >
                    {dir === 'up' ? '크게' : '작게'}
                  </button>
                );
              })}
            {!spec && (
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

      {titleSheet && (
        <TitleSheet
          cfg={titleCfg}
          year={year}
          onYearChange={onYearChange}
          onAnchorChange={setTitleAnchor}
          onGlobalChange={setTitleGlobal}
          onSnapToAnchor={titleCfg.pos ? snapTitleToAnchor : undefined}
          onClose={() => setTitleSheet(false)}
        />
      )}

      {/* 사진 확대 (v8.2) — 보드에선 크롭돼 보이므로 확대는 원본 비율 전체 */}
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} fit="contain" />
    </div>
  );
}
