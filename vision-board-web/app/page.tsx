'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';

const SECTION_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];
const SECTION_NAMES = ['나', '건강', '관계', '일', '돈', '공간'];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingDone) {
      router.replace('/dashboard');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <main className="flex flex-col max-w-md mx-auto w-full">

      {/* Hero */}
      <section className="flex flex-col justify-center px-6 pt-16 pb-12 min-h-screen">
        <div className="animate-fadeIn">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8"
            style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)', boxShadow: '0 8px 24px rgba(28,27,25,0.18)' }}
          >
            <span className="text-white text-2xl">✦</span>
          </div>
          <p className="text-sm text-[#9CA3AF] mb-2">lumi</p>
          <h1 className="text-4xl font-bold leading-tight mb-5">
            목표가<br />없어도 괜찮아.
          </h1>
          <p className="text-[#6B7280] leading-relaxed mb-10">
            뭘 원하는지 몰라도 괜찮아요.<br />lumi랑 대화하다 보면 보여요.
          </p>
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white"
            style={{ backgroundColor: '#1C1B19' }}
          >
            lumi랑 시작하기 →
          </button>
          <p className="text-center text-xs text-[#C4C2BE] mt-3">무료 · 가입 없이 바로 시작</p>
        </div>

        <div className="flex justify-center mt-16">
          <span className="text-[#C4C2BE] text-sm animate-bounce">↓</span>
        </div>
      </section>

      {/* Problem */}
      <section className="px-6 py-14" style={{ backgroundColor: '#F5F5F3' }}>
        <h2 className="text-xl font-bold leading-snug mb-6">
          비전보드,<br />만들어보려 했는데 막혔죠?
        </h2>
        <div className="space-y-3 mb-6">
          {[
            '"뭘 원하는지 모르겠어서" 빈칸 앞에서 멈춘 적',
            '"잘 살고 싶다"는 마음은 있는데 막상 쓰려니 막막했던 적',
            '남들 비전보드는 멋있는데 내 건 왜 이렇게 어색한지',
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[#C4C2BE] mt-0.5 flex-shrink-0">○</span>
              <p className="text-sm text-[#6B7280] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E5E3DF]">
          <p className="text-sm leading-relaxed font-medium">
            혼자 채우는 게 어려운 거예요.<br />처음부터 알고 있을 필요 없어요.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-14">
        <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2">이렇게 만들어요</p>
        <h2 className="text-xl font-bold leading-snug mb-10">
          lumi가 질문하고,<br />당신이 답하면 돼요
        </h2>
        <div className="space-y-8">
          {[
            {
              step: '01',
              title: 'lumi가 질문해요',
              desc: '"지금 이 영역에서 어떤 상태야?" 형식 없이, 대화하듯 물어봐요.',
            },
            {
              step: '02',
              title: '떠오르는 대로 답해요',
              desc: '틀린 답 없어요. 막히면 lumi가 다른 각도로 다시 물어봐요.',
            },
            {
              step: '03',
              title: '나만의 장면이 완성돼요',
              desc: '막연했던 마음이 생생한 비전 장면이 돼요.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-5">
              <span
                className="text-2xl font-bold leading-none w-8 flex-shrink-0 mt-0.5"
                style={{ color: '#E5E3DF' }}
              >
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-sm mb-1">{item.title}</p>
                <p className="text-xs text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-14" style={{ backgroundColor: '#F5F5F3' }}>
        <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2">완성되면 생기는 것</p>
        <h2 className="text-xl font-bold leading-snug mb-6">
          6가지 영역 비전보드<br />+ 미래의 하루 이야기
        </h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SECTION_COLORS.map((color, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5"
              style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold" style={{ color }}>{SECTION_NAMES[i]}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E5E3DF]">
          <p className="text-xs text-[#9CA3AF] mb-2">미래의 하루 이야기 (예시)</p>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            "새벽 러닝 후 커피 한 잔. 몸이 가볍고 하루가 내 것인 느낌. 오늘도 내가 원하는 방식으로 살고 있어."
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)', boxShadow: '0 8px 24px rgba(28,27,25,0.12)' }}
        >
          <span className="text-white text-xl">✦</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">지금 시작해봐요.</h2>
        <p className="text-sm text-[#6B7280] mb-8">15분이면 첫 번째 영역을 채울 수 있어요.</p>
        <button
          onClick={() => router.push('/onboarding')}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white"
          style={{ backgroundColor: '#1C1B19' }}
        >
          lumi랑 시작하기 →
        </button>
        <p className="text-xs text-[#C4C2BE] mt-3">무료 · 가입 없이 바로 시작</p>
      </section>

    </main>
  );
}
