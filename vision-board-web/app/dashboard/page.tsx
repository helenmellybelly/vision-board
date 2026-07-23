'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@vercel/analytics';
import { loadBoard, saveDashboardIntroSeen, saveLastVisit, saveTargetDate, recordPathChoice } from '@/lib/storage';
import { getTargetDate, getTargetYear, withYear } from '@/lib/targetDate';
import { SECTIONS, getSection } from '@/lib/questions';
import { BoardData, SectionId } from '@/lib/types';
import { getSectionRoute, getRecommendedSection, isPhotoOnlySection, sectionHasPhoto } from '@/lib/sectionRoute';
import { josa } from '@/lib/josa';
import ProcessBar from '@/components/ProcessBar';
import ProcessGuide from '@/components/ProcessGuide';
import DashboardIntroSheet from '@/components/DashboardIntroSheet';
import WalkPathMap from '@/components/WalkPathMap';
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
  // 사진 바로 담기 — 인터뷰 없이 섹션별 /scenes 직행 시트 (v7.3)
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const photoSheetTrapRef = useFocusTrap<HTMLDivElement>(photoSheetOpen, () => setPhotoSheetOpen(false));
  // 보드 연도 편집 — targetDate의 연도만 교체 (v7.3, collage 연도 편집과 같은 소스)
  const [yearEditOpen, setYearEditOpen] = useState(false);

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
      // 같은 경로 3연속 선택이면 시트 생략 직행 (v7.4) — 반복 유저의 탭 1회 절약
      const choice = board.pathChoice;
      if (choice && choice.streak >= 3) {
        recordPathChoice(choice.kind);
        router.push(choice.kind === 'photo' ? `/scenes/${id}` : `/section/${id}`);
        return;
      }
      setPathSheetId(id);
      return;
    }
    router.push(getSectionRoute(board.sections[id], id));
  }

  // 양경로 시트에서 경로 확정 — 선택을 기록(3연속 판정용)하고 이동
  function handlePathChoice(id: SectionId, kind: 'question' | 'photo') {
    recordPathChoice(kind);
    router.push(kind === 'photo' ? `/scenes/${id}` : `/section/${id}`);
  }

  function handleCloseIntro() {
    saveDashboardIntroSeen();
    setShowIntro(false);
  }

  // 연도 스텝 — 일기 날짜(targetDate)의 연도만 바꾼다. 월·일은 유지
  function stepYear(delta: number) {
    if (!board) return;
    const now = new Date().getFullYear();
    const next = Number(getTargetYear(board)) + delta;
    if (next < now + 1 || next > now + 10) return;
    saveTargetDate(withYear(getTargetDate(board), String(next)));
    setBoard(loadBoard());
  }

  if (!board) return null;

  const statuses = Object.values(board.sections).map((s) => s.status);
  const textCompleteCount = statuses.filter((s) => s === 'text_complete' || s === 'completed').length;
  const allTextDone = textCompleteCount === 6;
  const userName = board.userName;
  // 보드 CTA·퀵 버튼은 담긴 사진이 1장이라도 있을 때만 — 빈 보드로 가는 선택지를 치워 주 동선에 집중 (v6.21)
  const hasAnyImage = SECTIONS.some((section) => sectionHasPhoto(board.sections[section.id]));
  const photoSectionCount = SECTIONS.filter((section) => sectionHasPhoto(board.sections[section.id])).length;
  // 산책길 진행 카피 (v7.5) — '지났어'의 분자는 완료(completed) 스테이션 수.
  // 사진만 담긴 진행은 📷 마커 + 중간 카피가 담당(체감 진행 0으로 읽히지 않게)
  const completedCount = statuses.filter((s) => s === 'completed').length;
  const hasAnyProgress = photoSectionCount > 0 || statuses.some((s) => s !== 'not_started');
  const walkCaption = !hasAnyProgress
    ? '토리랑 첫 스테이션부터 걸어보자 🌰'
    : completedCount === 0
    ? '산책을 시작했어 — 토리가 다음 표지판에서 기다려 🐿️'
    : completedCount < 6
    ? `${completedCount}/6 스테이션을 지났어 🐿️`
    : '길 끝에 도착! 이제 배경화면으로 만들어보자 🐿️';

  // 추천 카드 — 다음 할 일 1개만 (v7.1-r3 → v7.2 문장형: 섹션명 단독 노출이 어색하다는 피드백)
  const recommendedId = getRecommendedSection(board);
  const recommended = recommendedId ? getSection(recommendedId) : null;
  const recommendedStatus = recommendedId ? board.sections[recommendedId].status : null;
  const recommendLabel = recommended
    ? recommended.shortTitle ?? recommended.title.split(' — ')[0]
    : '';
  // 부캡션: 열린 고리(사진有·답변無) > 막판 goal-gradient > 토리 대기
  const recommendCaption =
    recommendedId && isPhotoOnlySection(board.sections[recommendedId])
      ? '사진은 담았는데 이야기가 비어 있어 🌰'
      : completedCount >= 4
      ? `이제 ${6 - completedCount}칸이면 끝이야 🐿️`
      : '🐿️ 토리가 여기서 기다려';
  // 본문: 상태에 맞는 다음 행동을 문장으로
  const recommendAction =
    recommendedId && isPhotoOnlySection(board.sections[recommendedId])
      ? `${recommendLabel}, 이야기를 들려줄래? →`
      : recommendedStatus === 'text_complete'
      ? `${recommendLabel}, 사진을 담아볼까? →`
      : `${recommendLabel}, 이야기부터 시작해볼까? →`;

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

        {/* CTA 묶음 — 타이틀 바로 아래 (v7.5): 다음 행동이 스크롤 없이 먼저 보이게 */}
        {/* 추천 카드 — 다음 할 일 하나만 (Hick's law) */}
        {recommended ? (
          <button
            onClick={() => handleSelectSection(recommended.id)}
            className="w-full text-left rounded-2xl border p-4 mb-3 transition-all active:scale-[0.98] animate-slideUp"
            style={{ backgroundColor: recommended.lightColor, borderColor: recommended.color + '40' }}
          >
            <p className="text-caption text-[#6E6962] mb-0.5">{recommendCaption}</p>
            <p className="font-semibold text-body">{recommendAction}</p>
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

        <div className="mb-5 space-y-3">
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
            <button
              onClick={() => router.push('/collage')}
              className="w-full py-3 rounded-2xl border border-[#E5E3DF] bg-white text-[#1C1B19] active:opacity-70 transition-opacity"
            >
              <span className="block text-body font-semibold">🖼️ 내 비전보드 보기</span>
              {/* 부분 가치 노출 (v7.4) — 완주 전에도 보드·배경화면이 이미 만들어진다는 걸 알린다 */}
              {photoSectionCount < 6 && (
                <span className="block text-micro text-[#6E6962] mt-0.5">
                  지금 담긴 사진만으로도 배경화면까지 만들 수 있어
                </span>
              )}
            </button>
          )}
          {/* 인터뷰 없이 사진부터 — 섹션 선택 시트로 /scenes 직행 (v7.3) */}
          <button
            onClick={() => setPhotoSheetOpen(true)}
            className="w-full py-2 text-caption text-[#6E6962] underline active:opacity-70"
          >
            📷 질문 없이, 사진부터 담아볼래? →
          </button>
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
            <span className="text-caption text-[#6B7280]">
              {/* 초반 구간은 분모 생략 — "6개나 남았다"가 아니라 "N칸 했다"로 읽히게 (v7.4) */}
              {textCompleteCount < 4 ? `${textCompleteCount}칸 채워짐` : `${textCompleteCount}/6 채워짐`}
            </span>
          </div>
        )}

        {/* 산책길 지도 (v7.5) — 스테이션 탭이 곧 섹션 이동 (구 미니보드 허브 계약 유지) */}
        <div className="mb-5 animate-slideUp">
          <WalkPathMap
            board={board}
            nextSectionId={recommendedId}
            onSelectSection={handleSelectSection}
          />
          <p className="text-caption text-[#6E6962] text-center mt-2">{walkCaption}</p>
          {/* 보드 연도 — 고정처럼 보인다는 피드백에 편집 진입점 노출 (v7.3) */}
          <div className="text-center mt-1">
            {!yearEditOpen ? (
              <p className="text-caption text-[#6E6962]">
                🗓️ {getTargetYear(board)}년의 나를 그리는 보드야 ·{' '}
                <button
                  onClick={() => setYearEditOpen(true)}
                  className="underline active:opacity-70"
                >
                  연도 바꾸기
                </button>
              </p>
            ) : (
              <div className="inline-flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-3 rounded-full border border-[#E5E3DF] bg-white px-3 py-1.5">
                  <button
                    onClick={() => stepYear(-1)}
                    aria-label="연도 줄이기"
                    className="w-6 h-6 rounded-full bg-[#F5F5F3] text-[#1C1B19] font-semibold active:opacity-70"
                  >
                    −
                  </button>
                  <span className="text-body font-semibold tabular-nums">{getTargetYear(board)}</span>
                  <button
                    onClick={() => stepYear(1)}
                    aria-label="연도 늘리기"
                    className="w-6 h-6 rounded-full bg-[#F5F5F3] text-[#1C1B19] font-semibold active:opacity-70"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setYearEditOpen(false)}
                    className="text-caption font-semibold text-[#1C1B19] active:opacity-70"
                  >
                    완료
                  </button>
                </div>
                <p className="text-micro text-[#6E6962]">미래 일기의 날짜도 같이 바뀌어.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 미시작 섹션 양경로 시트 (v7.1-r4) — 질문 먼저(작은 요청)를 첫 번째로, 사진 먼저도 대등하게 */}
      {pathSheetId !== null && (() => {
        const sheetSection = getSection(pathSheetId);
        if (!sheetSection) return null;
        const label = sheetSection.shortTitle ?? sheetSection.title.split(' — ')[0];
        // 직전 선택 프리하이라이트 (v7.4) — 기본은 질문 먼저, 사진을 골라왔다면 사진 쪽을 주 버튼으로
        const preferPhoto = board.pathChoice?.kind === 'photo';
        const primaryCls = 'w-full py-3.5 rounded-xl text-body font-semibold text-white active:opacity-80';
        const secondaryCls =
          'w-full py-3.5 rounded-xl text-body font-semibold border border-[#E5E3DF] text-[#1C1B19] active:opacity-70';
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
                이야기부터 해도, 사진부터 골라도 돼.
              </p>
              <button
                onClick={() => handlePathChoice(pathSheetId, 'question')}
                className={preferPhoto ? secondaryCls : primaryCls}
                style={preferPhoto ? undefined : { backgroundColor: sheetSection.color }}
              >
                ✍️ 질문에 답하며 시작 →
              </button>
              {/* 선택지별 기대값 (v7.6) — 무엇을 하면 무엇을 얻는지 미리 보여준다 */}
              <p className="text-caption text-[#6E6962] text-center mt-1">
                질문 4개에 답하면 → 미래의 하루 일기
              </p>
              <button
                onClick={() => handlePathChoice(pathSheetId, 'photo')}
                className={`mt-2.5 ${preferPhoto ? primaryCls : secondaryCls}`}
                style={preferPhoto ? { backgroundColor: sheetSection.color } : undefined}
              >
                📷 사진부터 골라볼래 →
              </button>
              <p className="text-caption text-[#6E6962] text-center mt-1">
                사진 3장을 담으면 → 이 칸의 절반 완성
              </p>
            </div>
          </div>
        );
      })()}

      {/* 사진 바로 담기 시트 (v7.3) — 섹션을 고르면 인터뷰 없이 /scenes로 */}
      {photoSheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={() => setPhotoSheetOpen(false)}
        >
          <div
            ref={photoSheetTrapRef}
            role="dialog"
            aria-modal="true"
            aria-label="사진을 담을 칸 선택"
            className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-title font-bold mb-1">어느 칸에 사진을 담을까?</p>
            <p className="text-body text-[#6B7280] leading-relaxed mb-4">
              사진을 담고 나서 이야기는 나중에 해도 돼.
            </p>
            <div className="space-y-2">
              {SECTIONS.map((section) => {
                const sec = board.sections[section.id];
                const up = sec.uploadedImages ?? [];
                const gen = sec.generatedImages ?? [];
                const count = [0, 1, 2].filter((i) => up[i] || gen[i]).length;
                const label = section.shortTitle ?? section.title.split(' — ')[0];
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      track('photo_first_entry', { section: section.id });
                      router.push(`/scenes/${section.id}`);
                    }}
                    className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-[#E5E3DF] bg-white active:opacity-70"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: section.color }}
                      />
                      <span className="text-body font-medium text-[#1C1B19]">{label}</span>
                    </span>
                    <span className="text-caption text-[#6E6962]">
                      {count > 0 ? `사진 ${count}장` : '비어 있어'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showIntro && <DashboardIntroSheet userName={userName} onClose={handleCloseIntro} />}
    </main>
  );
}
