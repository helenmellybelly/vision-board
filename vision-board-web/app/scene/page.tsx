'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';

export default function SceneHubPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const availableSections = SECTIONS.filter(
    (s) => board.sections[s.id].status === 'text_complete' || board.sections[s.id].status === 'completed'
  );

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 -ml-2 text-[#6B7280] text-xl active:opacity-60"
        >
          ‹
        </button>
        <div>
          <h1 className="text-xl font-bold">미래의 하루 그리기</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            원하는 섹션부터 골라봐.
          </p>
        </div>
      </div>

      <p className="text-sm text-[#6B7280] mb-5 leading-relaxed">
        답한 내용을 보면서, 그 키워드가 이루어진 미래의 하루를 그려볼 거야. 하루를 그리고 나면 어울리는 사진도 골라봐.
      </p>

      <div className="space-y-3 flex-1">
        {availableSections.map((section) => {
          const sectionData = board.sections[section.id];
          const sceneText = sectionData.sceneText;
          const hasImages = sectionData.images.some((img) => img !== null);
          const isDone = sectionData.status === 'completed';
          const keyword = sectionData.slots[2]?.text;

          return (
            <button
              key={section.id}
              onClick={() => router.push(`/scene/${section.id}`)}
              className="w-full text-left rounded-2xl p-4 border border-[#E5E3DF] bg-white active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{section.title.split(' — ')[0]}</p>
                    {keyword && (
                      <p className="text-xs mt-0.5" style={{ color: section.color }}>
                        키워드: {keyword}
                      </p>
                    )}
                    {sceneText ? (
                      <p className="text-xs text-[#6E6962] mt-0.5 line-clamp-1">{sceneText}</p>
                    ) : (
                      <p className="text-xs text-[#C4C2BE] mt-0.5">아직 그리기 전이야</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isDone ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: section.lightColor, color: section.color }}
                    >
                      완료
                    </span>
                  ) : sceneText ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#D97706] font-medium">
                      사진 남음
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] font-medium">
                      그리기 전
                    </span>
                  )}
                  <span className="text-[#6E6962] text-sm">›</span>
                </div>
              </div>
            </button>
          );
        })}

        {availableSections.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#6E6962] text-sm">
              섹션 답변을 먼저 완료해야 해.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 text-sm font-semibold underline text-[#6B7280]"
            >
              섹션으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
