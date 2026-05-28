'use client';

import { useState } from 'react';
import { Section, Slot, SlotAnswer } from '@/lib/types';

interface Props {
  section: Section;
  slot: Slot;
  keyword: string;
  savedAnswer?: SlotAnswer;
  onSave: (answer: SlotAnswer) => void;
  onBack: () => void;
}

export default function PhaseScene({ section, slot, keyword, savedAnswer, onSave, onBack }: Props) {
  const [text, setText] = useState(savedAnswer?.text || '');
  const [showHelp, setShowHelp] = useState(false);

  function handleNext() {
    onSave({ text: text.trim(), isDeferred: !text.trim() });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      <div className="flex-1 space-y-5">
        <div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            3단계
          </span>
        </div>

        {keyword && (
          <div
            className="rounded-2xl p-3 text-center"
            style={{ backgroundColor: section.lightColor }}
          >
            <p className="text-xs text-[#6B7280] mb-1">내 키워드 ②</p>
            <p className="font-bold" style={{ color: section.color }}>
              {keyword}
            </p>
          </div>
        )}

        <h2 className="text-xl font-bold leading-snug">{slot.mainQuestion}</h2>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={slot.placeholder}
          rows={5}
          className="w-full bg-white border border-[#E5E3DF] rounded-2xl p-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
        />

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
                  className="p-3 rounded-xl text-sm leading-relaxed"
                  style={{ backgroundColor: section.lightColor }}
                >
                  {q.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {text.trim() ? '다음' : '나중에 답할게요'}
        </button>
        <button onClick={onBack} className="w-full py-2 text-sm text-[#6B7280]">
          이전
        </button>
      </div>
    </div>
  );
}
