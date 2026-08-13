'use client';

import { BoardData } from '@/lib/types';
import {
  TITLE_ANCHORS,
  TITLE_LABEL_TEXT,
  TITLE_SCALE_MAX,
  TITLE_SCALE_MIN,
  TitleAnchor,
  TitleConfig,
} from '@/lib/collageTokens';
import BottomSheet from './BottomSheet';

type Patch = NonNullable<BoardData['collageTitle']>;

interface Props {
  cfg: TitleConfig;
  year: string;
  onYearChange: (year: string) => void;
  /** 위치 — 기기·템플릿별(CollageLayout.title) */
  onAnchorChange: (anchor: TitleAnchor) => void;
  /** 모양 — 전역(BoardData.collageTitle) */
  onGlobalChange: (patch: Patch) => void;
  /** 자유 좌표일 때만 — 가장 가까운 9점으로 스냅 */
  onSnapToAnchor?: () => void;
  onClose: () => void;
}

// 9칸 격자는 시각적으로만 위치를 알려주므로 aria 라벨이 필수다
const ANCHOR_LABELS: Record<TitleAnchor, string> = {
  tl: '왼쪽 위', tc: '가운데 위', tr: '오른쪽 위',
  ml: '왼쪽 가운데', mc: '정중앙', mr: '오른쪽 가운데',
  bl: '왼쪽 아래', bc: '가운데 아래', br: '오른쪽 아래',
};

const OPTIONS = {
  parts: [
    { id: 'all', label: '전체' },
    { id: 'label', label: '문구만' },
    { id: 'year', label: '연도만' },
    { id: 'none', label: '숨기기' },
  ],
  style: [
    { id: 'band', label: '밴드' },
    { id: 'bold', label: '볼드' },
    { id: 'line', label: '라인' },
  ],
  dir: [
    { id: 'v', label: '세로' },
    { id: 'h', label: '가로' },
  ],
  bg: [
    { id: 'solid', label: '불투명' },
    { id: 'soft', label: '반투명' },
    { id: 'clear', label: '투명' },
  ],
  ink: [
    { id: 'auto', label: '자동' },
    { id: 'light', label: '밝게' },
    { id: 'dark', label: '어둡게' },
  ],
} as const;

