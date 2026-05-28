'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, resetBoard } from '@/lib/storage';

export default function LandingPage() {
  const router = useRouter();
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingDone) {
      setIsReturning(true);
    }
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-12 max-w-md mx-auto w-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-[#1C1B19] flex items-center justify-center">
          <span className="text-white text-xl">✦</span>
        </div>

        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">비전보드</h1>
          <div className="space-y-2 text-[#6B7280] leading-relaxed">
            <p>비전보드는 예쁜 이미지 모음이 아니야.</p>
            <p>질문에 답하다 보면, 나도 몰랐던 내가 나와.</p>
            <p className="font-medium text-[#1C1B19]">언어가 먼저, 이미지는 나중이야.</p>
          </div>
        </div>

        <div className="w-full bg-white rounded-2xl p-5 space-y-3 border border-[#E5E3DF]">
          {[
            { step: '1단계', desc: '솔직하게 답하기' },
            { step: '2단계', desc: '내 답 한눈에 보기' },
            { step: '3단계', desc: '장면으로 그려보기' },
            { step: '4단계', desc: '사진으로 담기' },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#6B7280] w-12">{item.step}</span>
              <span className="text-sm">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full space-y-3">
        {isReturning ? (
          <>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
            >
              계속하기
            </button>
            <button
              onClick={() => {
                resetBoard();
                router.push('/onboarding');
              }}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-sm active:opacity-70 transition-opacity"
            >
              처음부터 시작하기
            </button>
          </>
        ) : (
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
          >
            시작하기
          </button>
        )}
        <p className="text-center text-xs text-[#9CA3AF]">
          로그인 없이 바로 시작해. 진행 상황은 이 기기에 저장돼.
        </p>
      </div>
    </main>
  );
}
