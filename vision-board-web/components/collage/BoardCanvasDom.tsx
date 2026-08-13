'use client';

import React from 'react';
import { BoardData, CollageLayout, CollageLayoutItem, CollageTemplate } from '@/lib/types';
import { CollageItem, themeFor, titleFor } from '@/lib/collageTemplates';
import {
  AMBIENT_SCALE,
  AMBIENT_SCRIM_ALPHA,
  TITLE_LABEL_TEXT,
  TitleConfig,
  TitleLayout,
  titleLayoutFor,
} from '@/lib/collageTokens';
import { SECTIONS } from '@/lib/questions';
import { SectionId } from '@/lib/types';
import { displaySrc } from '@/lib/imageSrc';
import EditableYear from './EditableYear';
import StickerView from './StickerView';

// ══════════════════════════════════════════════════════════════════════
// 보드의 **그림**만 담당하는 표현 컴포넌트 (v12).
//
// 왜 생겼나: 보드를 그리는 코드가 세 벌이었다 — CollageBoard(DOM), lib/wallpaper.ts(canvas),
// 그리고 MiniBoardPreview. 셋째는 collageTemplate·collageLayouts·collageBgColor를 한 줄도
// 읽지 않는 별개의 6칸 숲 그리드였고, 그래서 '비전보드 완성됐어' 화면이 사용자가 고른
// 템플릿과 무관한 옛 그림을 보여줬다(오너 신고).
//
// 이제 DOM 렌더러는 여기 하나다. CollageBoard는 이 위에 편집 엔진을 얹고,
// BoardPreview는 그대로 보여주기만 한다. canvas와의 락스텝은 예전처럼
// collageTokens(titleLayoutFor·STICKER_*)가 단일 소스라 유지된다.
//
// ⚠️ 이 컴포넌트는 상태가 없다. 배치를 계산하지도, 저장하지도 않는다 —
//    받은 layout을 그리기만 한다. 편집 관련 표식(data-testid·data-photo)은 전부 보존한다:
//    30여 개 회귀 스위트가 그 셀렉터에 걸려 있다.
// ══════════════════════════════════════════════════════════════════════

/** #RRGGBB + 알파 → rgba(). canvas(withAlpha)와 같은 규칙이라 타이틀 카드 색이 락스텝이다 */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 사진 키 `${sectionId}-${slotIdx}` → 출처 섹션 배지 (v8.1 편집 모드) */
export function sectionBadge(key: string): { color: string; label: string } | null {
  const m = /^(\d+)-\d+$/.exec(key);
  if (!m) return null;
  const section = SECTIONS.find((s) => s.id === (Number(m[1]) as SectionId));
  if (!section) return null;
  return { color: section.color, label: section.shortTitle ?? section.title.split(' — ')[0] };
}

/**
 * 테마와 타이틀 기하를 한 번에 — CollageBoard와 BoardPreview가 **같은 함수**를 부른다.
 * 각자 조립하면 축하 화면과 편집 화면의 타이틀이 어긋난다.
 */
export function boardVisuals(
  template: CollageTemplate,
  bgColor: string | undefined,
  titleCfg: TitleConfig,
  aspect: number,
): { theme: ReturnType<typeof themeFor>; titleLayout: TitleLayout } {
  const theme = themeFor(template, bgColor);
  return { theme, titleLayout: titleLayoutFor(titleCfg, aspect, theme.bg) };
}

/** 저장된 배치 + 전역 설정 → 타이틀 설정. 두 소비처가 같은 접기 규칙을 쓰게 한다 */
export function titleConfigOf(
  template: CollageTemplate,
  layout: CollageLayout,
  titleGlobal: BoardData['collageTitle'] | undefined,
): TitleConfig {
  return titleFor(template, layout.title, titleGlobal);
}

export interface BoardCanvasDomProps {
  /** 'collage-board'(편집) 또는 'board-preview'(읽기 전용).
   *  ⚠️ 프리뷰가 'collage-board'를 쓰면 보드 개수를 세는 스위트(v81r2 V-3c)가 깨진다 */
  testId: string;
  view?: string;
  template: CollageTemplate;
  items: CollageItem[];
  /** 이미 resolveLayout을 통과한 배치 */
  layout: CollageLayout;
  aspect: number;
  theme: ReturnType<typeof themeFor>;
  titleLayout: TitleLayout;
  year: string;
  className?: string;
  style?: React.CSSProperties;

