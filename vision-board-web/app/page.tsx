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
          <p className="text-sm text-[#9CA3AF] mb-3">lumi</p>
          <h1 className="text-3xl font-bold leading-tight mb-5">
            비전보드,<br />
            원하는 게 생각나야<br />
            만들 수 있다고<br />
            생각했나요?
          </h1>
          <p className="text-[#6B7280] leading-relaxed mb-10">
            lumi는 먼저 질문해요. 막연해도 괜찮아요.
          </p>
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white"
            style={{ backgroundColor: '#1C1B19' }}
          >
            나 발견하러 가기 →
          </button>
          <p className="text-center text-xs text-[#C4C2BE] mt-3">무료 · 가입 없이 바로 시작</p>
        </div>
      </section>

      {/* Contrast: 기존 vs lumi */}
      <section className="px-6 py-14" style={{ backgroundColor: '#F5F5F3' }}>
        <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-5">lumi가 다른 이유</p>
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#ECEAE6' }}>
            <p className="text-[11px] font-semibold text-[#9CA3AF] mb-3 uppercase tracking-wide">기존 비전보드 / Pinterest</p>
            <div className="space-y-2">
              {[
                '원하는 이미지를 찾아 붙인다',
                '이미 목표가 있다는 전제에서 시작',
                '"경제적 자유" — 나에겐 뭘 의미하는지 모른 채 끝남',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#C4C2BE] mt-0.5 flex-shrink-0 text-xs font-bold">×</span>
                  <p className="text-sm text-[#9CA3AF] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-[#E5E3DF]">
            <p className="text-[11px] font-semibold text-[#1C1B19] mb-3 uppercase tracking-wide">lumi</p>
            <div className="space-y-2">
              {[
                '먼저 질문으로 나를 발견한다',
                '막연한 상태에서 시작해도 된다',
                '"경제적 자유"가 나에게 구체적으로 무엇인지 알게 된 채 끝남',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#1C1B19] mt-0.5 flex-shrink-0 text-xs font-bold">✓</span>
                  <p className="text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How lumi works */}
      <section className="px-6 py-14">
        <p className="text-xs text-[#9CA3AF] uppercase tracking-wider mb-2">이렇게 만들어요</p>
        <h2 className="text-xl font-bold leading-snug mb-10">
          lumi가 묻고,<br />당신이 답하면 보여요
        </h2>
        <div className="space-y-8">
          {[
            {
              step: '01',
              title: '나를 발견하기',
              desc: '"지금 어떤 삶을 살고 있어?"부터 시작해. 막연한 바람 뒤에 있는 진짜 욕구를 질문으로 꺼내.',
            },
            {
              step: '02',
              title: '원하는 삶의 장면을 그리기',
              desc: '발견한 나를 바탕으로, 3년 뒤의 구체적인 하루를 그려봐. 느낌과 상황이 살아있는 장면이 나와.',
            },
            {
              step: '03',
              title: '비전보드로 완성하기',
              desc: '장면에 맞는 이미지를 찾아 붙이면 나만의 비전보드가 완성돼. 미래의 하루 이야기도 함께.',
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
          <p className="text-xs text-[#9CA3AF] mb-2">완성되면 이런 장면이 나와</p>
          <p className="text-sm leading-relaxed text-[#6B7280]">
            "카페 창가, 혼자 책 읽는 오전.<br />이게 내가 원하는 &apos;나&apos; 영역의 하루야."
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
        <h2 className="text-2xl font-bold mb-2">지금, 첫 질문 하나부터.</h2>
        <p className="text-sm text-[#6B7280] mb-8">막연해도 괜찮아. lumi가 물어볼게.</p>
        <button
          onClick={() => router.push('/onboarding')}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white"
          style={{ backgroundColor: '#1C1B19' }}
        >
          나 발견하러 가기 →
        </button>
        <p className="text-xs text-[#C4C2BE] mt-3">무료 · 가입 없이 바로 시작</p>
      </section>

    </main>
  );
}
