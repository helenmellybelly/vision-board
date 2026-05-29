'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionStatus } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';

const STATUS_LABEL: Record<SectionStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  text_complete: '답변 완료',
  completed: '완료',
};

const STATUS_STYLE: Record<SectionStatus, { bg: string; text: string }> = {
  not_started: { bg: '#F3F4F6', text: '#6B7280' },
  in_progress: { bg: '#FEF9C3', text: '#D97706' },
  text_complete: { bg: '#DBEAFE', text: '#2563EB' },
  completed: { bg: '#D1FAE5', text: '#059669' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const statuses = Object.values(board.sections).map((s) => s.status);
  const completedCount = statuses.filter((s) => s === 'completed').length;
  const textCompleteCount = statuses.filter((s) => s === 'text_complete' || s === 'completed').length;
  const allTextDone = textCompleteCount === 6;
  const userName = board.userName;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full pb-10">
      {/* 전체 프로세스 바 */}
      <ProcessBar board={board} />

      <div className="px-6 pt-4">
        {/* 헤더 */}
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">✦</span>
            <span className="text-sm text-[#6B7280]">lumi와 비전보드</span>
          </div>
          <h1 className="text-2xl font-bold">
            {userName ? `${userName}의 섹션` : '내 섹션'}
          </h1>
        </div>

        {/* 섹션 소개 — 처음 시작하는 경우 */}
        {textCompleteCount === 0 && (
          <div className="mb-5 bg-white rounded-2xl p-4 border border-[#E5E3DF] animate-slideUp">
            <p className="text-sm font-semibold mb-2">비전보드는 6가지 영역으로 이뤄져 있어.</p>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              나, 건강, 관계, 일, 돈, 공간. 각각 답하다 보면 다면적인 내가 원하는 것들이 보여. 어떤 섹션부터 시작해도 괜찮아.
            </p>
          </div>
        )}

        {/* 진행 현황 */}
        {textCompleteCount > 0 && !allTextDone && (
          <div className="mb-5 flex items-center gap-3">
            <div className="flex-1 bg-[#E5E3DF] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1C1B19] transition-all duration-500"
                style={{ width: `${(textCompleteCount / 6) * 100}%` }}
              />
            </div>
            <span className="text-xs text-[#6B7280]">{textCompleteCount}/6 완료</span>
          </div>
        )}

        {/* 섹션 카드들 */}
        <div className="space-y-3 animate-slideUp">
          {SECTIONS.map((section) => {
            const sectionData = board.sections[section.id];
            const status = sectionData.status;
            const statusStyle = STATUS_STYLE[status];

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
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{section.title}</p>
                      <p className="text-xs text-[#9CA3AF] mt-0.5">{section.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
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

        {/* 하단 액션 */}
        <div className="mt-6 space-y-3">
          {allTextDone && (
            <button
              onClick={() => router.push('/review')}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1C1B19' }}
            >
              내 답변 보고 상황 그리기 →
            </button>
          )}
          {completedCount > 0 && (
            <button
              onClick={() => router.push('/board')}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-sm font-semibold active:opacity-70 transition-opacity"
            >
              비전보드 보기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
