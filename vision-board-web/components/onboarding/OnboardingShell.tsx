'use client';

import { ReactNode } from 'react';
import { signIn } from 'next-auth/react';

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

      {/* 재방문자 로그인 진입 (v8.3 P1) — 기존 회원이 온보딩을 다 지나지 않고 바로 보드를 복원.
          로그인 후 AccountFlow(전역)가 서버 보드를 병합하고 루트가 상태에 따라 배분한다.
          서버 보드가 없는 신규 유저가 눌러도 흐름 유지 — 로그인 상태로 온보딩 계속, choice는 스킵됨 */}
      <p className="text-center text-caption text-[#9CA3AF] mt-4">
        만들던 보드가 있어?{' '}
        <button
          onClick={() => void signIn('google', { callbackUrl: '/' })}
          className="font-semibold text-[#6E6962] underline hover:text-[#1C1B19] transition-colors"
        >
          Google로 이어가기 →
        </button>
      </p>

      {onBack && (
        <button
          onClick={onBack}
          className="w-full text-[#6E6962] py-2 text-caption mt-2 flex items-center justify-center gap-1 hover:text-[#1C1B19] transition-colors"
        >
          ← 이전
        </button>
      )}
    </main>
  );
}
