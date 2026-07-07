'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, saveDashboardIntroSeen } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionStatus } from '@/lib/types';
import { getSectionRoute } from '@/lib/sectionRoute';
import ProcessBar from '@/components/ProcessBar';
import ProcessGuide from '@/components/ProcessGuide';
import DashboardIntroSheet from '@/components/DashboardIntroSheet';

const STATUS_LABEL: Record<SectionStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  text_complete: '글 완료',
  completed: '완성',
};

// 뉴트럴 단계 + 완성만 잉크 솔리드 — 색은 섹션 도트가 전담해 어떤 파스텔 카드 배경과도 충돌하지 않는다
const STATUS_STYLE: Record<SectionStatus, { bg: string; text: string }> = {
  not_started: { bg: '#F3F4F6', text: '#6E6962' },
  in_progress: { bg: '#F0EFEC', text: '#1C1B19' },
  text_complete: { bg: '#E5E3DF', text: '#1C1B19' },
  completed: { bg: '#1C1B19', text: '#FFFFFF' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const b = loadBoard();
    // 온보딩을 건너뛴 직접 URL 진입 가드 (v6.21) — 허브는 온보딩 완료 후에만
    if (!b.onboardingDone) {
      router.replace('/');
      return;
    }
    setBoard(b);
    // 첫 진입 6영역 안내 (v7.0-r1) — 구 온보딩 Act5 대체, 한 번 닫으면 재노출 없음
    if (!b.dashboardIntroSeen) setShowIntro(true);
  }, [router]);

  function handleCloseIntro() {
    saveDashboardIntroSeen();
    setShowIntro(false);
  }

  if (!board) return null;

  const statuses = Object.values(board.sections).map((s) => s.status);
  const textCompleteCount = statuses.filter((s) => s === 'text_complete' || s === 'completed').length;
  const allTextDone = textCompleteCount === 6;
  const userName = board.userName;
  // 보드 CTA는 담긴 사진이 1장이라도 있을 때만 — 빈 보드로 가는 선택지를 치워 주 동선에 집중 (v6.21)
  const hasAnyImage = SECTIONS.some((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return [0, 1, 2].some((i) => !!(uploaded[i] ?? generated[i]));
  });
  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full pb-10">
      <ProcessBar board={board} />

      <div className="px-6 pt-4">
        {/* 헤더 */}
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <img
                src="/tori-profile-bust.png"
                alt="토리"
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="text-body text-[#6B7280]">정원사 토리와 함께</span>
            </div>
            <ProcessGuide />
          </div>
          <h1 className="text-display font-bold">
            {userName ? `${userName}의 비전보드` : '내 비전보드'}
          </h1>
        </div>

        {/* 섹션 소개 — 처음 시작하는 경우 */}
        {textCompleteCount === 0 && (
          <div className="mb-5 bg-white rounded-2xl p-4 border border-[#E5E3DF] animate-slideUp">
            <p className="text-body text-[#6B7280] leading-relaxed">
              어디부터 시작해도 괜찮아. 네가 가장 궁금한 영역부터 시작해.
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
            <span className="text-caption text-[#6B7280]">{textCompleteCount}/6 채워짐</span>
          </div>
        )}

        {/* 섹션 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 animate-slideUp">
          {SECTIONS.map((section) => {
            const sectionData = board.sections[section.id];
            const status = sectionData.status;
            const statusStyle = STATUS_STYLE[status];
            const isCompleted = status === 'completed';
            const isTextDone = status === 'text_complete' || status === 'completed';

            return (
              <button
                key={section.id}
                onClick={() => router.push(getSectionRoute(sectionData, section.id))}
                className="w-full text-left rounded-2xl border transition-all active:scale-[0.98] overflow-hidden"
                style={{
                  backgroundColor: isCompleted ? section.lightColor : 'white',
                  borderColor: isCompleted ? section.color + '40' : '#E5E3DF',
                }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isCompleted ? section.color + '20' : section.lightColor }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-body">{section.shortTitle ?? section.title.split(' — ')[0]}</p>
                        {section.title.split(' — ')[1] && (
                          <p className="text-caption text-[#6E6962] mt-0.5">{section.title.split(' — ')[1]}</p>
                        )}
                      </div>
                    </div>

                    {/* 상태 표시 */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full transition-colors"
                          style={{ backgroundColor: isTextDone ? section.color : '#E5E3DF' }}
                        />
                        <div
                          className="w-2 h-2 rounded-full transition-colors"
                          style={{ backgroundColor: isCompleted ? section.color : '#E5E3DF' }}
                        />
                      </div>
                      <span
                        className="text-caption px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                      >
                        {isCompleted && '✓ '}{STATUS_LABEL[status]}
                      </span>
                    </div>
                  </div>

                </div>
              </button>
            );
          })}
        </div>

        {/* 2단계 범례 */}
        <div className="mt-3 flex items-center gap-3 px-1">
          <p className="text-micro text-[#C4C2BE]">●● = 완성 &nbsp; ●○ = 글만 완료 &nbsp; ○○ = 미시작</p>
        </div>

        {/* 하단 액션 */}
        <div className="mt-5 space-y-3">
          {allTextDone && (
            <button
              onClick={() => router.push('/review')}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1C1B19' }}
            >
              다 됐다, 이제 미래의 하루를 그리러 가자 →
            </button>
          )}
          {hasAnyImage && (
            <button
              onClick={() => router.push('/board')}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-body font-semibold active:opacity-70 transition-opacity"
            >
              나의 비전보드 보러가기 →
            </button>
          )}
        </div>
      </div>

      {showIntro && <DashboardIntroSheet userName={userName} onClose={handleCloseIntro} />}
    </main>
  );
}
