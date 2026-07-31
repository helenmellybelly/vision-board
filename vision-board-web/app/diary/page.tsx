'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadBoard,
  dismissStoryUpgradeNudge,
  saveFutureDayStory,
  saveMiniStory,
  saveTargetDate,
  incrementDiaryRegen,
} from '@/lib/storage';
import { getTargetDate, formatDiaryDate } from '@/lib/targetDate';
import { SECTIONS } from '@/lib/questions';
import { needsStoryUpgrade } from '@/lib/milestone';
import { generateBoardStory, generateSectionStory } from '@/lib/storyClient';
import { BoardData, SectionId } from '@/lib/types';
import AccountButton from '@/components/AccountButton';
import { renderStory, BOLD_EDIT_HINT } from '@/components/StoryModal';

// 미래 일기 통합 열람 + 다듬기 (v8.5) — 위계: '미래의 하루 이야기'(보드 층위 대표 글)
// ⊃ '미래 일기'(섹션 층위 원문). v8.5부터 다듬기(AI 다시 쓰기·직접 수정)가 이 화면 인라인으로
// 이사 — /finish는 최초 생성 플로우 전용 ("다듬으러 완성 화면에 재진입"이 어색하다는 오너 피드백).
// v8.5 — 탭바 flex-wrap(가로 슬라이드 제거), 전체 탭의 6편 부록 삭제(섹션 탭과 중복),
// 헤더에 oneSentence(북극성) 승격 + 날짜 탭 수정(/scene 전례 — 보드 날짜 1개).
export default function DiaryPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [tab, setTab] = useState<'all' | SectionId>('all');
  const [editingDate, setEditingDate] = useState(false);
  // 보드 이야기 다듬기 상태 — AI 재작성은 확인 배너를 거친다(직접 수정분 유실 경고)
  const [aiConfirm, setAiConfirm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  // 섹션 일기 다듬기 상태 — /scene과 같은 2회 캡(diaryRegenCount) 공유
  const [secLoading, setSecLoading] = useState(false);
  const [secFailed, setSecFailed] = useState(false);
  const [editingSec, setEditingSec] = useState(false);
  const [secDraft, setSecDraft] = useState('');

  useEffect(() => {
    const b = loadBoard();
    // 온보딩 전 딥링크 가드 (/finish 관례와 동일)
    if (!b.onboardingDone) {
      router.replace('/');
      return;
    }
    setBoard(b);
  }, [router]);

  if (!board) return null;

  const hasDiary = (id: SectionId) => {
    const story = board.sections[id]?.miniStory;
    return !!story && story.trim() !== '';
  };
  const sectionLabel = (s: (typeof SECTIONS)[number]) => s.shortTitle ?? s.title.split(' — ')[0];
  const activeSection = tab === 'all' ? null : SECTIONS.find((s) => s.id === tab)!;

  // 탭 전환 — 이전 탭의 편집·확인 상태를 접고 맨 위로 (긴 본문을 읽던 스크롤 위치가
  // 새 탭 내용 아래의 여백으로 남아 "중복 스크롤"로 보이던 문제, v8.5 오너 피드백)
  function selectTab(next: 'all' | SectionId) {
    setTab(next);
    setAiConfirm(false);
    setEditingStory(false);
    setSecLoading(false);
    setSecFailed(false);
    setEditingSec(false);
    window.scrollTo(0, 0);
  }

  async function rewriteBoardStory() {
    if (!board) return;
    // oneSentence 없이 이야기만 있는 비정상 데이터 가드 — 최초 생성 플로우로 폴백
    if (!board.oneSentence) {
      router.push('/finish');
      return;
    }
    setAiConfirm(false);
    setAiFailed(false);
    setAiLoading(true);
    try {
      const story = await generateBoardStory(board);
      // ⚠️ 반드시 saveFutureDayStory 경유 — storyPromptVersion·storyWrittenAtCount 스탬프가
      // 재작성 넛지 2종을 접는다 (직접 saveBoard 금지)
      saveFutureDayStory(story);
      setBoard(loadBoard());
    } catch {
      setAiFailed(true);
    }
    setAiLoading(false);
  }

  async function rewriteSectionStory(id: SectionId) {
    if (!board) return;
    setSecFailed(false);
    setSecLoading(true);
    try {
      const story = await generateSectionStory(board, id);
      saveMiniStory(id, story);
      // 성공 시에만 캡 소진 (/scene handleRegenerate 관례)
      incrementDiaryRegen(id);
      setBoard(loadBoard());
    } catch {
      setSecFailed(true);
    }
    setSecLoading(false);
  }

  return (
    <main className="relative min-h-screen flex flex-col max-w-md mx-auto w-full px-6 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] animate-fadeIn">
      {/* 계정 진입점 — 헤더 없는 몰입 화면이라 우상단 고정 (/finish 관례) */}
      <div className="absolute top-3 right-3">
        <AccountButton />
      </div>

      {/* 헤더 — oneSentence(유저가 직접 쓴 북극성 문장)를 모든 탭에서 보이게 승격 (v8.5) */}
      <div className="mb-4">
        <h1 className="text-display font-bold mb-1">
          📖 {board.userName ? `${board.userName}의 미래 일기` : '내 미래 일기'}
        </h1>
        {board.oneSentence && (
          <p className="text-body font-semibold leading-relaxed text-[#1C1B19] mb-1">
            &ldquo;{board.oneSentence}&rdquo;
          </p>
        )}
        {/* 일기 날짜 — 탭하면 수정 (/scene 전례). 보드 날짜 1개를 전 일기가 공유 */}
        {editingDate ? (
          <>
            <input
              type="date"
              value={getTargetDate(board)}
              onChange={(e) => {
                if (!e.target.value) return;
                saveTargetDate(e.target.value);
                setBoard(loadBoard());
              }}
              onBlur={() => setEditingDate(false)}
              autoFocus
              className="text-caption font-semibold text-[#1C1B19] bg-white border border-[#E5E3DF] rounded-lg px-2 py-1 outline-none"
            />
            <p className="text-micro text-[#C9C5BE] mt-1">모든 일기에 같은 날짜가 적혀.</p>
          </>
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            aria-label="일기 날짜 수정"
            className="flex items-center gap-1.5 text-caption text-[#6E6962] active:opacity-70"
          >
            <span>🗓️ {formatDiaryDate(getTargetDate(board))} — 그 삶이 이루어진 날</span>
            <span className="text-micro text-[#C9C5BE]" aria-hidden="true">
              ✏️
            </span>
          </button>
        )}
      </div>

      {/* 탭바 — flex-wrap 2행 (v8.5: 가로 스크롤 슬라이드가 미관을 해친다는 피드백).
          일기 없는 섹션도 탭은 노출(6칸 구조가 보이게), 빈 상태로 안내. role="tab" 7개는 계약 */}
      <div
        role="tablist"
        aria-label="일기 보기 선택"
        className="flex flex-wrap gap-1.5 pb-3 mb-5 border-b border-[#F0EEEA]"
      >
        <button
          role="tab"
          aria-selected={tab === 'all'}
          onClick={() => selectTab('all')}
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-caption font-semibold transition-colors ${
            tab === 'all'
              ? 'bg-[#1C1B19] text-white'
              : 'border border-[#E5E3DF] text-[#6E6962] active:opacity-70'
          }`}
        >
          전체
        </button>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={tab === s.id}
            onClick={() => selectTab(s.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-caption font-semibold transition-colors ${
              tab === s.id
                ? 'text-white'
                : hasDiary(s.id)
                ? 'border border-[#E5E3DF] text-[#6E6962] active:opacity-70'
                : 'border border-[#F0EEEA] text-[#C9C5BE] active:opacity-70'
            }`}
            style={tab === s.id ? { backgroundColor: s.color } : undefined}
          >
            {sectionLabel(s)}
          </button>
        ))}
      </div>

      {tab === 'all' ? (
        /* 전체 탭 = 대표 글 하나 (v8.5 — 6편 부록은 섹션 탭과 중복이라 삭제, 오너 피드백) */
        <section className="mb-8">
          <p className="text-body font-semibold mb-2">미래의 하루 이야기</p>
          {board.futureDayStory ? (
            <>
              <div className="bg-[#F5F5F3] rounded-2xl p-5">
                {aiLoading ? (
                  <p className="text-body leading-relaxed text-[#6B7280] animate-pulse">
                    네 하루를 다시 쓰고 있어...
                  </p>
                ) : editingStory ? (
                  <>
                    <textarea
                      value={storyDraft}
                      onChange={(e) => setStoryDraft(e.target.value)}
                      rows={12}
                      autoFocus
                      className="w-full text-body leading-relaxed rounded-xl border border-[#E5E3DF] bg-white px-3 py-2.5 resize-none focus:outline-none focus:border-[#C9C5BE]"
                    />
                    <p className="text-micro text-[#C9C5BE] mt-1 mb-2">{BOLD_EDIT_HINT}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const next = storyDraft.trim();
                          if (!next) return;
                          // ⚠️ saveFutureDayStory 경유 필수 — 버전·카운트 스탬프 (직접 저장도 최신본)
                          saveFutureDayStory(next);
                          setBoard(loadBoard());
                          setEditingStory(false);
                        }}
                        disabled={!storyDraft.trim()}
                        className="flex-1 py-2 rounded-lg text-caption font-semibold text-white bg-[#1C1B19] disabled:opacity-40"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingStory(false)}
                        className="px-4 py-2 rounded-lg text-caption text-[#6E6962] border border-[#E5E3DF]"
                      >
                        취소
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-body leading-relaxed">{renderStory(board.futureDayStory)}</p>
                )}
              </div>

              {/* 실패 — 실패 문자열을 저장하지 않고 재시도만 (v7.4 감사 M4 관례) */}
              {aiFailed && !aiLoading && (
                <div className="mt-2 flex items-center gap-3">
                  <p className="flex-1 text-caption text-[#92400E]">
                    쓰다가 문제가 생겼어. 잠시 후 다시 해볼래?
                  </p>
                  <button
                    onClick={rewriteBoardStory}
                    className="text-caption font-semibold underline text-[#92400E] active:opacity-70"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {/* AI 재작성 확인 배너 (/finish confirmRewrite 이관) — 직접 수정분 유실 경고 */}
              {aiConfirm && !aiLoading && (
                <div className="mt-2 rounded-xl bg-[#FEF9C3] px-4 py-3">
                  <p className="text-caption text-[#92400E] mb-2">
                    지금 이야기를 처음부터 새로 쓸까? 직접 고친 부분은 사라져.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={rewriteBoardStory}
                      className="text-caption font-semibold text-[#92400E]"
                    >
                      새로 쓰기
                    </button>
                    <button
                      onClick={() => setAiConfirm(false)}
                      className="text-caption text-[#6E6962]"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 다듬기 액션 — /finish 이동 대신 인라인 (v8.5). 보드 층위 재작성은 무제한(v7.8 계약) */}
              {!editingStory && !aiLoading && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <button
                    onClick={() => {
                      setStoryDraft(board.futureDayStory!);
                      setEditingStory(true);
                      setAiConfirm(false);
                    }}
                    className="py-1.5 text-caption text-[#6E6962] underline active:opacity-70"
                  >
                    ✍️ 직접 수정하기
                  </button>
                  <button
                    onClick={() => setAiConfirm(true)}
                    className="py-1.5 text-caption text-[#6E6962] underline active:opacity-70"
                  >
                    🔄 AI로 다시 쓰기
                  </button>
                </div>
              )}

              {/* 프롬프트 업그레이드 재작성 넛지 (v8.4) — 옛 프롬프트로 쓴 이야기만, 닫으면 재노출 없음.
                  v8.5: /finish 이동 대신 인라인 재작성 확인을 연다 */}
              {needsStoryUpgrade(board) && !aiLoading && !editingStory && (
                <div className="mt-2 rounded-xl border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-2 flex items-center gap-2">
                  <button
                    onClick={() => setAiConfirm(true)}
                    className="flex-1 text-left text-caption text-[#1C1B19] underline active:opacity-70"
                  >
                    ✍️ 이야기 짓는 솜씨가 늘었어 — 다시 써볼까? →
                  </button>
                  <button
                    onClick={() => {
                      dismissStoryUpgradeNudge();
                      setBoard(loadBoard());
                    }}
                    aria-label="다시 쓰기 안내 닫기"
                    className="text-[#C9C5BE] text-caption px-1 active:opacity-60"
                  >
                    ×
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E3DF] px-5 py-6 text-center">
              <p className="text-body text-[#6B7280] leading-relaxed">
                여섯 그루가 다 자라면 하루 이야기가 완성돼 🌳
              </p>
            </div>
          )}
        </section>
      ) : (
        /* 섹션 탭 — 해당 섹션 일기 + 인라인 다듬기 (v8.5: '원하는 내 모습' 등도 수정 가능하게) */
        <section className="mb-8">
          <p className="text-body font-semibold mb-3" style={{ color: activeSection!.color }}>
            {sectionLabel(activeSection!)}의 미래 일기
          </p>
          {hasDiary(activeSection!.id) ? (
            <>
              {secLoading ? (
                <p className="text-body leading-relaxed text-[#6B7280] animate-pulse">
                  이 칸의 하루를 다시 그리고 있어...
                </p>
              ) : editingSec ? (
                <>
                  <textarea
                    value={secDraft}
                    onChange={(e) => setSecDraft(e.target.value)}
                    rows={10}
                    autoFocus
                    className="w-full text-body leading-relaxed rounded-xl border border-[#E5E3DF] bg-white px-3 py-2.5 resize-none focus:outline-none focus:border-[#C9C5BE]"
                  />
                  <p className="text-micro text-[#C9C5BE] mt-1 mb-2">{BOLD_EDIT_HINT}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const next = secDraft.trim();
                        if (!next) return;
                        saveMiniStory(activeSection!.id, next);
                        setBoard(loadBoard());
                        setEditingSec(false);
                      }}
                      disabled={!secDraft.trim()}
                      className="flex-1 py-2 rounded-lg text-caption font-semibold text-white disabled:opacity-40"
                      style={{ backgroundColor: activeSection!.color }}
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingSec(false)}
                      className="px-4 py-2 rounded-lg text-caption text-[#6E6962] border border-[#E5E3DF]"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <p
                  className="text-body leading-relaxed text-[#374151]"
                  style={{ borderLeft: `2px solid ${activeSection!.color}40`, paddingLeft: 10 }}
                >
                  {renderStory(board.sections[activeSection!.id].miniStory!)}
                </p>
              )}

              {secFailed && !secLoading && (
                <div className="mt-2 flex items-center gap-3">
                  <p className="flex-1 text-caption text-[#92400E]">
                    쓰다가 문제가 생겼어. 잠시 후 다시 해볼래?
                  </p>
                  <button
                    onClick={() => rewriteSectionStory(activeSection!.id)}
                    className="text-caption font-semibold underline text-[#92400E] active:opacity-70"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {!editingSec && !secLoading && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <button
                      onClick={() => {
                        setSecDraft(board.sections[activeSection!.id].miniStory!);
                        setEditingSec(true);
                      }}
                      className="py-1.5 text-caption text-[#6E6962] underline active:opacity-70"
                    >
                      ✍️ 직접 수정하기
                    </button>
                    {/* 재생성은 /scene과 합산 2회까지 — 같은 카운터(diaryRegenCount) 공유 (v7.4 계약) */}
                    {(board.sections[activeSection!.id].diaryRegenCount ?? 0) < 2 && (
                      <button
                        onClick={() => rewriteSectionStory(activeSection!.id)}
                        className="py-1.5 text-caption text-[#6E6962] underline active:opacity-70"
                      >
                        🔄 AI로 수정하기
                      </button>
                    )}
                  </div>
                  {(board.sections[activeSection!.id].diaryRegenCount ?? 0) >= 2 && (
                    <p className="text-micro text-[#9CA3AF] mt-1.5 leading-relaxed">
                      새로 쓰기는 여기까지. 이제부터는 네 손으로 다듬는 게 제일 정확해 — 위의
                      &lsquo;직접 수정하기&rsquo;로 고쳐봐.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E3DF] px-5 py-6 text-center">
              <p className="text-body text-[#6B7280] leading-relaxed mb-3">
                이 칸의 일기는 아직 안 썼어 🌱
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-caption font-semibold underline text-[#1C1B19] active:opacity-70"
              >
                대시보드에서 이어 쓰기 →
              </button>
            </div>
          )}
        </section>
      )}

      {/* 하단 동선 */}
      <div className="mt-auto space-y-2">
        <button
          onClick={() => router.push('/collage')}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: '#1C1B19' }}
        >
          내 비전보드 보기 →
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-2 text-caption text-[#6E6962] active:opacity-70"
        >
          대시보드로
        </button>
      </div>
    </main>
  );
}
