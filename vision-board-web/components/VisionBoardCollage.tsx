'use client';

import { useState } from 'react';

interface Props {
  images: string[];
  year: string;
  onYearChange: (year: string) => void;
  /** 사이드 패널 등 좁은 영역용 — md: 업사이즈를 억제하고 2열 유지 */
  compact?: boolean;
}

// 폴라로이드 미세 회전 — 인덱스 순환
const ROTATIONS = [-2.5, 1.5, -1, 2.5, -1.5, 2, -2, 1];

function Polaroid({ src, index }: { src: string; index: number }) {
  return (
    <div
      className="bg-white p-1.5 pb-4 rounded-sm shadow-md"
      style={{ transform: `rotate(${ROTATIONS[index % ROTATIONS.length]}deg)` }}
    >
      <img src={src} alt="" loading="lazy" className="w-full aspect-square object-cover" />
    </div>
  );
}

export default function VisionBoardCollage({ images, year, onYearChange, compact = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [yearInput, setYearInput] = useState(year);

  if (images.length === 0) return null;

  function commitYear() {
    const trimmed = yearInput.trim();
    if (trimmed) onYearChange(trimmed);
    else setYearInput(year);
    setEditing(false);
  }

  const half = Math.ceil(images.length / 2);
  const firstHalf = images.slice(0, half);
  const secondHalf = images.slice(half);

  return (
    <div
      className={compact ? 'rounded-3xl px-4 py-5' : 'rounded-3xl px-4 py-5 md:px-6 md:py-7'}
      style={{ backgroundColor: '#2D2B29' }}
    >
      <div
        className={
          compact
            ? 'grid grid-cols-2 gap-3 items-center'
            : 'grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 items-center'
        }
      >
        {firstHalf.map((src, i) => (
          <Polaroid key={`a-${i}`} src={src} index={i} />
        ))}

        {/* 중앙 타이틀 — 연도 클릭 시 수정 */}
        <div className="col-span-2 flex flex-col items-center justify-center text-center py-4 select-none">
          <p
            className={`font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase ${
              compact ? 'text-[11px]' : 'text-[11px] md:text-xs'
            }`}
          >
            Vision Board
          </p>
          {editing ? (
            <input
              type="text"
              inputMode="numeric"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              onBlur={commitYear}
              onKeyDown={(e) => e.key === 'Enter' && commitYear()}
              autoFocus
              className={`font-display w-32 mt-1 bg-transparent text-center font-bold text-white outline-none border-b border-[#C4C2BE] ${
                compact ? 'text-4xl' : 'text-4xl md:text-5xl'
              }`}
            />
          ) : (
            <button
              onClick={() => { setYearInput(year); setEditing(true); }}
              className={`font-display mt-1 font-bold text-white tracking-widest active:opacity-70 ${
                compact ? 'text-4xl' : 'text-4xl md:text-5xl'
              }`}
              title="연도 수정"
            >
              {year}
            </button>
          )}
          <p className="text-[10px] text-[#8A8784] mt-1.5">연도를 탭하면 수정할 수 있어</p>
        </div>

        {secondHalf.map((src, i) => (
          <Polaroid key={`b-${i}`} src={src} index={i + firstHalf.length} />
        ))}
      </div>
    </div>
  );
}
