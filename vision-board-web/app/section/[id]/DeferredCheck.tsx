'use client';

import { useEffect } from 'react';
import { Section, SlotAnswer, SlotId, PHASE1_SLOTS } from '@/lib/types';

const SLOT_LABELS: Record<number, string> = {
  1: '지금',
  2: '방향 키워드',
  3: '원해!',
  5: '더 들여다보기',
};

interface Props {
  section: Section;
  slots: Record<SlotId, SlotAnswer | undefined>;
  onAnswerSlot: (slotIndex: number) => void;
  onDeferAll: () => void;
}

export default function DeferredCheck({ section, slots, onAnswerSlot, onDeferAll }: Props) {
  const deferredSlots = PHASE1_SLOTS
    .map((slotId, idx) => ({ slotId, idx, answer: slots[slotId as SlotId] }))
    .filter(({ answer }) => !answer?.text?.trim() || answer.isDeferred);

  useEffect(() => {
    if (deferredSlots.length === 0) {
      onDeferAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSlots.length]);

  if (deferredSlots.length === 0) return null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      <div className="flex-1 space-y-5">
        <div>
          <span
            className="text-caption font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            잠깐
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-title font-bold">아직 못 답한 질문들이 있어.</h2>
          <p className="text-body text-[#6B7280]">지금 답하면 더 생생한 비전보드가 만들어져.</p>
        </div>

        <div className="space-y-3">
          {deferredSlots.map(({ slotId, idx }) => (
            <button
              key={slotId}
              onClick={() => onAnswerSlot(idx)}
              className="w-full text-left rounded-2xl p-4 border border-[#E5E3DF] bg-white active:opacity-70 transition-opacity"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-caption font-semibold mb-0.5" style={{ color: section.color }}>
                    {SLOT_LABELS[slotId]}
                  </p>
                  <p className="text-body text-[#6E6962] italic">아직 답변 전</p>
                </div>
                <span className="text-[#C4C2BE]">›</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <button
          onClick={onDeferAll}
          className="w-full border border-[#E5E3DF] text-[#6B7280] py-4 rounded-2xl text-body font-medium active:opacity-70 transition-opacity"
        >
          나중에 한꺼번에 답할게요
        </button>
      </div>
    </div>
  );
}
