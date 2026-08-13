'use client';

import { useEffect, useRef, useState } from 'react';
import { BoardData, CollageLayout, CollageLayoutItem, CollageSticker, CollageTemplate } from '@/lib/types';
import {
  ASPECT,
  CollageItem,
  MAX_W,
  MIN_W,
  STICKER_MIN_W,
  bumpPhoto,
  enterFreeform,
  exitFreeform,
  newStickerLayoutItem,
  normalizeStickerText,
  stickerBoxH,
  resolveLayout,
  seedLayout,
  stickerKey,
  swapPhotos,
} from '@/lib/collageTemplates';
import {
  TITLE_SCALE_MAX,
  TITLE_SCALE_MIN,
  TitleAnchor,
  nearestAnchor,
} from '@/lib/collageTokens';
import { bumpRowInSpec } from '@/lib/collageJustify';
import BoardCanvasDom, { TITLE_KEY, boardVisuals, titleConfigOf } from './BoardCanvasDom';
import StickerToolbar from './StickerToolbar';
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 캐럿을 글자 끝으로 — 편집 진입·프리셋 적용 후 커서가 앞에 남아 있으면 계속 쓸 수가 없다 */
function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
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
  /** 스티커 실측 높이(정규화, v12) — 소프트랩까지 포함한 안전망.
   *  공식(stickerBoxH)은 하드 브레이크만 세므로, 긴 한 줄이 자동으로 접힌 경우를 이걸로 덮는다 */
  measuredH?: number;
  /** resize 모드 — 마지막 프리뷰 스팬. 정수 스팬이 바뀔 때만 프리뷰를 다시 계산 */
  previewSpan?: [number, number];
}

