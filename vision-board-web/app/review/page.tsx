'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, SlotId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';

const SLOT_LABELS: Record<number, string> = {
  1: '지금의 나',
  2: '키워드',
  3: '원해',
  5: '이뤄졌을 때',
};

function AISummaryCard({ board }: { board: BoardData }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function fetchSummary() {
    setLoading(true);
    setError(false);
    try {
      const sections = SECTIONS.map((sec) => {
        const data = board.sections[sec.id];
        return {
          title: sec.title.split(' — ')[0],
          current: data.slots[1 as SlotId]?.text || '',
          keyword: data.slots[2 as SlotId]?.text || '',
          bucketList: data.slots[3 as SlotId]?.text || '',
          feeling: data.slots[5 as SlotId]?.text || '',
        };
      });
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: board.userName, sections }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="mx-6 mb-5 rounded-2xl bg-[#F9F8F6] p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full bg-[#E5E3DF]" />
          <div className="h-3 w-24 rounded bg-[#E5E3DF]" />
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded bg-[#E5E3DF] w-full" />
          <div className="h-3 rounded bg-[#E5E3DF] w-5/6" />
          <div className="h-3 rounded bg-[#E5E3DF] w-4/6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-6 mb-5 rounded-2xl bg-[#F9F8F6] p-4">
        <p className="text-sm text-[#9CA3AF] mb-2">AI 요약을 불러오지 못했어.</p>
        <button
          onClick={fetchSummary}
          className="text-xs text-[#6B7280] underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="mx-6 mb-5 rounded-2xl bg-[#1C1B19] p-4">
      <p className="text-xs font-semibold text-[#9CA3AF] mb-2 tracking-wider">AI 종합 리뷰</p>
      <p className="text-sm text-white leading-relaxed">{summary}</p>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  if (!board) return null;

  const leftSections = SECTIONS.slice(0, 3);
  const rightSections = SECTIONS.slice(3, 6);

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full pb-10">
      <ProcessBar board={board} />

      {/* 헤더 */}
      <div className="px-6 pt-4 pb-4">
        <p className="text-xs font-semibold text-[#9CA3AF] tracking-widest mb-2">REVIEW</p>
        <h1 className="text-2xl font-bold leading-snug mb-1">
          수고했어. 다각면의 너의 모습을 발견했네 ✦
        </h1>
        <p className="text-[#6B7280] text-sm leading-relaxed">
          네가 여기까지 써온 것들을 AI가 종합해서 정리해줬어.
        </p>
      </div>

      {/* AI 요약 카드 */}
      <AISummaryCard board={board} />

      {/* 섹션별 답변 — 2열 그리드 */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {/* 좌측: 섹션 1·2·3 */}
          <div className="space-y-3">
            {leftSections.map((section) => {
              const sectionData = board.sections[section.id];
              return (
                <div
                  key={section.id}
                  className="rounded-2xl overflow-hidden border border-[#E5E3DF]"
                >
                  <div
                    className="px-3 py-2 flex items-center gap-1.5"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                    <span className="font-semibold text-xs leading-tight" style={{ color: section.color }}>
                      {section.title.split(' — ')[0]}
                    </span>
                  </div>
                  <div className="bg-white divide-y divide-[#F3F4F6]">
                    {[2, 3].map((slotId) => {
                      const answer = sectionData.slots[slotId as SlotId];
                      const label = SLOT_LABELS[slotId];
                      const text = answer?.text?.trim();
                      return (
                        <div key={slotId} className="px-3 py-2">
                          <p className="text-[10px] text-[#9CA3AF] mb-0.5">{label}</p>
                          <p className={`text-xs leading-relaxed ${text ? 'text-[#1C1B19]' : 'text-[#C4C2BE]'}`}>
                            {text || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 우측: 섹션 4·5·6 */}
          <div className="space-y-3">
            {rightSections.map((section) => {
              const sectionData = board.sections[section.id];
              return (
                <div
                  key={section.id}
                  className="rounded-2xl overflow-hidden border border-[#E5E3DF]"
                >
                  <div
                    className="px-3 py-2 flex items-center gap-1.5"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                    <span className="font-semibold text-xs leading-tight" style={{ color: section.color }}>
                      {section.title.split(' — ')[0]}
                    </span>
                  </div>
                  <div className="bg-white divide-y divide-[#F3F4F6]">
                    {[2, 3].map((slotId) => {
                      const answer = sectionData.slots[slotId as SlotId];
                      const label = SLOT_LABELS[slotId];
                      const text = answer?.text?.trim();
                      return (
                        <div key={slotId} className="px-3 py-2">
                          <p className="text-[10px] text-[#9CA3AF] mb-0.5">{label}</p>
                          <p className={`text-xs leading-relaxed ${text ? 'text-[#1C1B19]' : 'text-[#C4C2BE]'}`}>
                            {text || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 장면 그리기 온보딩 블록 */}
      <div className="mx-6 mb-6 rounded-2xl bg-[#F9F8F6] p-5 border border-[#E5E3DF]">
        <p className="text-xs font-semibold text-[#9CA3AF] tracking-widest mb-3">NEXT STEP</p>
        <h3 className="text-base font-bold mb-2 leading-snug">이제 장면을 그릴 거야</h3>
        <p className="text-sm text-[#6B7280] leading-relaxed mb-2">
          지금까지 쓴 단어들을 구체적인 장면과 이미지로 만드는 단계야.
        </p>
        <p className="text-sm text-[#6B7280] leading-relaxed">
          머릿속에만 있던 것들이 이미지로 선명해지면, 원하는 것을 더 강하게 느낄 수 있어.
          각 섹션마다 장면 3가지를 쓰고, 거기에 어울리는 사진을 담게 돼.
        </p>
      </div>

      {/* 하단 CTA */}
      <div className="px-6 space-y-3">
        <button
          onClick={() => router.push('/scene/1')}
          className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
        >
          장면 그리기 시작 →
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-2 text-sm text-[#9CA3AF]"
        >
          대시보드로
        </button>
      </div>
    </main>
  );
}
