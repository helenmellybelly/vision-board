'use client';

import { Sprout } from 'lucide-react';
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
        <Sprout size={28} strokeWidth={1.8} style={{ color: section.color }} aria-hidden="true" />
      </div>

      <h2 className="text-display font-bold mb-3">
        {section.shortTitle ?? section.title.split(' — ')[0]} 이야기, 다 썼어.
      </h2>
      <p className="text-[#6B7280] text-heading leading-relaxed mb-1">
        수고했어. 잠깐 쉬어도 돼.
      </p>

      {allTextDone ? (
        <p className="text-[#6E6962] text-body mb-10">
          6개 다 채웠어. 이제 전체를 한눈에 볼 수 있어.
        </p>
      ) : (
        <p className="text-[#6E6962] text-body mb-10">
          {6 - completedCount}개 더 남았어. 다 끝나면 미래의 하루를 같이 그려볼게.
        </p>
      )}

      <div className="w-full space-y-3 max-w-xs">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {allTextDone
            ? '내 답변 모두 볼게 →'
            : nextIncomplete
            ? `${(SECTIONS.find(s => s.id === nextIncomplete)?.shortTitle ?? SECTIONS.find(s => s.id === nextIncomplete)?.title.split(' — ')[0]) ?? '다음'}도 써볼래? →`
            : '내 답변 모두 볼게 →'}
        </button>
        <button
          onClick={onDashboard}
          className="w-full py-2 text-body text-[#6E6962]"
        >
          잠깐 쉬고 올게
        </button>
      </div>
    </div>
  );
}
