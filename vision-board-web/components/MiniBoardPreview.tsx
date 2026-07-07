'use client';

import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionId } from '@/lib/types';
import { getTargetYear } from '@/lib/targetDate';

// 미니 비전보드 (v7.0-r5) — 구 랜딩 HeroBoard를 진행 피드백으로 확장.
// 사진이 담긴 섹션은 첫 사진이 채워지고, 미완은 파스텔 placeholder(goal-gradient).
// 대시보드 상단·섹션 완료 시트·finish 피날레에서 공용.
const ROTATIONS = [-2.5, 1.5, -1.5, 2, -2, 2.5];

function firstPhoto(board: BoardData, sectionId: SectionId): string | null {
  const sec = board.sections[sectionId];
  const uploaded = sec.uploadedImages ?? [];
  const generated = sec.generatedImages ?? [];
  for (let i = 0; i < 3; i++) {
    const img = uploaded[i] || generated[i];
    if (img) return img;
  }
  return null;
}

export default function MiniBoardPreview({
  board,
  highlightSectionId,
  compact = false,
}: {
  board?: BoardData | null;
  /** 방금 채워진 칸 강조 — 섹션 완료 시트의 "방금 이 칸이 채워졌어" */
  highlightSectionId?: SectionId;
  compact?: boolean;
}) {
  const areas = SECTIONS.map((s) => ({
    id: s.id,
    label: s.title.split(' — ')[0],
    color: s.color,
    lightColor: s.lightColor,
    photo: board ? firstPhoto(board, s.id) : null,
  }));

  return (
    <div className={`rounded-3xl ${compact ? 'px-3 py-3' : 'px-4 py-5'}`} style={{ backgroundColor: '#2D2B29' }}>
      <div className={`grid grid-cols-3 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        {areas.slice(0, 3).map((area, i) => (
          <MiniPolaroid key={area.id} area={area} index={i} highlighted={area.id === highlightSectionId} compact={compact} />
        ))}
        <div className={`col-span-3 flex flex-col items-center justify-center text-center select-none ${compact ? 'py-1' : 'py-2.5'}`}>
          <p className="text-micro font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase">
            Vision Board
          </p>
          <p className={`font-bold text-white tracking-widest mt-0.5 ${compact ? 'text-body' : 'text-title'}`}>
            {board ? getTargetYear(board) : '나의 해'}
          </p>
        </div>
        {areas.slice(3).map((area, i) => (
          <MiniPolaroid key={area.id} area={area} index={i + 3} highlighted={area.id === highlightSectionId} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function MiniPolaroid({
  area,
  index,
  highlighted,
  compact,
}: {
  area: { label: string; color: string; lightColor: string; photo: string | null };
  index: number;
  highlighted?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className="bg-white p-1 pb-0.5 rounded-sm shadow-md animate-slideUp"
      style={{
        transform: `rotate(${ROTATIONS[index]}deg)`,
        animationDelay: `${200 + index * 130}ms`,
        animationFillMode: 'backwards',
        boxShadow: highlighted ? `0 0 0 2px ${area.color}, 0 4px 10px rgba(0,0,0,0.3)` : undefined,
      }}
    >
      <div
        className="w-full aspect-square flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: area.lightColor }}
      >
        {area.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={area.photo} alt={area.label} className="w-full h-full object-cover" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
        )}
      </div>
      <p className={`text-micro text-center text-[#57534E] ${compact ? 'py-0.5' : 'py-1'}`}>{area.label}</p>
    </div>
  );
}