  // ── 아래는 편집 화면에서만 채워진다. 없으면 순수 표시 ──
  boardRef?: React.Ref<HTMLDivElement>;
  editing?: boolean;
  settling?: boolean;
  brokenKeys?: Set<string>;
  onPhotoError?: (key: string) => void;
  onYearChange?: (year: string) => void;
  onItemPointerDown?: (e: React.PointerEvent, key: string, mode: 'move' | 'resize' | 'rotate') => void;
  onBoardPointerDown?: (e: React.PointerEvent) => void;
  onBoardPointerUp?: (e: React.PointerEvent) => void;
  onBoardPointerMove?: (e: React.PointerEvent) => void;
  onBoardPointerCancel?: (e: React.PointerEvent) => void;
  /** 인라인 편집 중인 스티커 id (v12) */
  editingStickerId?: string | null;
  onStickerCommit?: (id: string, text: string) => void;
  /** 항목마다 얹을 핸들·배지 (편집 모드) */
  itemOverlay?: (key: string, isSticker: boolean) => React.ReactNode;
  /** 타이틀 카드 **안쪽**에 얹을 핸들 (v11 — 밖에 두면 그 자리 사진을 못 누른다) */
  titleOverlay?: React.ReactNode;
  /** 보드 위 플로팅 (툴바·힌트·액션 칩·고스트 프리뷰) */
  children?: React.ReactNode;
}

