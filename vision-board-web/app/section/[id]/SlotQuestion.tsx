'use client';

import { useState } from 'react';
import { Section, Slot, SlotAnswer } from '@/lib/types';

interface Props {
  section: Section;
  slot: Slot;
  slotIndex: number;
  totalSlots: number;
  savedAnswer?: SlotAnswer;
  onSave: (answer: SlotAnswer) => void;
  onBack?: () => void;
}

export default function SlotQuestion({
  section,
  slot,
  slotIndex,
  totalSlots,
  savedAnswer,
  onSave,
  onBack,
}: Props) {
  const [text, setText] = useState(savedAnswer?.text || '');
  const [showHelp, setShowHelp] = useState(false);
  const [showExample, setShowExample] = useState(false);

  function handleNext() {
    if (text.trim()) {
      onSave({ text: text.trim(), isDeferred: false });
    } else {
      onSave({ text: '', isDeferred: true });
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      <div className="flex gap-1 mb-6">
        {Array.from({ length: totalSlots }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              backgroundColor: i <= slotIndex ? section.color : '#E5E3DF',
            }}
          />
        ))}
      </div>

      <div className="flex-1 space-y-5">
        <div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            {slotIndex + 1} / {totalSlots}
          </span>
        </div>

        <h2 className="text-xl font-bold leading-snug">{slot.mainQuestion}</h2>

        {slot.example && (
          <div>
            <button
              onClick={() => setShowExample((v) => !v)}
              className="text-xs text-[#9CA3AF] underline"
            >
              {showExample ? '예시 닫기' : '예시 보기'}
            </button>
            {showExample && (
              <p className="mt-2 text-sm text-[#6B7280] bg-[#F9F8F6] rounded-xl p-3 leading-relaxed">
                {slot.example}
              </p>
            )}
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={slot.placeholder}
          rows={4}
          className="w-full bg-white border border-[#E5E3DF] rounded-2xl p-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
        />

        {slot.helpQuestions.length > 0 && (
          <div>
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-[#6B7280]"
            >
              <span className="text-base">💬</span>
              <span>{showHelp ? '닫기' : '도움이 필요해요'}</span>
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
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: text.trim() ? section.color : '#1C1B19' }}
        >
          {text.trim() ? '다음' : '나중에 답할게요'}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full py-2 text-sm text-[#6B7280]"
          >
            이전
          </button>
        )}
      </div>
    </div>
  );
}
