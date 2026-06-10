'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, saveBoardYear, saveFutureDayStory } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';
import StoryModal from '@/components/StoryModal';
import VisionBoardCollage from '@/components/VisionBoardCollage';

export default function CollagePage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;

  // 전 섹션의 이미지(업로드 우선, AI 생성 보조)를 하나로 모음
  const collageImages = SECTIONS.flatMap((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return [0, 1, 2]
      .map((i) => uploaded[i] || generated[i] || null)
      .filter((img): img is string => !!img);
  });
  const boardYear = board.boardYear ?? String(new Date().getFullYear());

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-3xl mx-auto w-full pb-10">
      {/* 헤더 */}
      <div className="px-6 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/board')}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold">한눈에 보기</h1>
        </div>
        <p className="text-xs text-[#9CA3AF] pl-8">내 비전보드를 하나로.</p>
      </div>

      <div className="px-4 md:px-6 animate-fadeIn">
        {collageImages.length > 0 ? (
          <VisionBoardCollage
            compact={false}
            images={collageImages}
            year={boardYear}
            onYearChange={(y) => {
              saveBoardYear(y);
              setBoard(loadBoard());
            }}
          />
        ) : (
          <div className="text-center py-16">
            <p className="text-sm text-[#9CA3AF]">
              아직 담긴 사진이 없어.
              <br />
              비전보드에 사진을 1개 이상 올리면 여기서 볼 수 있어.
            </p>
            <button
              onClick={() => router.push('/board')}
              className="mt-6 px-6 py-3 rounded-2xl text-sm font-semibold text-white bg-[#1C1B19] active:opacity-80"
            >
              비전보드로 가기 →
            </button>
          </div>
        )}

        {/* 미래의 하루 이야기 — 있을 때 / 6개 영역 완성 시에만 노출 */}
        {board.futureDayStory ? (
          <div className="mt-8 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">미래의 하루 이야기</span>
              <button
                onClick={() => router.push('/finish')}
                className="text-xs text-[#9CA3AF] active:opacity-70"
              >
                다시 쓰러 가기 →
              </button>
            </div>
            <StoryModal
              story={board.futureDayStory}
              color="#1C1B19"
              label="📖 미래의 하루 읽기"
              title="미래의 하루 이야기"
              onSave={(s) => {
                saveFutureDayStory(s);
                setBoard(loadBoard());
              }}
            />
          </div>
        ) : completedCount === 6 ? (
          <div className="mt-8 space-y-2">
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
            >
              내 비전보드 완성하기 🐿️
            </button>
            <p className="text-[11px] text-[#9CA3AF] text-center">
              완성하면 미래의 하루 이야기를 써줄게.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
