'use client';

import { Section } from '@/lib/types';

interface Props {
  section: Section;
  onDone: () => void;
}

export default function SectionComplete({ section, onDone }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-center animate-fadeIn">
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
      <p className="text-[#9CA3AF] text-sm mb-10">
        장면 그리기는 모든 섹션 답하고 나서 같이 할 거야.
      </p>

      <button
        onClick={onDone}
        className="w-full max-w-xs py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
        style={{ backgroundColor: section.color }}
      >
        와, 하나 끝났다! 다음 갈래
      </button>
    </div>
  );
}
