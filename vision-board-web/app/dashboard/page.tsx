'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionStatus } from '@/lib/types';

const STATUS_LABEL: Record<SectionStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  completed: '완료',
};

export default function DashboardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;

  const allDone = completedCount === 6;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      <div className="mb-8 animate-fadeIn">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">✦</span>
          <span className="text-sm text-[#6B7280]">비전보드</span>
        </div>
        <h1 className="text-2xl font-bold">내 섹션</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {completedCount === 0
            ? '어떤 섹션부터 시작할지 골라봐.'
            : `${completedCount}개 완료`}
        </p>
      </div>

      <div className="space-y-3 flex-1 animate-slideUp">
        {SECTIONS.map((section) => {
          const sectionData = board.sections[section.id];
          const status = sectionData.status;

          return (
            <button
              key={section.id}
              onClick={() => router.push(`/section/${section.id}`)}
              className="w-full text-left rounded-2xl p-4 border border-[#E5E3DF] bg-white active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: section.color }}
                    />
                  </div>
                  <div>
                    <p className="font-semibold">{section.title}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">{section.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor:
                        status === 'completed'
                          ? section.lightColor
                          : status === 'in_progress'
                          ? '#FEF9C3'
                          : '#F3F4F6',
                      color:
                        status === 'completed'
                          ? section.color
                          : status === 'in_progress'
                          ? '#D97706'
                          : '#6B7280',
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="text-[#9CA3AF]">›</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {completedCount > 0 && (
        <div className="mt-6 space-y-3">
          <button
            onClick={() => router.push('/board')}
            className="w-full border border-[#1C1B19] text-[#1C1B19] py-3.5 rounded-2xl text-sm font-semibold active:opacity-70 transition-opacity"
          >
            비전보드 보기
          </button>
          {allDone && (
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-3.5 rounded-2xl text-sm font-semibold active:opacity-80 transition-opacity"
            >
              완성 ✦
            </button>
          )}
        </div>
      )}
    </main>
  );
}
