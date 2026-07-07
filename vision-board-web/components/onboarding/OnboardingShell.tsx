'use client';

import { ReactNode } from 'react';

const TOTAL_STEPS = 3;

// 온보딩 공통 셸 (v7.0-r1) — 뷰포트 고정 레이아웃 + 진행 도트 + 이전 버튼.
// 스텝 콘텐츠가 넘치는 경우는 각 스텝 내부의 scroll-soft 영역이 받는다 (구 /onboarding 단일 페이지와 동일 문법)
export default function OnboardingShell({
  step,
  onBack,
  children,
}: {
  step: 1 | 2 | 3;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="h-dvh overflow-hidden flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
      <div className="mb-4 mt-1 flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ backgroundColor: i < step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col animate-fadeIn" key={step}>
        {children}
      </div>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full text-[#6E6962] py-2 text-caption mt-4 flex items-center justify-center gap-1 hover:text-[#1C1B19] transition-colors"
        >
          ← 이전
        </button>
      )}
    </main>
  );
}
