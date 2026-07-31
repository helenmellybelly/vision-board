'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { getTargetDate, formatDiaryDate } from '@/lib/targetDate';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';
import AccountButton from '@/components/AccountButton';
import { renderStory } from '@/components/StoryModal';

// 미래 일기 통합 열람 (v8.3) — 읽기 전용. 위계: '미래의 하루 이야기'(보드 층위 대표 글)
// ⊃ '미래 일기'(섹션 층위 원문). 생성·재작성은 /finish 소관 — 여기는 감상만 담당한다.
// 구 DiarySheet 모달(대시보드)을 이 페이지가 흡수 — 대시보드의 일기 진입점은 /diary 링크 하나.
export default function DiaryPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

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

  const entries = SECTIONS.filter((s) => {
    const story = board.sections[s.id]?.miniStory;
    return !!story && story.trim() !== '';
  });

  return (
    <main className="relative min-h-screen flex flex-col max-w-md mx-auto w-full px-6 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] animate-fadeIn">
      {/* 계정 진입점 — 헤더 없는 몰입 화면이라 우상단 고정 (/finish 관례) */}
      <div className="absolute top-3 right-3">
        <AccountButton />
      </div>

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-display font-bold mb-1">
          📖 {board.userName ? `${board.userName}의 미래 일기` : '내 미래 일기'}
        </h1>
        <p className="text-caption text-[#6E6962]">
          🗓️ {formatDiaryDate(getTargetDate(board))} — 그 삶이 이루어진 날
        </p>
      </div>

      {/* 미래의 하루 이야기 — 대표 글 */}
      <section className="mb-8">
        <p className="text-body font-semibold mb-2">미래의 하루 이야기</p>
        {board.futureDayStory ? (
          <>
            <div className="bg-[#F5F5F3] rounded-2xl p-5">
              <p className="text-body leading-relaxed">{renderStory(board.futureDayStory)}</p>
            </div>
            {board.oneSentence && (
              <blockquote className="mt-3 px-4 py-3 border-l-2 border-[#1C1B19]">
                <p className="text-body font-semibold leading-relaxed text-[#1C1B19]">
                  &ldquo;{board.oneSentence}&rdquo;
                </p>
              </blockquote>
            )}
            <button
              onClick={() => router.push('/finish')}
              className="mt-2 py-1.5 text-caption text-[#6E6962] underline active:opacity-70"
            >
              이야기 다듬기 →
            </button>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#E5E3DF] px-5 py-6 text-center">
            <p className="text-body text-[#6B7280] leading-relaxed">
              여섯 그루가 다 자라면 하루 이야기가 완성돼 🌳
            </p>
          </div>
        )}
      </section>

      {/* 섹션 일기 원문 — 구 DiarySheet 목록 마크업 이관 */}
      {entries.length > 0 && (
        <section className="mb-8">
          <p className="text-body font-semibold mb-3">미래 일기 {entries.length}편</p>
          <div className="space-y-5">
            {entries.map((s) => (
              <div key={s.id}>
                <p className="text-caption font-semibold mb-1.5" style={{ color: s.color }}>
                  {s.shortTitle ?? s.title.split(' — ')[0]}
                </p>
                <p
                  className="text-body leading-relaxed text-[#374151]"
                  style={{ borderLeft: `2px solid ${s.color}40`, paddingLeft: 10 }}
                >
                  {renderStory(board.sections[s.id].miniStory!)}
                </p>
              </div>
            ))}
          </div>
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
