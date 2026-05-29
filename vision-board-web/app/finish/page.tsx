'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, markBoardFinished } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';

export default function FinishPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    if (!b.finishedAt) {
      markBoardFinished();
    }
  }, []);

  if (!board) return null;

  const sectionKeywords = SECTIONS.map((section) => {
    const answer = board.sections[section.id].slots[2];
    const kw = answer?.isDeferred ? null : (answer?.text || null);
    return { section, kw };
  });
  const hasAnyKeyword = sectionKeywords.some((item) => item.kw);

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-12 animate-fadeIn">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-8">
        <div className="space-y-2">
          <p className="text-5xl">✦</p>
          <h1 className="text-2xl font-bold mt-4">
            다 완성했어{board.userName ? `, ${board.userName}` : ''}.
          </h1>
          <p className="text-[#6B7280] leading-relaxed">
            여기까지 왔어. 쉽지 않았을 텐데.
          </p>
          <p className="text-[#6B7280]">이게 지금 너의 비전보드야.</p>
        </div>

        {hasAnyKeyword && (
          <div className="w-full bg-white rounded-2xl p-5 border border-[#E5E3DF]">
            <p className="text-xs text-[#9CA3AF] mb-3">내 방향 키워드들</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {sectionKeywords.map(({ section, kw }) => {
                if (!kw) return null;
                return (
                  <span
                    key={section.id}
                    className="text-sm font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: section.lightColor,
                      color: section.color,
                    }}
                  >
                    {kw}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-sm text-[#6B7280] leading-relaxed">
          매일 보고 싶은 곳에 저장해봐.
          <br />
          핸드폰 잠금화면, 노트 첫 페이지, 책상 위 어디든.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => router.push('/board')}
          className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
        >
          내 비전보드 보러 가기
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-sm active:opacity-70 transition-opacity"
        >
          내 답변 다시 보기
        </button>
      </div>
    </main>
  );
}
