'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, SlotId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';

function StoryToggle({ story, color }: { story: string; color: string }) {
  const lines = story.split('\n');
  const rendered = lines.map((line, li) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={li}>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <strong key={i} className="font-semibold text-[#1C1B19]">{part}</strong>
            : part
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
  return (
    <details className="mt-2 rounded-xl border border-[#E5E3DF] bg-white overflow-hidden">
      <summary className="px-4 py-2.5 text-xs text-[#9CA3AF] cursor-pointer list-none flex justify-between items-center select-none">
        <span>📖 스토리 보기</span>
        <span className="text-[10px]">▾</span>
      </summary>
      <div className="px-4 pb-3 pt-2 border-t border-[#F5F5F3]">
        <p
          className="text-xs leading-relaxed text-[#374151]"
          style={{ borderLeft: `2px solid ${color}40`, paddingLeft: 8 }}
        >
          {rendered}
        </p>
      </div>
    </details>
  );
}

export default function BoardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-2xl mx-auto w-full pb-10">
      <ProcessBar board={board} />
      {/* 헤더 */}
      <div className="px-6 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold">내 비전보드</h1>
          <span className="text-sm text-[#9CA3AF] ml-auto">{completedCount}/6 채워짐</span>
        </div>
        <p className="text-xs text-[#9CA3AF] pl-8">막연했던 바람이, 생생한 장면이 되는 곳.</p>
      </div>

      {/* 섹션별 이미지 그룹 */}
      <div className="px-4 md:px-6 space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 animate-fadeIn">
        {SECTIONS.map((section) => {
          const sectionData = board.sections[section.id];
          const rawImages = sectionData.generatedImages ?? [];
          const images: (string | null)[] = [rawImages[0] ?? null, rawImages[1] ?? null, rawImages[2] ?? null];
          const keyword = sectionData.extractedSlots?.keyword ?? sectionData.slots[2 as SlotId]?.text;
          const isComplete = sectionData.status === 'completed';

          return (
            <div key={section.id}>
              {/* 섹션 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
                {keyword && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: section.lightColor, color: section.color }}
                  >
                    {keyword}
                  </span>
                )}
                {!isComplete && (
                  <button
                    onClick={() => {
                      const sd = board.sections[section.id];
                      if (sd.status === 'text_complete' && sd.sceneText) {
                        router.push(`/moment/${section.id}`);
                      } else {
                        router.push(`/scene/${section.id}`);
                      }
                    }}
                    className="ml-auto text-xs text-[#9CA3AF]"
                  >
                    {board.sections[section.id].status === 'text_complete' ? '이미지 만들기 →' : '장면 그리러 가기 →'}
                  </button>
                )}
              </div>

              {/* 이미지 3칸 */}
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, imgIdx) => (
                  <div key={imgIdx} className="aspect-square">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <button
                        onClick={() => router.push(`/scene/${section.id}`)}
                        className="w-full h-full rounded-xl border-2 border-dashed flex items-center justify-center active:opacity-70"
                        style={{ borderColor: section.color + '40', backgroundColor: section.lightColor }}
                      >
                        {imgIdx === 0 && (
                          <span className="text-xs font-medium text-center leading-tight" style={{ color: section.color + '80' }}>
                            + 장면<br />추가
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 스토리 */}
              {isComplete && sectionData.miniStory && (
                <StoryToggle story={sectionData.miniStory} color={section.color} />
              )}
            </div>
          );
        })}
      </div>

      {completedCount === 6 && (
        <div className="mt-8 px-4">
          <button
            onClick={() => router.push('/finish')}
            className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
          >
            내 비전보드 완성하기 ✦
          </button>
        </div>
      )}
    </main>
  );
}
