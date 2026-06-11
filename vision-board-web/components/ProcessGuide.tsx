'use client';

import { useState } from 'react';
import useFocusTrap from './useFocusTrap';

const STEPS = [
  { step: 1, label: '대화', description: '6가지 주제에 짧게 답해 — 지금 여기서' },
  { step: 2, label: '미래의 하루', description: '각 답변을 3년 뒤의 구체적인 하루로 그려' },
  { step: 3, label: '스토리', description: '그린 하루를 짧은 스토리로 다듬어' },
  { step: 4, label: '이미지', description: '어울리는 사진 3장 고르기' },
  { step: 5, label: '마무리', description: '내 비전보드 완성' },
];

export default function ProcessGuide() {
  const [open, setOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-caption text-[#6E6962] underline underline-offset-2"
      >
        전체 과정 보기
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="process-guide-title"
            className="bg-white w-full max-w-md rounded-t-3xl px-6 py-8 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#E5E3DF] rounded-full mx-auto mb-6" />
            <h2 id="process-guide-title" className="text-heading font-bold mb-5">비전보드 만드는 방법</h2>
            <div className="space-y-4">
              {STEPS.map(({ step, label, description }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#1C1B19] text-white text-caption flex items-center justify-center font-semibold flex-shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <p className="text-body font-semibold">{label}</p>
                    <p className="text-caption text-[#6B7280] mt-0.5">{description}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-6 w-full py-3 rounded-xl bg-[#F5F5F3] text-body font-medium text-[#6B7280]"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