export default function BoardCanvasDom({
  testId, view, template, items, layout, aspect, theme, titleLayout, year, className, style,
  boardRef, editing, settling, brokenKeys, onPhotoError, onYearChange, onItemPointerDown,
  onBoardPointerDown, onBoardPointerUp, onBoardPointerMove, onBoardPointerCancel,
  editingStickerId, onStickerCommit, itemOverlay, titleOverlay, children,
}: BoardCanvasDomProps) {
  const spec = layout.freeform ? null : layout.spec ?? null;
  // 앰비언트 배경 (v10) — 크롭 없이 꽉 채울 수 없는 배치에서만 존재한다
  const ambientSrc = spec?.ambient ? items.find((i) => i.key === spec.ambient)?.src : undefined;
  const broken = brokenKeys ?? EMPTY_SET;

  return (
    <div
      ref={boardRef}
      data-testid={testId}
      data-view={view}
      className={`relative w-full mx-auto rounded-3xl overflow-hidden select-none ${className ?? ''}`}
      style={{
        aspectRatio: String(aspect),
        // 배경색은 사용자가 고른 단색 (v9.0) — canvas renderBoardLayout과 같은 themeFor() 결과
        background: theme.bg,
        border: theme.dark ? 'none' : '1px solid #E5E3DF',
        // ⚠️ containerType과 아래 maxWidth는 **같은 요소**에 있어야 한다 (v12 추출 시 계약).
        //    cqi/cqmin이 전부 이 컨테이너 기준이라, 둘을 떼면 스티커·타이틀 폰트가 통째로 어긋난다
        containerType: 'size',
        // 높이 예산 (v8.2) — 예산은 부모가 --board-reserve로 주입(기본 19rem 폴백)
        maxWidth: `min(100%, calc((100dvh - var(--board-reserve, 19rem)) * ${aspect}))`,
        touchAction: editing ? 'none' : 'auto',
        ...style,
      }}
      onPointerDown={onBoardPointerDown}
      onPointerUp={onBoardPointerUp}
      onPointerMove={onBoardPointerMove}
      onPointerCancel={onBoardPointerCancel}
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
      {Object.entries(layout.items)
        .sort(([, a], [, b]) => a.z - b.z)
        .map(([key, it]) => {
          const isSticker = key.startsWith('sticker:');
          const stickerId = isSticker ? key.slice('sticker:'.length) : '';
          const sticker = isSticker ? layout.stickers?.[stickerId] : undefined;
          const src = isSticker ? undefined : items.find((i) => i.key === key)?.src;
          if (!sticker && !src) return null;
          const isEditingThis = isSticker && editingStickerId === stickerId;
          return (
            <div
              key={key}
              // 항목 래퍼의 주소 (v12) — 스티커 실측 높이를 재고, E2E가 항목 상자를 직접 집는다.
              // data-photo는 <img>에 붙어 있어 스티커에는 없고, 래퍼 자체를 가리키는 표식이 없었다
              data-item={key}
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
              // ⚠️ 인라인 편집 중인 스티커에는 이 핸들러를 붙이지 않는다 (v12).
              //    onItemPointerDown이 preventDefault를 부르므로 붙어 있으면 캐럿이 안 잡힌다.
              //    이동은 전용 ✥ 핸들이 맡는다 — 사용자가 무엇을 집는지 눈에 보인다는 뜻이기도 하다
              onPointerDown={
                onItemPointerDown && !isEditingThis ? (e) => onItemPointerDown(e, key, 'move') : undefined
              }
            >
              {sticker ? (
                <StickerView
                  // 편집 진입/이탈에만 리마운트 — 편집 중에는 DOM을 브라우저가 소유해 캐럿이 산다
                  key={isEditingThis ? `${key}:edit` : `${key}:${sticker.text}`}
                  sticker={sticker}
                  it={it}
                  dark={theme.dark}
                  editable={isEditingThis}
                  onCommit={(text) => onStickerCommit?.(stickerId, text)}
                />
              ) : (() => {
                const badge = editing ? sectionBadge(key) : null;
                return (
                  // v7.6 프레임리스 — 흰 폴라로이드 프레임 제거, 전 템플릿 사진만 + 라운드·그림자.
                  // 편집 모드의 링은 출처 섹션 색 2px — 어느 칸의 사진인지 보드 위에서 바로 보인다 (v8.1)
                  <div
                    className={`w-full h-full rounded-xl overflow-hidden ${
                      // 어두운 배경에서는 그림자가 안 보인다 — 밝은 링으로 바꿔야 사진 경계가 산다 (v9.0)
                      theme.dark ? 'shadow-none ring-1 ring-white/15' : 'shadow-sm'
                    } ${editing && !badge ? (theme.dark ? 'ring-1 ring-white/40' : 'ring-1 ring-black/15') : ''}`}
                    style={editing && badge ? { boxShadow: `0 0 0 2px ${badge.color}` } : undefined}
                  >
                    {broken.has(key) ? (
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        // displaySrc (v8.7) — 캔버스 내보내기와 동일한 URL·동일한 CORS 모드.
                        // 캐시 엔트리를 공유해야 저장 시 재로드가 없고, onError가 내보내기 실패와
                        // 같은 조건에서 발화해 ⚠️ 타일·저장 경고가 비로소 진실해진다.
                        src={displaySrc(src ?? '')}
                        alt=""
                        // 앰비언트 배경도 <img>라 검증이 사진과 구분할 표식이 필요하다 (v10)
                        data-photo={key}
                        draggable={false}
                        // v10 — 전 템플릿 단일 경로(cover). 박스가 사진의 원본 비율에 맞춰 만들어지므로
                        // cover가 잘라낼 게 거의 없다(crop ≤ 6%가 계약). canvas drawCover와 락스텝
                        className={`w-full object-cover pointer-events-none ${it.h !== undefined ? 'h-full' : 'aspect-square'}`}
                        onError={() => onPhotoError?.(key)}
                      />
                    )}
                    {/* 출처 섹션 칩 (v8.1) — 편집 모드에서만, 좌상단 */}
                    {badge && (
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
              {itemOverlay?.(key, isSticker)}
            </div>
          );
        })}

      {/* 타이틀 카드 (v10~v11) — 사진 **위에** 얹힌다. v9의 상단 예약 밴드를 없앤 만큼 사진이 커졌다.
          v11부터 좌표·색을 여기서 계산하지 않는다: titleLayoutFor의 표시 리스트를 그리기만 해
          canvas drawTitleCard와 구조적으로 락스텝이다.
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
            const grabbable = editing && onItemPointerDown;
            const grabCls = grabbable ? 'pointer-events-auto cursor-move' : '';
            const grabStyle = grabbable ? { ...style, touchAction: 'none' as const } : style;
            if (l.kind === 'label') {
              return (
                <span
                  key="label"
                  className={`font-semibold ${grabCls}`}
                  style={grabStyle}
                  onPointerDown={grabbable ? (e) => onItemPointerDown!(e, TITLE_KEY, 'move') : undefined}
                >
                  {TITLE_LABEL_TEXT}
                </span>
              );
            }
            // 감상 모드에서만 연도 인라인 편집 — 편집 모드에서는 글자가 드래그 핸들이라
            // 탭이 시트를 열어야 한다(연도는 시트 안에서 고친다)
            if (grabbable) {
              return (
                <span
                  key="year"
                  className={`font-script font-bold ${grabCls}`}
                  style={grabStyle}
                  onPointerDown={(e) => onItemPointerDown!(e, TITLE_KEY, 'move')}
                >
                  {year}
                </span>
              );
            }
            return onYearChange ? (
              <span key="year" className="pointer-events-auto" style={style}>
                <EditableYear
                  year={year}
                  onYearChange={onYearChange}
                  className="font-script font-bold"
                  style={{ color: l.color, fontSize: 'inherit', letterSpacing: 'inherit' }}
                />
              </span>
            ) : (
              // 읽기 전용(축하 화면) — 연도를 고칠 수 있는 것처럼 보이면 안 된다
              <span key="year" className="font-script font-bold" style={style}>
                {year}
              </span>
            );
          })}
          {titleOverlay}
        </div>
      )}

      {children}
    </div>
  );
}

const EMPTY_SET: Set<string> = new Set();

/** 타이틀 카드의 드래그 키 — items 맵에 넣지 않는다 (v11).
 *  넣으면 photoAtPoint·withStickers·resolveLayout·applySpec·wallpaper z정렬·bringToFront·
 *  isLayoutBroken 일곱 곳이 전부 이걸 사진으로 오인한다. 좌표는 layout.title.pos에 산다 */
export const TITLE_KEY = 'title';