/** 라디오 한 줄 — 터치 타깃 44px(h-11)를 지킨다 */
function Row({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-caption text-[#6E6962] mb-1.5">{label}</p>
      <div className="flex gap-1.5 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onSelect(o.id)}
            className={`flex-1 h-11 rounded-lg text-caption font-semibold transition-colors ${
              value === o.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 타이틀 설정 시트 (v11) — v10의 보드 안 9점 패널을 대체한다.
 *
 * 왜 시트인가: 컨트롤이 6종으로 늘어 모바일 보드 폭(390px 화면에서 약 294px)에 얹으면 보드를
 * 거의 다 가린다. 페이지 크롬에 붙이는 안은 --board-reserve 예산을 늘려 PC 보드 폭 계약
 * (verify-v87r1 V87-4e)을 건드린다. 시트는 fixed 오버레이라 페이지 높이를 0 먹는다.
 *
 * 확인/취소 없이 즉시 반영한다 — 뒤에서 보드가 실시간으로 바뀌는 게 이 시트의 미리보기다.
 * (그래서 높이를 62dvh로 조여 보드 상단이 보이게 둔다)
 */
export default function TitleSheet({
  cfg, year, onYearChange, onAnchorChange, onGlobalChange, onSnapToAnchor, onClose,
}: Props) {
  const hidden = cfg.parts === 'none';
  const pct = Math.round(cfg.scale * 100);

  return (
    <BottomSheet
      titleId="title-sheet-title"
      heading="타이틀 꾸미기"
      desc="'VISION BOARD'와 연도를 원하는 대로 — 보드에서 직접 끌어 옮기고 ⤡로 키울 수도 있어."
      height="mid"
      onClose={onClose}
    >
      <div data-testid="title-sheet">
        <Row
          label="타이틀 표시"
          options={OPTIONS.parts}
          value={cfg.parts}
          onSelect={(parts) => onGlobalChange({ parts })}
        />

        {!hidden && (
          <>
            <Row
              label="타이틀 스타일"
              options={OPTIONS.style}
              value={cfg.style}
              onSelect={(style) => onGlobalChange({ style })}
            />
            {cfg.parts === 'all' && (
              <Row
                label="타이틀 배치"
                options={OPTIONS.dir}
                value={cfg.dir}
                onSelect={(dir) => onGlobalChange({ dir })}
              />
            )}
            <Row
              label="타이틀 배경"
              options={OPTIONS.bg}
              value={cfg.bg}
              onSelect={(bg) => onGlobalChange({ bg })}
            />
            {/* 카드가 반투명·투명이면 뒤에 사진이 비쳐 자동 판정이 빗나갈 수 있다 —
                그때만 수동 반전을 연다 (불투명 카드에서는 자동이 항상 맞다) */}
            {cfg.bg !== 'solid' && (
              <Row
                label="타이틀 글자색"
                options={OPTIONS.ink}
                value={cfg.ink}
                onSelect={(ink) => onGlobalChange({ ink })}
              />
            )}

            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-caption text-[#6E6962]">타이틀 크기</p>
                <p className="text-caption font-semibold text-[#1C1B19]">{pct}%</p>
              </div>
              <input
                type="range"
                aria-label="타이틀 크기"
                aria-valuetext={`${pct}%`}
                min={Math.round(TITLE_SCALE_MIN * 100)}
                max={Math.round(TITLE_SCALE_MAX * 100)}
                step={5}
                value={pct}
                onChange={(e) => onGlobalChange({ scale: Number(e.target.value) / 100 })}
                className="w-full h-11 accent-[#1C1B19]"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-caption text-[#6E6962]">타이틀 위치</p>
                {onSnapToAnchor && (
                  <button onClick={onSnapToAnchor} className="text-caption font-semibold text-[#1C1B19] underline">
                    깔끔한 자리로
                  </button>
                )}
              </div>
              <div role="radiogroup" aria-label="타이틀 위치" className="grid grid-cols-3 gap-1.5">
                {TITLE_ANCHORS.map((a) => {
                  // 자유 좌표를 쓰는 중이면 9점 중 어느 것도 '현재'가 아니다
                  const on = !cfg.pos && cfg.anchor === a;
                  return (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={on}
                      aria-label={`타이틀 ${ANCHOR_LABELS[a]}`}
                      onClick={() => onAnchorChange(a)}
                      className={`h-11 rounded-lg border transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        on ? 'bg-[#1C1B19] border-[#1C1B19]' : 'bg-[#F1EFEA] border-[#E5E3DF] active:bg-[#E5E3DF]'
                      }`}
                    >
                      <span
                        className={`block w-4 h-[2px] mx-auto rounded-full ${on ? 'bg-white' : 'bg-[#8A8784]'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {cfg.parts !== 'label' && (
              <div className="mb-4">
                <label htmlFor="title-sheet-year" className="block text-caption text-[#6E6962] mb-1.5">
                  목표 연도
                </label>
                <input
                  id="title-sheet-year"
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (v.length === 4) onYearChange(v);
                  }}
                  className="w-full h-11 rounded-xl border border-[#E5E3DF] px-4 text-body focus:border-[#1C1B19]"
                />
              </div>
            )}
          </>
        )}

        {hidden && (
          <p className="text-caption text-[#6E6962] mb-4">
            보드에서 &lsquo;{TITLE_LABEL_TEXT}&rsquo;와 연도가 사라져. 사진만 꽉 찬 배경화면이 돼.
          </p>
        )}

        <button onClick={onClose} className="mt-1 w-full py-3 text-body font-semibold text-[#1C1B19]">
          닫기
        </button>
      </div>
    </BottomSheet>
  );
}
