'use client';

import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionId, SectionStatus } from '@/lib/types';
import { getTargetYear } from '@/lib/targetDate';

// 미니 비전보드 (v7.0-r5) — 구 랜딩 HeroBoard를 진행 피드백으로 확장.
// 사진이 담긴 섹션은 첫 사진이 채워지고, 미완은 파스텔 placeholder(goal-gradient).
// 대시보드 상단·섹션 완료 시트·finish 피날레에서 공용.
// v7.1-r3: interactive 모드 — 셀이 곧 섹션 내비 버튼 (대시보드 = 미니보드 허브)
const ROTATIONS = [-2.5, 1.5, -1.5, 2, -2, 2.5];

const STATUS_LABEL: Record<SectionStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  text_complete: '글 완료',
  completed: '완성',
};

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

interface Area {
  id: SectionId;
  label: string;
  color: string;
  lightColor: string;
  photo: string | null;
  status: SectionStatus;
}

export default function MiniBoardPreview({
  board,
  highlightSectionId,
  compact = false,
  interactive = false,
  onSelectSection,
  nextSectionId,
}: {
  board?: BoardData | null;
  /** 방금 채워진 칸 강조 — 섹션 완료 시트의 "방금 이 칸이 채워졌어" */
  highlightSectionId?: SectionId;
  compact?: boolean;
  /** 셀 탭 = 섹션 이동 (v7.1-r3, 대시보드 허브) — 비인터랙티브 렌더는 기존 그대로 */
  interactive?: boolean;
  onSelectSection?: (id: SectionId) => void;
  /** 추천 카드와 같은 '다음 할 일' 셀 — 섹션 컬러 링+펄스로 시선 유도 (goal-gradient) */
  nextSectionId?: SectionId | null;
}) {
  const areas: Area[] = SECTIONS.map((s) => ({
    id: s.id,
    label: s.title.split(' — ')[0],
    color: s.color,
    lightColor: s.lightColor,
    photo: board ? firstPhoto(board, s.id) : null,
    status: board ? board.sections[s.id].status : 'not_started',
  }));

  const renderCell = (area: Area, index: number) => {
    const polaroid = (
      <MiniPolaroid
        area={area}
        index={index}
        highlighted={area.id === highlightSectionId}
        isNext={interactive && area.id === nextSectionId}
        compact={compact}
      />
    );
    if (!interactive) return <div key={area.id}>{polaroid}</div>;
    return (
      <button
        key={area.id}
        onClick={() => onSelectSection?.(area.id)}
        aria-label={`${area.label} — ${STATUS_LABEL[area.status]}`}
        className="text-left active:opacity-80 transition-opacity"
      >
        {polaroid}
      </button>
    );
  };

  return (
    <div className={`rounded-3xl ${compact ? 'px-3 py-3' : 'px-4 py-5'}`} style={{ backgroundColor: '#2D2B29' }}>
      <div className={`grid grid-cols-3 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
        {areas.slice(0, 3).map((area, i) => renderCell(area, i))}
        <div className={`col-span-3 flex flex-col items-center justify-center text-center select-none ${compact ? 'py-1' : 'py-2.5'}`}>
          <p className="text-micro font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase">
            Vision Board
          </p>
          <p className={`font-bold text-white tracking-widest mt-0.5 ${compact ? 'text-body' : 'text-title'}`}>
            {board ? getTargetYear(board) : '나의 해'}
          </p>
        </div>
        {areas.slice(3).map((area, i) => renderCell(area, i + 3))}
      </div>
    </div>
  );
}

function MiniPolaroid({
  area,
  index,
  highlighted,
  isNext,
  compact,
}: {
  area: Area;
  index: number;
  highlighted?: boolean;
  isNext?: boolean;
  compact?: boolean;
}) {
  const boxShadow = highlighted
    ? `0 0 0 2px ${area.color}, 0 4px 10px rgba(0,0,0,0.3)`
    : undefined;
  return (
    <div
      className="bg-white p-1 pb-0.5 rounded-sm shadow-md animate-slideUp relative"
      style={{
        transform: `rotate(${ROTATIONS[index]}deg)`,
        animationDelay: `${200 + index * 130}ms`,
        animationFillMode: 'backwards',
        boxShadow,
      }}
    >
      {/* 다음 할 일 셀 링 — slideUp과 애니메이션이 겹치지 않게 오버레이로 펄스 (v7.1-r3) */}
      {isNext && (
        <span
          className="absolute -inset-0.5 rounded-sm animate-pulse pointer-events-none"
          style={{ boxShadow: `0 0 0 2px ${area.color}` }}
          aria-hidden="true"
        />
      )}
      {/* 토리가 추천 칸에서 기다린다 — 게임 맵의 현재 스테이지 문법 (v7.2) */}
      {isNext && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/tori-profile-bust.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full object-cover z-10 shadow-md"
        />
      )}
      <div
        className="w-full aspect-square flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: area.lightColor }}
      >
        {area.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={area.photo} alt={area.label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-heading leading-none" aria-hidden="true">
            {area.status === 'not_started' ? '🌱' : '🌿'}
          </span>
        )}
      </div>
      {/* 상태 뱃지 — ✓ 완성 / ✍️ 이야기만 / 📷 사진만 (v7.2 정원 맵) */}
      {area.status === 'completed' ? (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1C1B19] text-white text-[9px] leading-none flex items-center justify-center"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : area.status === 'text_complete' ? (
        <span className="absolute -top-1 -right-1 text-[10px] leading-none" aria-hidden="true">✍️</span>
      ) : area.status === 'in_progress' && area.photo ? (
        <span className="absolute -top-1 -right-1 text-[10px] leading-none" aria-hidden="true">📷</span>
      ) : null}
      <p className={`text-micro text-center text-[#57534E] ${compact ? 'py-0.5' : 'py-1'}`}>{area.label}</p>
    </div>
  );
}
