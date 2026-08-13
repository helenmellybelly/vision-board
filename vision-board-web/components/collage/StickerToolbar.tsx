'use client';

import { CollageSticker, StickerStyle } from '@/lib/types';
import { STICKER_PRESETS } from '@/lib/collageTemplates';

// 문구 편집 툴바 (v12) — v11의 '문구 수정' 바텀시트를 대체한다.
//
// 왜 시트를 없앴나: 시트가 보드를 덮어서 **자기가 고치는 글자가 안 보였다**. 크기를 바꾸거나
// 줄을 나눠도 결과를 확인하려면 시트를 닫아야 했고, 그게 "입력 후 바로 수정이 안 된다"는
// 오너 피드백의 실체였다. 이제 글자는 보드 위에서 직접 고치고(StickerView contentEditable),
// 이 툴바는 키보드로 못 하는 것(스타일·색·크기·줄바꿈·삭제)만 맡는다.
//
// ⚠️ 보드 **안쪽** 플로팅이다. 페이지 크롬에 붙이면 --board-reserve 예산이 늘어 PC 보드 폭
//    (V87-4e)이 줄고 무스크롤(V87-4d)이 깨진다. v10 가이드 알약·v11 타이틀 시트가 같은 이유로
//    각각 보드 안·fixed 오버레이로 갔다.
// ⚠️ 편집 중인 스티커가 아래쪽에 있으면 위로 뒤집는다 — 안 그러면 자기가 치는 글자를 툴바가 덮는다.
export default function StickerToolbar({
  sticker,
  anchor,
  canStraighten,
  onPreset,
  onStyle,
  onColor,
  onLineBreak,
  onResize,
  onStraighten,
  onDelete,
  onDone,
}: {
  sticker: CollageSticker;
  /** 'bottom' | 'top' — 편집 중인 스티커 반대편에 붙는다 */
  anchor: 'bottom' | 'top';
  canStraighten: boolean;
  onPreset: (text: string, style: StickerStyle) => void;
  onStyle: (style: StickerStyle) => void;
  onColor: (color: string) => void;
  onLineBreak: () => void;
  onResize: (dir: 1 | -1) => void;
  onStraighten: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  return (
    <div
      data-testid="sticker-toolbar"
      // 보드의 드래그 엔진에 이벤트가 새면 툴바를 누르는 순간 스티커가 끌린다
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      // ⚠️ mousedown 기본동작을 막아야 버튼을 눌러도 글자의 포커스·캐럿이 살아 있다.
      //    안 막으면 '줄바꿈' 버튼을 누르는 순간 blur가 나서 어디에 줄을 넣을지 알 수 없게 된다
      onMouseDown={(e) => e.preventDefault()}
      // ⚠️ top일 때 top-12로 내려야 한다 — 보드 상단에는 이미 편집 툴바(기본 배치로·+ 문구·…)가
      //    top-2에 떠 있고, top-1에 두면 프리셋 행이 그 아래로 완전히 가려진다(실측).
      //    프리셋이 안 보이면 "뭘 쓰지"를 없애는 기능 자체가 죽고 verify-v76r1 V6-7도 깨진다
      className={`absolute inset-x-1 z-50 rounded-2xl bg-black/75 backdrop-blur-sm p-1.5 space-y-1 ${
        anchor === 'bottom' ? 'bottom-1' : 'top-12'
      }`}
    >
      {/* 프리셋 — 빈 문구로 시작했을 때 "뭘 쓰지"를 없애는 가장 빠른 길 */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar" role="group" aria-label="문구 프리셋">
        {STICKER_PRESETS.map((p) => (
          <button
            key={p.text}
            onClick={() => onPreset(p.text, p.style)}
            className="shrink-0 px-2.5 py-1.5 rounded-full bg-white/15 text-white text-micro font-medium active:opacity-60 whitespace-nowrap"
          >
            {p.text}
          </button>
        ))}
      </div>

      {/* 스타일 + 손글씨 색 */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        <div className="flex gap-0.5 shrink-0 rounded-full bg-white/10 p-0.5" role="radiogroup" aria-label="스티커 스타일">
          {STYLE_LABELS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={sticker.style === s.id}
              onClick={() => onStyle(s.id)}
              className={`px-2.5 py-1 rounded-full text-micro font-semibold whitespace-nowrap ${
                sticker.style === s.id ? 'bg-white text-[#1C1B19]' : 'text-white/80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* 색은 손글씨에만 — 칩은 흰 배경 고정, 아웃라인은 흰 채움+검정 외곽선이 스타일 자체다 */}
        {sticker.style === 'script' && (
          <div className="flex items-center gap-1.5 shrink-0 pl-1" role="radiogroup" aria-label="글자색">
            {SCRIPT_COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={sticker.color === c}
                onClick={() => onColor(c)}
                className={`w-5 h-5 rounded-full border border-white/40 ${
                  sticker.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-black/60' : ''
                }`}
                style={{ backgroundColor: c }}
                aria-label={`글자색 ${c}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 조작 — 키보드로 못 하는 것들 */}
      <div className="flex items-center gap-1">
        {/* ⚠️ 모바일 IME는 Enter를 '완료/다음'으로 먹는다. 줄바꿈에 전용 버튼이 필요한 이유이고,
            E2E에도 결정적인 손잡이가 된다 */}
        <Chip onClick={onLineBreak} label="줄바꿈">↵ 줄바꿈</Chip>
        <div className="flex items-center rounded-full bg-white/15 overflow-hidden">
          <button onClick={() => onResize(-1)} aria-label="문구 작게" className="px-2.5 py-1.5 text-white text-micro active:opacity-60">➖</button>
          <span className="text-white/60 text-micro px-0.5">크기</span>
          <button onClick={() => onResize(1)} aria-label="문구 크게" className="px-2.5 py-1.5 text-white text-micro active:opacity-60">➕</button>
        </div>
        {canStraighten && <Chip onClick={onStraighten} label="바로 세우기">↻</Chip>}
        <Chip onClick={onDelete} label="문구 삭제" tone="danger">🗑</Chip>
        <button
          onClick={onDone}
          className="ml-auto shrink-0 px-3 py-1.5 rounded-full bg-white text-[#1C1B19] text-micro font-bold active:opacity-70"
        >
          완료
        </button>
      </div>
    </div>
  );
}

function Chip({
  onClick,
  label,
  tone,
  children,
}: {
  onClick: () => void;
  label: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`shrink-0 px-2.5 py-1.5 rounded-full text-micro font-medium active:opacity-60 whitespace-nowrap ${
        tone === 'danger' ? 'bg-[#B91C1C]/80 text-white' : 'bg-white/15 text-white'
      }`}
    >
      {children}
    </button>
  );
}

const STYLE_LABELS: { id: StickerStyle; label: string }[] = [
  { id: 'script', label: '손글씨' },
  { id: 'chip', label: '라벨' },
  { id: 'outline', label: '아웃라인' },
];

// script 스타일 글자색 — 다크/라이트 보드 양쪽에서 보이는 색만 제공 (v11 StickerSheet에서 승계)
const SCRIPT_COLORS = ['#FFFFFF', '#1C1B19', '#E8B4C8', '#A5B4FC', '#C9A86A'];
