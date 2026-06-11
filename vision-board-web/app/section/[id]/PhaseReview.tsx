'use client';

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
  onEdit: (slotIndex: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PhaseReview({ section, slots, onEdit, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      <div className="flex-1 space-y-5">
        <div>
          <span
            className="text-caption font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            내 답 확인
          </span>
        </div>
        <h2 className="text-title font-bold">내가 쓴 것들, 한번 봐봐</h2>
        <p className="text-body text-[#6B7280]">
          마음에 안 드는 거 있으면 탭해서 바꿀 수 있어.
        </p>

        <div className="space-y-3">
          {PHASE1_SLOTS.map((slotId, idx) => {
            const answer = slots[slotId as SlotId];
            return (
              <button
                key={slotId}
                onClick={() => onEdit(idx)}
                className="w-full text-left rounded-2xl p-4 border border-[#E5E3DF] bg-white active:opacity-70 transition-opacity"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p
                      className="text-caption font-semibold mb-1"
                      style={{ color: section.color }}
                    >
                      {SLOT_LABELS[slotId]}
                    </p>
                    {answer && !answer.isDeferred ? (
                      <p className="text-body leading-relaxed">{answer.text}</p>
                    ) : (
                      <p className="text-body text-[#6E6962] italic">아직 비워뒀어</p>
                    )}
                  </div>
                  <span className="text-[#C4C2BE] text-body flex-shrink-0">✎</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <button
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          좋아, 이대로 갈게
        </button>
        <button onClick={onBack} className="w-full py-2 text-body text-[#6B7280]">
          이전
        </button>
      </div>
    </div>
  );
}
