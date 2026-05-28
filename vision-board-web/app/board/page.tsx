'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';

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
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-4 py-10">
      <div className="flex items-center gap-3 mb-6 px-2">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
        >
          ‹
        </button>
        <h1 className="text-xl font-bold">비전보드</h1>
        <span className="text-sm text-[#9CA3AF] ml-auto">{completedCount}/6</span>
      </div>

      <div className="grid grid-cols-3 gap-2 animate-fadeIn">
        {SECTIONS.map((section) => {
          const sectionData = board.sections[section.id];
          const images = sectionData.images;
          const hasImages = images.some((img) => img !== null);

          return images.map((img, imgIdx) => {
            const key = `${section.id}-${imgIdx}`;
            return (
              <button
                key={key}
                onClick={() => router.push(`/section/${section.id}`)}
                className="aspect-square rounded-xl overflow-hidden active:opacity-80 transition-opacity relative"
              >
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    {imgIdx === 0 && (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: section.color }}
                      >
                        {section.title}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          });
        })}
      </div>

      {completedCount === 6 && (
        <div className="mt-6">
          <button
            onClick={() => router.push('/finish')}
            className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
          >
            완성 ✦
          </button>
        </div>
      )}
    </main>
  );
}