// 통합 콜라주 보드 — 모든 템플릿이 같은 드래그 엔진을 쓴다.
// 보드를 탭하면 편집 모드: 사진·스티커 이동/리사이즈, + 문구 추가, 변경 즉시 저장.
export default function CollageBoard({
  template, items, layout, onLayoutChange, year, onYearChange, aspect = ASPECT,
  view, active, onEditingChange, onRequestReplace, onRequestRemove, onBrokenChange, bgColor,
  titleGlobal, onTitleGlobalChange,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const tapRef = useRef<{ x: number; y: number } | null>(null);
  // pointer-up 이벤트에는 좌표가 없을 수 있어(pointercancel) 마지막 move 좌표를 들고 있는다
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  // 탭한 사진의 구제 액션(맨 뒤로·바로 세우기) — 묻힌 사진을 꺼내는 유일한 동선 (v8.0)
  const [photoAction, setPhotoAction] = useState<string | null>(null);
  // 인라인 편집 중인 문구 id (v12) — v11의 sheet {open, editId}를 대체한다.
  // ⚠️ 글자 **내용**은 여기 없다. 편집 중에는 DOM(contentEditable)이 소유하고, 커밋 시점에만
  //    거둬들인다 — React state로 물면 한글 IME 조합 중 캐럿이 튄다
  const [editingSticker, setEditingSticker] = useState<string | null>(null);
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
  // '기본 배치로' 확인 대기 (v12) — 되돌릴 수 없는 유일한 동작이라 한 번 더 묻는다
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => { if (resetTimer.current) window.clearTimeout(resetTimer.current); }, []);

  // 편집 상태 전환은 이 함수로만 — 부모(나란히 배타 편집)에 항상 통지 (v8.1)
  function switchEditing(next: boolean) {
    // ⚠️ 편집을 나가기 전에 쓰던 문구를 반드시 거둬들인다 (v12). 안 하면 마지막 글자가 저장되지
    //    않거나, 아무것도 안 쓴 빈 문구가 보이지 않는 유령 항목으로 남아 그 자리 사진의 탭을 가로챈다
    if (!next && editingSticker) finishStickerEdit();
    setEditing(next);
    if (!next) setPhotoAction(null);
    onEditingChange?.(next);
  }

  // 다른 쪽 보드가 편집을 가져가면 이쪽은 감상 모드로 (StickerSheet 중복 방지)
  useEffect(() => {
    if (active === false) {
      // 다른 보드가 편집을 가져가도 쓰던 문구는 잃지 않는다 (v12)
      if (editingSticker) finishStickerEdit();
      setEditing(false);
      setPhotoAction(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 문구 편집에 들어가면 캐럿을 잡아준다 (v12) — 탭 한 번으로 바로 쓸 수 있어야 한다.
  // ⚠️ StickerView가 마운트된 **뒤에** 잡아야 하므로 editingSticker 변화에 반응한다
  useEffect(() => {
    if (!editingSticker) return;
    const el = boardRef.current?.querySelector<HTMLElement>('[data-sticker-edit]');
    if (!el) return;
    el.focus({ preventScroll: true });
    placeCaretAtEnd(el);
  }, [editingSticker]);

  // 외부 layout·사진 구성 변경 동기화 (드래그 중이 아닐 때)
  //
  // ⚠️ 문구 편집 중에도 건너뛴다 (v12). 드래그를 막는 것과 **정확히 같은 이유**다 —
  //    사용자가 손대고 있는 상태를 props에서 되돌려 받으면 진행 중인 작업이 사라진다.
  //    새 문구는 글자가 생기기 전까지 저장되지 않으므로(초안), 이 가드가 없으면 부모가 한 번만
  //    리렌더해도 초안이 통째로 날아가 **아예 쓸 수가 없다**(실측: 타이핑 직후 툴바째 사라짐).
  //    편집이 끝나면 커밋 → 저장 → layout 변경으로 이 효과가 다시 돌아 정상 동기화된다.
  useEffect(() => {
    if (!dragRef.current && !editingSticker) commitLive(() => resolveLayout(template, items, layout, aspect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, aspect, items.map((i) => i.key).join(','), layout, editingSticker]);

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
    // 스티커 높이 1회 실측 (v12) — 공식은 하드 브레이크만 세므로 소프트랩된 실제 높이를 상한으로 얹는다
    if (key.startsWith('sticker:')) {
      const box = boardRef.current?.getBoundingClientRect();
      const el = boardRef.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(key)}"]`);
      if (box && el) drag.measuredH = el.getBoundingClientRect().height / box.height;
    }
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
    // ⚠️ 스티커의 높이를 정사각(it.w × aspect)으로 가정하면 안 된다 (v12).
    //    chip 1줄의 실제 높이는 그 0.26배라, w=0.44 문구가 높이 5%인데 20%를 예약당해
    //    **보드 하단 20%에 문구를 놓을 수가 없었다** — 오너의 "배치가 박스에 갇혀 있다"의 일부다.
    //    공식(stickerHeightNorm)이 단일 소스이고, 실측은 소프트랩까지 감안한 상한으로만 쓴다
    const hNorm =
      it.h ??
      (isSticker
        ? Math.max(stickerBoxH(live.stickers?.[drag.key.slice('sticker:'.length)], it.w, aspect), drag.measuredH ?? 0)
        : it.w * aspect);
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
        // 문구를 움직이지 않고 탭하면 그 자리에서 편집 (v12) — 시트를 띄우지 않는다.
        // 캐럿은 StickerView가 마운트되며 잡는다(편집 중인 스티커에는 드래그 핸들러가 안 붙는다)
        const id = drag.key.slice('sticker:'.length);
        setPhotoAction(null);
        setEditingSticker(id);
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
   *
   *  v12: **왕복이 무손실이다.** 끄면 지금 좌표를 freeItems에 스태시하고, 다시 켜면 되돌린다.
   *  v11까지는 끄는 순간 사용자가 만든 좌표가 흔적 없이 사라졌고 되돌릴 방법이 없었다 —
   *  그래서 오너는 "배치가 박스에 갇혀 있다"고 느끼면서도 이 토글을 못 썼다. 기능이 없어서가
   *  아니라 **실험이 위험해서**였다. 안전해지면 그것 자체가 자율성이다.
   *  (로직은 lib/collageTemplates의 순수 함수 — verify-sticker S-7이 왕복을 기계로 잠근다) */
  function toggleFreeform() {
    const prev = liveRef.current;
    setPhotoAction(null);
    saveEdited(
      prev.freeform ? exitFreeform(prev, template, items, aspect) : enterFreeform(prev, items)
    );
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
    setEditingSticker(null);
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

  // ── 문구 인라인 편집 (v12) ──
  // v11의 '문구 수정' 바텀시트를 대체한다. 시트가 보드를 덮어 자기가 고치는 글자를 볼 수 없었고,
  // 그게 "입력 후 바로 수정이 안 된다"는 오너 피드백의 실체였다.

  /** 편집 중인 스티커 하나를 부분 갱신 — 텍스트는 DOM이 소유하므로 여기로 오지 않는다 */
  function patchSticker(id: string, patch: Partial<CollageSticker>) {
    const prev = liveRef.current;
    const cur = prev.stickers?.[id];
    if (!cur) return;
    saveEdited({ ...prev, stickers: { ...prev.stickers, [id]: { ...cur, ...patch } } });
  }

  /** 글자 커밋 — blur·완료·툴바 조작처럼 **IME 조합이 끝난** 시점에만 부른다.
   *  onInput마다 부르면 한글 조합 중 캐럿이 튄다 */
  function commitStickerText(id: string, raw: string) {
    const text = normalizeStickerText(raw);
    const prev = liveRef.current;
    if (!prev.stickers?.[id]) return;
    // 빈 문구는 삭제한다 — 안 그러면 아무것도 안 보이는 유령 항목이 보드에 남아
    // 나중에 사진을 탭하려는 손가락만 가로챈다
    if (!text) {
      handleStickerDelete(id);
      return;
    }
    if (prev.stickers[id].text === text) return;
    patchSticker(id, { text });
  }

  /** 새 문구 — 빈 채로 만들고 바로 편집에 들어간다. 프리셋은 툴바에 펼쳐져 있다.
   *
   *  ⚠️ **저장하지 않는다(commitLive).** 글자 없는 스티커를 저장하면 보이지 않는 유령 항목이
   *     디스크에 남고(탭을 그냥 닫으면 지울 기회가 없다), 저장 직후 loadBoard의 청소가
   *     방금 만든 초안을 그 자리에서 지워버려 **아예 쓸 수가 없다**(실측: 툴바가 안 뜸).
   *     첫 글자가 커밋될 때 saveEdited가 초안째 함께 저장한다. */
  function addSticker() {
    const prev = liveRef.current;
    const id = `s${Date.now()}`;
    const key = stickerKey(id);
    const sticker: CollageSticker = { id, text: '', style: 'chip' };
    const stickers = { ...prev.stickers, [id]: sticker };
    commitLive(() => ({
      ...prev,
      items: {
        ...prev.items,
        // 빈자리 탐색에 위임 — 같은 좌표에 계속 쌓여 "추가해도 안 늘어난다"가 되던 지점 (v12)
        [key]: newStickerLayoutItem(maxZ, aspect, { key, existing: prev.items, template, stickers }),
      },
      stickers,
      edited: true,
    }));
    setPhotoAction(null);
    setEditingSticker(id);
  }

  /** 편집 종료 — DOM이 들고 있는 글자를 마지막으로 한 번 거둬들인다 */
  function finishStickerEdit() {
    const id = editingSticker;
    setEditingSticker(null);
    if (!id) return;
    const el = boardRef.current?.querySelector<HTMLElement>('[data-sticker-edit]');
    if (el) commitStickerText(id, el.innerText);
  }

  /** 캐럿 자리에 줄바꿈 — 모바일 IME가 Enter를 '완료/다음'으로 먹기 때문에 전용 버튼이 필요하다.
   *
   *  ⚠️ Range로 텍스트 노드를 직접 꽂지 말 것. pre-wrap 안에서 브라우저가 텍스트 노드를 병합·정규화해
   *     `setStartAfter`로 잡아둔 캐럿 위치가 무효가 되고, 다음 글자가 줄바꿈 **앞**에 들어간다
   *     (실측: "I got everything" + 줄바꿈 + "I need" → "I got everythingI need\n").
   *     insertText는 브라우저가 캐럿까지 책임지므로 사용자가 직접 친 것과 같은 결과가 나온다. */
  function insertLineBreak() {
    const el = boardRef.current?.querySelector<HTMLElement>('[data-sticker-edit]');
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    // 캐럿이 스티커 밖(또는 없음)이면 끝으로 — 버튼이 아무 일도 안 하는 것보다 낫다
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) placeCaretAtEnd(el);
    if (!document.execCommand('insertText', false, '\n')) {
      el.innerText = `${el.innerText}\n`;
      placeCaretAtEnd(el);
    }
  }

  /** 문구 크기 — 모바일에서 ⤡ 정밀 드래그는 어렵다. 사진의 '크게/작게' 칩과 같은 문법 */
  function resizeSticker(id: string, dir: 1 | -1) {
    const prev = liveRef.current;
    const key = stickerKey(id);
    const it = prev.items[key];
    if (!it) return;
    saveEdited({
      ...prev,
      items: { ...prev.items, [key]: { ...it, w: clamp(it.w + dir * 0.04, STICKER_MIN_W, MAX_W) } },
    });
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
    setEditingSticker((cur) => (cur === id ? null : cur));
  }

  // 타이틀 카드 (v10~v11) — 상단 예약 밴드를 없애고 사진 위에 얹는다.
  // 기하·색은 collageTokens.titleLayoutFor가 단일 소스라 canvas(drawTitleCard)와 자동 락스텝이다.
  // ⚠️ 여기서 좌표를 계산하지 말 것 — 표시 리스트(titleLayout.lines)를 그리기만 한다
  const baseTitleCfg = titleConfigOf(template, live, titleGlobal);
  const titleCfg =
    titleScaleDraft !== null ? { ...baseTitleCfg, scale: titleScaleDraft } : baseTitleCfg;
  // 배경색은 세 템플릿 공통 — canvas(lib/wallpaper.ts)도 같은 themeFor()를 호출한다 (v9.0 락스텝).
  // boardVisuals로 묶어 축하 화면(BoardPreview)과 **같은 조립**을 쓴다 (v12)
  const { theme, titleLayout } = boardVisuals(template, bgColor, titleCfg, aspect);

  /** 위치는 기기·템플릿별 — 앵커를 고르면 자유 좌표를 버린다(프리셋으로 되돌아간다) */
  const setTitleAnchor = (anchor: TitleAnchor) =>
    saveEdited({ ...liveRef.current, title: { anchor, pos: undefined } });
  /** 모양은 전역 — 템플릿을 바꿔도 따라온다 */
  const setTitleGlobal = (patch: NonNullable<BoardData['collageTitle']>) =>
    onTitleGlobalChange?.(patch);
  /** '깔끔한 자리로' — 지금 카드 중심에서 가장 가까운 9점으로 스냅 */
  const snapTitleToAnchor = () => setTitleAnchor(nearestAnchor(titleLayout.box));
  // 편집 중인 문구 — 삭제·리로드로 사라졌으면 툴바도 함께 사라진다
  const editingStickerData = editingSticker ? live.stickers?.[editingSticker] : undefined;

  /** 항목마다 얹는 편집 핸들 — 그림은 BoardCanvasDom이, 조작은 여기가 담당한다 (v12 분리) */
  const itemOverlay = (key: string, isSticker: boolean) => (
    <>
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
      {/* 사진 액션 진입 배지 ⋯ (v12) — 교체·삭제는 v8.1부터 있었지만 아무 힌트가 없어
          "편집 진입 → 사진 탭 → 칩" 3단계를 아무도 발견하지 못했다(오너: "이미지 바꾸는
          프로세스가 안 보인다"). 롱프레스는 답이 아니다 — 비가시 제스처라 같은 병을 다른
          이름으로 재발시킬 뿐이다. 보이는 어포던스가 필요하다.
          ⚠️ 새 로직은 0이다 — 기존 setPhotoAction을 그대로 부르는 진입점만 추가한다 */}
      {editing && !isSticker && (onRequestReplace || onRequestRemove) && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPhotoAction((cur) => (cur === key ? null : key))}
          data-photo-menu-for={key}
          // ⚠️ 접근 이름에 '사진 바꾸기'를 넣지 말 것 — 이 배지가 여는 액션 칩의 이름이 정확히
          //    그것이라, 부분 일치로 잡는 셀렉터가 18개 배지와 칩을 한꺼번에 집어 모호해진다
          //    (기존 v81r2의 사진 교체 케이스가 그렇게 깨진다). 여는 쪽과 열리는 쪽의 이름은 달라야 한다
          aria-label="이 사진 손보기"
          className="absolute bottom-1 left-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center z-10 active:opacity-70"
        >
          <span className="text-caption leading-none pointer-events-none">⋯</span>
        </button>
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
      {/* 이동 핸들 ✥ (v12) — 편집 중인 문구에만 붙는다.
          ⚠️ 편집 중에는 글자 자체가 캐럿 타깃이라 드래그 핸들러를 붙일 수 없다
             (onItemPointerDown이 preventDefault를 불러 포커스를 죽인다). 그래서 이동은
             전용 핸들이 맡는다 — 글자를 탭하면 캐럿, ✥를 끌면 이동으로 역할이 눈에 보인다.
          ⚠️ 표식은 `data-move-for` — `data-resize-for`를 쓰면 기존 스위트의 사진 핸들
             셀렉터(v85r1 V85-8d)가 이걸 집는다 */}
      {editing && isSticker && editingSticker === key.slice('sticker:'.length) && (
        <div
          onPointerDown={(e) => onItemPointerDown(e, key, 'move')}
          data-move-for={key}
          aria-label="문구 옮기기"
          className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-white shadow-md border border-[#E5E3DF] flex items-center justify-center cursor-move z-10"
          style={{ touchAction: 'none' }}
        >
          <span className="text-micro text-[#6E6962] leading-none pointer-events-none">✥</span>
        </div>
      )}
    </>
  );

  return (
    <div>
      {/* 사용법 안내 (v9.0) — 보드 아래 회색 잔글씨는 "안 보인다"는 오너 피드백.
          보드 바로 위 알약으로 올리고 대비·크기를 키워 여백 텍스트가 아니라 UI로 읽히게 했다.
          PC 뷰는 보드가 넓어 하단 중앙이 시야 밖이라 상단 앵커가 특히 유효하다 */}
      <BoardCanvasDom
        testId="collage-board"
        view={view}
        template={template}
        items={items}
        layout={live}
        aspect={aspect}
        theme={theme}
        titleLayout={titleLayout}
        year={year}
        boardRef={boardRef}
        editing={editing}
        settling={settling}
        brokenKeys={brokenKeys}
        onPhotoError={markBroken}
        onYearChange={onYearChange}
        onItemPointerDown={onItemPointerDown}
        onBoardPointerDown={onBoardPointerDown}
        onBoardPointerUp={editing ? onPointerUp : onBoardPointerUp}
        onBoardPointerMove={onPointerMove}
        onBoardPointerCancel={onPointerUp}
        editingStickerId={editingSticker}
        onStickerCommit={commitStickerText}
        itemOverlay={itemOverlay}
        titleOverlay={
          /* ⚠️ 핸들은 카드 **안쪽**에 둔다 (v11). 사진 핸들처럼 -bottom-2 -right-2로 띄우면
             카드 밖 24px가 새로 클릭을 삼켜, 그 자리 사진을 탭할 수 없게 된다 —
             verify-v10r1 V10-7a가 실제로 여기 걸렸다. 카드가 이미 가리는 영역 안에 두면
             새로 막히는 곳이 0이다 */
          editing ? (
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
          ) : null
        }
      >
        {/* 문구 편집 툴바 (v12) — 시트를 대체한다. 글자는 보드 위에서 직접 고치고,
            여기는 키보드로 못 하는 것(스타일·색·크기·줄바꿈·삭제)만 맡는다.
            편집 중인 문구가 아래쪽이면 위로 뒤집어 자기가 치는 글자를 안 덮게 한다 */}
        {editing && editingStickerData && (
          <StickerToolbar
            sticker={editingStickerData}
            anchor={(live.items[stickerKey(editingSticker!)]?.y ?? 0) > 0.55 ? 'top' : 'bottom'}
            canStraighten={!!live.items[stickerKey(editingSticker!)]?.rot}
            onPreset={(text, style) => {
              // 프리셋은 글자를 통째로 갈아끼운다 — DOM도 같이 갱신해야 blur 때 옛 글자가 되살아나지 않는다
              const el = boardRef.current?.querySelector<HTMLElement>('[data-sticker-edit]');
              if (el) el.innerText = text;
              patchSticker(editingSticker!, { text, style });
            }}
            onStyle={(style) => patchSticker(editingSticker!, { style })}
            onColor={(color) => patchSticker(editingSticker!, { color })}
            onLineBreak={insertLineBreak}
            onResize={(dir) => resizeSticker(editingSticker!, dir)}
            onStraighten={() => straighten(stickerKey(editingSticker!))}
            onDelete={() => handleStickerDelete(editingSticker!)}
            onDone={finishStickerEdit}
          />
        )}

        {/* 편집 가이드 (v10) — 보드 **안쪽** 하단 플로팅.
            v9는 보드 위 알약이었는데, 타이틀 예약이 사라지며 보드가 커진 만큼 페이지 세로 예산이
            부족해졌다(PC 무스크롤 V87-4d ↔ 보드 폭 ≥1000 V87-4e가 반대 방향). 안으로 넣으면
            페이지 높이를 0 먹으면서 대비는 오히려 좋아진다.
            감상 모드에서는 띄우지 않는다 — 배경화면 미리보기를 글자가 덮으면 안 되고,
            진입 어포던스는 '✎ 탭해서 편집' 버튼이 이미 맡고 있다 */}
        {/* ⚠️ 문구 편집 중에는 숨긴다 — 힌트 알약과 문구 툴바가 둘 다 보드 하단에 떠 겹친다.
            게다가 그 순간의 안내는 툴바 자체가 이미 하고 있다 */}
        {editing && !editingStickerData && (
          <p
            data-testid="board-hint"
            className="absolute bottom-[2.5cqmin] inset-x-[6cqmin] z-40 mx-auto w-fit max-w-full rounded-full bg-black/60 px-[3cqmin] py-[1.4cqmin] text-white text-center pointer-events-none"
            style={{ fontSize: '2.6cqmin' }}
          >
            {spec
              ? '사진을 끌어 자리를 바꾸고, ⋯ 를 누르면 바꾸거나 지울 수 있어. 원하는 자리에 두려면 위 🔓 를 눌러봐.'
              : '자유 배치야 — 원하는 곳에 두고 ⤡ 크기·↻ 각도까지 바꿀 수 있어. 🔒 를 누르면 배치는 보관해두고 다시 정렬해.'}
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
            className="absolute top-[2.5cqmin] right-[2.5cqmin] z-50 rounded-full bg-black/45 text-white font-medium px-[3cqmin] backdrop-blur-sm active:opacity-70 flex items-center justify-center"
            // ⚠️ 에디토리얼은 풀블리드라 '빈 곳 탭'이 성립하지 않는다 — 이 버튼이 사실상
            //    유일한 편집 진입점이다. cqmin 패딩만 쓰면 폰에서 높이가 8px까지 내려가
            //    "눌러도 안 눌린다"가 된다. 최소 44px는 절대 단위로 못 박는다 (v12)
            style={{ fontSize: '2.8cqmin', minHeight: 44 }}
          >
            ✎ 탭해서 편집
          </button>
        )}

        {/* 편집 툴바 — 보드 상단 플로팅 */}
        {editing && (
          <div
            className="absolute top-2 inset-x-2 flex items-center gap-1.5 z-50"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {/* ⚠️ 가로 스크롤 + nowrap이 필수다 (v12). 폰 뷰 보드는 약 321px인데 버튼이 5개라
                줄바꿈을 허용하면 라벨이 전부 두 줄로 쪼개진다("기본 배 / 치로") — 실제로 그렇게 깨졌다.
                '완료'만 오른쪽에 고정해 스크롤 위치와 무관하게 항상 닿을 수 있게 둔다 */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar min-w-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
              {/* '기본 배치로'는 유일하게 되돌릴 수 없는 동작이다 (자유 배치는 v12에서 왕복 무손실이
                  됐고, 문구·사진은 다시 만들 수 있다). 모달 없이 **한 번 더 묻는다** — 탭 한 번에
                  배치가 통째로 날아가는 건 실수 비용이 너무 크다. 5초 뒤 저절로 원래 라벨로 돌아간다 */}
              <button
                onClick={() => {
                  if (!resetArmed) {
                    setResetArmed(true);
                    if (resetTimer.current) window.clearTimeout(resetTimer.current);
                    resetTimer.current = window.setTimeout(() => setResetArmed(false), 5000);
                    return;
                  }
                  setResetArmed(false);
                  resetLayout();
                }}
                aria-label="기본 배치로"
                className={`px-3 py-1.5 rounded-full text-caption font-medium active:opacity-70 ${
                  resetArmed ? 'bg-[#B91C1C] text-white' : 'bg-black/60 text-white'
                }`}
              >
                {resetArmed ? '정말 되돌릴까?' : '기본 배치로'}
              </button>
              <button
                onClick={addSticker}
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
                  명시적 탈출구. 자동 정렬이 조용히 죽는 대신 사용자가 켜고 끈다.
                  v12: 라벨을 "무엇을 할 수 있는가"로 바꿨다 — '자유 배치'는 상태 이름이라
                  눌러도 되는 건지 알 수 없었고, 그게 이 기능이 안 쓰인 이유의 절반이다.
                  ⚠️ aria-label은 '자유 배치'를 유지한다 — verify-v10r1 V10-8a/8b가 이 이름으로 잡는다 */}
              <button
                onClick={toggleFreeform}
                aria-pressed={!spec}
                aria-label="자유 배치"
                className={`px-3 py-1.5 rounded-full text-caption font-medium active:opacity-70 ${
                  spec ? 'bg-black/60 text-white' : 'bg-white text-[#1C1B19] shadow'
                }`}
              >
                {spec ? '🔓 자유롭게 옮기기' : '🔒 다시 정렬'}
              </button>
            </div>
            <button
              onClick={() => switchEditing(false)}
              className="ml-auto shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full bg-white text-[#1C1B19] text-caption font-bold shadow active:opacity-70"
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
      </BoardCanvasDom>

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
