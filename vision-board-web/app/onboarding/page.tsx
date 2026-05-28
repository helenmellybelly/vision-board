'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';

const STEPS = [
  {
    title: '비전보드가 뭐야?',
    content: (
      <div className="space-y-4 text-[#1C1B19]">
        <p className="leading-relaxed">
          비전보드는 예쁜 이미지 모음이 아니야.
        </p>
        <p className="leading-relaxed">
          질문에 답하다 보면, 나도 몰랐던 내가 나와.
        </p>
        <p className="leading-relaxed font-medium">
          언어가 먼저, 이미지는 나중이야.
        </p>
      </div>
    ),
  },
  {
    title: '어떻게 진행돼?',
    content: (
      <div className="space-y-4">
        {[
          { num: '01', title: '솔직하게 답하기', desc: '정답은 없어. 지금 느끼는 게 다 맞아.' },
          { num: '02', title: '내 답 한눈에 보기', desc: '답들을 모아서 흐름을 읽어봐.' },
          { num: '03', title: '장면으로 그려보기', desc: '키워드를 구체적인 하루로 만들어봐.' },
          { num: '04', title: '사진으로 담기', desc: '그 느낌이 담긴 사진 3장을 찾아봐.' },
        ].map((item) => (
          <div key={item.num} className="flex gap-4">
            <span className="text-xs font-bold text-[#9CA3AF] mt-0.5 w-6">{item.num}</span>
            <div>
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-sm text-[#6B7280] mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: '6개 섹션',
    content: (
      <div className="space-y-2">
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ backgroundColor: section.lightColor }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: section.color }}
            />
            <div>
              <span className="font-semibold text-sm">{section.title}</span>
              <span className="text-xs text-[#6B7280] ml-2">{section.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      markOnboardingDone();
      router.replace('/dashboard');
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-12">
      <div className="flex gap-1.5 mb-10">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i <= step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 animate-fadeIn" key={step}>
        <h2 className="text-2xl font-bold mb-6">{STEPS[step].title}</h2>
        {STEPS[step].content}
      </div>

      <div className="space-y-3 mt-8">
        <button
          onClick={handleNext}
          className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
        >
          {isLast ? '시작할게' : '다음'}
        </button>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="w-full text-[#6B7280] py-2 text-sm"
          >
            이전
          </button>
        )}
      </div>
    </main>
  );
}
