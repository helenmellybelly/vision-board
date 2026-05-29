'use client';

import { BoardData, Section, SectionId } from '@/lib/types';
import { SECTIONS } from '@/lib/questions';

interface Props {
  section: Section;
  sectionId: SectionId;
  board: BoardData;
  onDone: () => void;
  onDashboard: () => void;
}

export default function SectionComplete({ section, sectionId, board, onDone, onDashboard }: Props) {
  const allTextDone = ([1, 2, 3, 4, 5, 6] as SectionId[]).every(
    (id) => board.sections[id].status === 'text_complete' || board.sections[id].status === 'completed'
  );

  const nextIncomplete = ([1, 2, 3, 4, 5, 6] as SectionId[]).find(
    (id) => id > sectionId && (board.sections[id].status === 'not_started' || board.sections[id].status === 'in_progress')
  );

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'text_complete' || s.status === 'completed'
  ).length;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-180px)] text-center animate-fadeIn">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: section.lightColor }}
      >
        <span className="text-2xl">✦</span>
      </div>

      <h2 className="text-2xl font-bold mb-3">
        {section.title.split(' — ')[0]} 섹션 완료
      </h2>
      <p className="text-[#6B7280] text-base leading-relaxed mb-1">
        수고했어. 잠깐 쉬어도 돼.
      </p>

      {allTextDone ? (
        <p className="text-[#9CA3AF] text-sm mb-10">
          6개 섹션 모두 답했어! 이제 내 답변을 한눈에 볼 수 있어.
        </p>
      ) : (
        <p className="text-[#9CA3AF] text-sm mb-10">
          {completedCount}/6 완료 — 장면 그리기는 6개 모두 끝난 후에 같이 할 거야.
        </p>
      )}

      <div className="w-full space-y-3 max-w-xs">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {allTextDone
            ? '내 답변 모두 볼게 →'
            : nextIncomplete
            ? `${SECTIONS.find(s => s.id === nextIncomplete)?.title.split(' — ')[0] ?? '다음'} 섹션 답하러 가기 →`
            : '내 답변 모두 볼게 →'}
        </button>
        <button
          onClick={onDashboard}
          className="w-full py-2 text-sm text-[#9CA3AF]"
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
