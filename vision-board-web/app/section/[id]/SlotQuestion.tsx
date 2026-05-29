'use client';

import { useState } from 'react';
import { Section, Slot, SlotAnswer } from '@/lib/types';

interface Props {
  section: Section;
  slot: Slot;
  slotIndex: number;
  totalSlots: number;
  savedAnswer?: SlotAnswer;
  isEditing?: boolean;
  onSave: (answer: SlotAnswer) => void;
  onSkip: () => void;
  onBack?: () => void;
}

const NEXT_LABELS: Record<number, string> = {
  0: '다음 질문은 뭐야?',
  1: '다했어. 그 다음은 뭐야?',
  2: '좋아, 계속 가보자',
};

export default function SlotQuestion({
  section,
  slot,
  slotIndex,
  totalSlots,
  savedAnswer,
  isEditing,
  onSave,
  onSkip,
  onBack,
}: Props) {
  const [text, setText] = useState(savedAnswer?.isDeferred ? '' : (savedAnswer?.text || ''));
  const [showHelp, setShowHelp] = useState(false);

  const hasText = text.trim().length > 0;
  const isLastSlot = slotIndex === totalSlots - 1;
  const nextLabel = isLastSlot ? '다 됐다! 내 답 보여줘' : (NEXT_LABELS[slotIndex] ?? '다음 질문은 뭐야?');

  function handleNext() {
    onSave({ text: text.trim(), isDeferred: false });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      {/* 진행 바 */}
      <div className="flex gap-1 mb-6">
        {Array.from({ length: totalSlots }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ backgroundColor: i <= slotIndex ? section.color : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 space-y-5">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            {slotIndex + 1} / {totalSlots}
          </span>
          {isEditing && (
            <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">수정 중</span>
          )}
        </div>

        <h2 className="text-xl font-bold leading-snug">{slot.mainQuestion}</h2>

        {/* 예시 — 기본 노출 */}
        {slot.example && (
          <div className="text-sm text-[#6B7280] bg-[#F9F8F6] rounded-xl px-3 py-2.5 leading-relaxed">
            <span className="text-xs font-semibold text-[#9CA3AF] mr-1">예)</span>
            {slot.example}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={slot.placeholder}
          rows={4}
          className="w-full bg-white border border-[#E5E3DF] rounded-2xl p-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
          autoFocus
        />

        {/* 도움이 필요해요 */}
        {slot.helpQuestions.length > 0 && (
          <div>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-[#6B7280]"
            >
              <span className="text-base">💬</span>
              <span>{showHelp ? '닫기' : '답변하는데 도움이 필요해요'}</span>
            </button>
            {showHelp && (
              <div className="mt-3 space-y-2">
                {slot.helpQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl text-sm text-[#1C1B19] leading-relaxed"
                    style={{ backgroundColor: section.lightColor }}
                  >
                    {q.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 pt-4">
        {/* 메인 CTA — 텍스트 있을 때만 활성화 */}
        <button
          onClick={handleNext}
          disabled={!hasText}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all"
          style={{
            backgroundColor: hasText ? section.color : '#D1D5DB',
            cursor: hasText ? 'pointer' : 'not-allowed',
          }}
        >
          {nextLabel}
        </button>

        {/* 스킵 */}
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-[#9CA3AF]"
        >
          {isLastSlot ? '이건 나중에 답할게' : '잠시 스킵할게요'}
        </button>

        {onBack && (
          <button onClick={onBack} className="w-full py-1.5 text-xs text-[#C4C2BE]">
            이전
          </button>
        )}
      </div>
    </div>
  );
}
