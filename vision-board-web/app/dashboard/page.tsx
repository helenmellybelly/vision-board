'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, saveDashboardIntroSeen, saveLastVisit } from '@/lib/storage';
import { SECTIONS, getSection } from '@/lib/questions';
import { BoardData, SectionId } from '@/lib/types';
import { getSectionRoute, getRecommendedSection, isPhotoOnlySection, sectionHasPhoto } from '@/lib/sectionRoute';
import { josa } from '@/lib/josa';
import ProcessBar from '@/components/ProcessBar';
import ProcessGuide from '@/components/ProcessGuide';
import DashboardIntroSheet from '@/components/DashboardIntroSheet';
import MiniBoardPreview from '@/components/MiniBoardPreview';
import useFocusTrap from '@/components/useFocusTrap';

const RETURN_GAP_MS = 48 * 60 * 60 * 1000; // 복귀 인사 갭 (v7.1-r4)

// 대시보드 = 미니보드 허브 (v7.1-r3) — 섹션 카드 6장 나열을 제거하고
// 미니보드 셀 탭이 곧 섹션 내비. 다음 할 일은 추천 카드 1장으로 (Hick's law).
export default function DashboardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  // 미시작 섹션 셀 탭 → 질문/사진 양경로 시트 (v7.1-r4)
  const [pathSheetId, setPathSheetId] = useState<SectionId | null>(null);
  const pathSheetTrapRef = useFocusTrap<HTMLDivElement>(pathSheetId !== null, () => setPathSheetId(null));
  const [showReturnGreeting, setShowReturnGreeting] = useState(false);

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
    // 복귀 인사 (v7.1-r4) — 읽기→비교→기록 순서: 이번 방문 기록이 갭 판정을 덮지 않게
    const incomplete = Object.values(b.sections).some((s) => s.status !== 'completed');
    if (b.lastVisitAt && Date.now() - b.lastVisitAt >= RETURN_GAP_MS && incomplete) {
      setShowReturnGreeting(true);
    }
    saveLastVisit();
  }, [router]);

  // 셀 탭 — 미시작 섹션은 양경로 시트로 인터셉트, 진행 중이면 이어서 할 단계로 직행
  function handleSelectSection(id: SectionId) {
    if (!board) return;
    if (board.sections[id].status === 'not_started') {
      setPathSheetId(id);
      return;
    }
    router.push(getSectionRoute(board.sections[id], id));
  }

  function handleCloseIntro() {
    saveDashboardIntroSeen();
    setShowIntro(false);
  }

  if (!board) return null;

  const statuses = Object.values(board.sections).map((s) => s.status);
  const textCompleteCount = statuses.filter((s) => s === 'text_complete' || s === 'completed').length;
  const allTextDone = textCompleteCount === 6;
  const userName = board.userName;
  // 보드 CTA·퀵 버튼은 담긴 사진이 1장이라도 있을 때만 — 빈 보드로 가는 선택지를 치워 주 동선에 집중 (v6.21)
  const hasAnyImage = SECTIONS.some((section) => sectionHasPhoto(board.sections[section.id]));
  // 미니보드 goal-gradient — '칸'의 정의는 사진이 1장이라도 담긴 섹션 (v7.0-r5)
  const photoSectionCount = SECTIONS.filter((section) => sectionHasPhoto(board.sections[section.id])).length;
  const boardCaption =
    photoSectionCount === 0
      ? '질문에 답하고 사진을 담으면 이 보드가 채워져 🌰'
      : photoSectionCount < 6
      ? `이제 ${6 - photoSectionCount}칸 남았어 🌰`
      : '다 채웠다! 배경화면으로 만들어봐 🐿️';

  // 추천 카드 — 다음 할 일 1개만 (v7.1-r3, goal-gradient 포커스)
  const recommendedId = getRecommendedSection(board);
  const recommended = recommendedId ? getSection(recommendedId) : null;
  // 부캡션 (v7.1-r4): 열린 고리(사진有·답변無) > 막판 goal-gradient > 기본
  const completedCount = statuses.filter((s) => s === 'completed').length;
  const recommendCaption =
    recommendedId && isPhotoOnlySection(board.sections[recommendedId])
      ? '사진은 담았는데 이야기가 비어 있어 🌰'
      : completedCount >= 4
      ? `이제 ${6 - completedCount}칸이면 끝이야 🐿️`
      : '다음 할 일';

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
              <span className="text-body text-[#6B7280]">
                {showReturnGreeting
                  ? `다시 왔네${userName ? `, ${josa(userName, '아/야')}` : ''}! 네 보드가 기다리고 있었어 🌰`
                  : '정원사 토리와 함께'}
              </span>
            </div>
            <ProcessGuide />
          </div>
          <h1 className="text-display font-bold">
            {userName ? `${userName}의 비전보드` : '내 비전보드'}
          </h1>
        </div>

        {/* 미니 비전보드 = 내비 허브 (v7.1-r3) — 셀 탭이 곧 섹션 이동 */}
        <div className="mb-5 animate-slideUp">
          <MiniBoardPreview
            board={board}
            interactive
            nextSectionId={recommendedId}
            onSelectSection={handleSelectSection}
          />
          <p className="text-caption text-[#6E6962] text-center mt-2">{boardCaption}</p>
        </div>

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

        {/* 추천 카드 — 다음 할 일 하나만 (Hick's law) */}
        {recommended ? (
          <button
            onClick={() => handleSelectSection(recommended.id)}
            className="w-full text-left rounded-2xl border p-4 mb-3 transition-all active:scale-[0.98] animate-slideUp"
            style={{ backgroundColor: recommended.lightColor, borderColor: recommended.color + '40' }}
          >
            <p className="text-caption text-[#6E6962] mb-0.5">{recommendCaption}</p>
            <p className="font-semibold text-body">
              {recommended.shortTitle ?? recommended.title.split(' — ')[0]} →
            </p>
          </button>
        ) : (
          <button
            onClick={() => router.push('/finish')}
            className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity mb-3"
            style={{ backgroundColor: '#1C1B19' }}
          >
            비전보드 완성하러 가기 →
          </button>
        )}

        {/* 하단 액션 */}
        <div className="mt-2 space-y-3">
          {allTextDone && recommended && (
            <button
              onClick={() => router.push('/review')}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity"
              style={{ backgroundColor: '#1C1B19' }}
            >
              다 됐다, 이제 미래의 하루를 그리러 가자 →
            </button>
          )}
          {hasAnyImage && (
            <>
              {/* 배경화면 퀵 진입 (v7.1-r3) — choose 뷰를 건너뛰는 딥링크 */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => router.push('/collage?device=phone')}
                  className="py-3.5 rounded-2xl border border-[#E5E3DF] bg-white text-body font-semibold text-[#1C1B19] active:opacity-70 transition-opacity"
                >
                  📱 폰 배경화면
                </button>
                <button
                  onClick={() => router.push('/collage?device=desktop')}
                  className="py-3.5 rounded-2xl border border-[#E5E3DF] bg-white text-body font-semibold text-[#1C1B19] active:opacity-70 transition-opacity"
                >
                  🖥️ PC 배경화면
                </button>
              </div>
              <button
                onClick={() => router.push('/collage')}
                className="w-full py-2 text-caption text-[#6E6962] text-center active:opacity-70"
              >
                그냥 보드로 볼래? →
              </button>
            </>
          )}
        </div>
      </div>

      {/* 미시작 섹션 양경로 시트 (v7.1-r4) — 질문 먼저(작은 요청)를 첫 번째로, 사진 먼저도 대등하게 */}
      {pathSheetId !== null && (() => {
        const sheetSection = getSection(pathSheetId);
        if (!sheetSection) return null;
        const label = sheetSection.shortTitle ?? sheetSection.title.split(' — ')[0];
        return (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
            onClick={() => setPathSheetId(null)}
          >
            <div
              ref={pathSheetTrapRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${label} 시작 방법 선택`}
              className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-title font-bold mb-1">{label}, 어떻게 시작할까?</p>
              <p className="text-body text-[#6B7280] leading-relaxed mb-4">
                순서는 네 마음이야. 이야기부터 해도, 사진부터 골라도 돼.
              </p>
              <button
                onClick={() => router.push(`/section/${pathSheetId}`)}
                className="w-full py-3.5 rounded-xl text-body font-semibold text-white active:opacity-80"
                style={{ backgroundColor: sheetSection.color }}
              >
                ✍️ 질문에 답하며 시작 →
              </button>
              <button
                onClick={() => router.push(`/scenes/${pathSheetId}`)}
                className="w-full mt-2.5 py-3.5 rounded-xl text-body font-semibold border border-[#E5E3DF] text-[#1C1B19] active:opacity-70"
              >
                📷 사진부터 골라볼래 →
              </button>
            </div>
          </div>
        );
      })()}

      {showIntro && <DashboardIntroSheet userName={userName} onClose={handleCloseIntro} />}
    </main>
  );
}
