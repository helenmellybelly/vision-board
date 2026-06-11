'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';
import { SECTION_COLORS, SECTION_LIGHT_COLORS } from '@/lib/colors';

const SECTION_NAMES = ['나', '건강', '관계', '일', '돈', '공간'];

// 콜라주와 동일한 폴라로이드 언어 — 완성본의 룩을 히어로에서 미리 보여준다
const HERO_ROTATIONS = [-2.5, 1.5, -1.5, 2, -2, 2.5];

function HeroBoard() {
  return (
    <div className="rounded-3xl px-4 py-5" style={{ backgroundColor: '#2D2B29' }}>
      <div className="grid grid-cols-3 gap-3 items-center">
        {SECTION_NAMES.slice(0, 3).map((name, i) => (
          <HeroPolaroid key={name} name={name} index={i} />
        ))}
        <div className="col-span-3 flex flex-col items-center justify-center text-center py-2.5 select-none">
          <p className="text-micro font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase">
            Vision Board
          </p>
          <p className="font-display text-title font-bold text-white tracking-widest mt-0.5">
            나의 해
          </p>
        </div>
        {SECTION_NAMES.slice(3).map((name, i) => (
          <HeroPolaroid key={name} name={name} index={i + 3} />
        ))}
      </div>
    </div>
  );
}

function HeroPolaroid({ name, index }: { name: string; index: number }) {
  return (
    <div
      className="bg-white p-1 pb-0.5 rounded-sm shadow-md animate-slideUp"
      style={{
        transform: `rotate(${HERO_ROTATIONS[index]}deg)`,
        animationDelay: `${200 + index * 130}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div
        className="w-full aspect-square flex items-center justify-center"
        style={{ backgroundColor: SECTION_LIGHT_COLORS[index] }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SECTION_COLORS[index] }} />
      </div>
      <p className="font-display text-micro text-center text-[#57534E] py-1">{name}</p>
    </div>
  );
}

const CAROUSEL_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    label: '자연 속에서',
  },
  {
    src: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=80',
    label: '자유로운 하루',
  },
  {
    src: 'https://images.unsplash.com/photo-1470071459604-7b8ec44ffd5b?w=600&q=80',
    label: '나만의 길',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);

  const nextSlide = useCallback(() => {
    setCarouselIdx((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, [nextSlide]);

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
    <main className="flex flex-col max-w-md md:max-w-xl mx-auto w-full">

      {/* Hero — 완성될 비전보드(폴라로이드 보드)를 첫 화면에서 미리 보여준다 */}
      <section className="flex flex-col justify-center px-6 pt-14 pb-12 min-h-screen">
        <div className="animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/tori-profile-bust.png"
              alt="정원사 토리"
              className="w-11 h-11 rounded-2xl object-cover"
              style={{ boxShadow: '0 6px 18px rgba(28,27,25,0.16)' }}
            />
            <p className="text-body text-[#6E6962]">정원사 토리</p>
          </div>
          <h1 className="font-display text-display-lg font-bold leading-snug mb-4">
            비전보드는<br />
            그리고 싶은 내 인생의<br />
            그림이에요.
          </h1>
          <p className="text-[#6B7280] leading-relaxed mb-6 text-body">
            처음부터 이미지를 찾을 필요 없어요.<br />
            질문을 따라가다 보면, 어느새 완성됩니다.
          </p>

          <div className="mb-6">
            <HeroBoard />
          </div>

          <button
            onClick={() => router.push('/onboarding')}
            className="w-full py-4 rounded-2xl text-heading font-semibold text-white"
            style={{ backgroundColor: '#1C1B19' }}
          >
            나 발견하러 가기 →
          </button>
          <p className="text-center text-caption text-[#6E6962] mt-3">무료 · 가입 없이 바로 시작</p>
        </div>
      </section>

      {/* 예시 비전보드 이미지 오토 롤링 캐러셀 */}
      <section className="px-6 py-14 overflow-hidden">
        <p className="text-caption text-[#6E6962] uppercase tracking-wider mb-2">이런 비전보드</p>
        <h2 className="text-title font-bold leading-snug mb-10">
          누군가는<br />이렇게 그리고 있어요
        </h2>
        <div className="relative">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${carouselIdx * 100}%)` }}
          >
            {CAROUSEL_IMAGES.map((img, i) => (
              <div key={i} className="min-w-full flex justify-center px-2 py-3">
                <div
                  className="w-full bg-white p-2 pb-3 rounded-sm shadow-md"
                  style={{ transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)` }}
                >
                  <div className="w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: '#F5F5F3' }}>
                    <img
                      src={img.src}
                      alt={img.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="font-display text-body text-center text-[#57534E] pt-2.5">{img.label}</p>
                </div>
              </div>
            ))}
          </div>
          {/* dots */}
          <div className="flex justify-center gap-2 mt-5">
            {CAROUSEL_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIdx(i)}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i === carouselIdx ? '#1C1B19' : '#E5E3DF',
                  width: i === carouselIdx ? 24 : 8,
                }}
                aria-label={`${i + 1}번째 이미지`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Contrast: 기존 vs 토리 */}
      <section className="px-6 py-14" style={{ backgroundColor: '#F5F5F3' }}>
        <p className="text-caption text-[#6E6962] uppercase tracking-wider mb-5">토리가 다른 이유</p>
        <div className="space-y-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#ECEAE6' }}>
            <p className="text-micro font-semibold text-[#6E6962] mb-3 uppercase tracking-wide">기존 비전보드 / Pinterest</p>
            <div className="space-y-2">
              {[
                '원하는 이미지를 찾아 붙인다',
                '이미 목표가 있다는 전제에서 시작',
                '"경제적 자유" — 나에겐 뭘 의미하는지 모른 채 끝남',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#C4C2BE] mt-0.5 flex-shrink-0 text-caption font-bold">×</span>
                  <p className="text-body text-[#6E6962] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-[#E5E3DF]">
            <p className="text-micro font-semibold text-[#1C1B19] mb-3 uppercase tracking-wide">토리</p>
            <div className="space-y-2">
              {[
                '먼저 질문으로 나를 발견한다',
                '막연한 상태에서 시작해도 된다',
                '"경제적 자유"가 나에게 구체적으로 무엇인지 알게 된 채 끝남',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#1C1B19] mt-0.5 flex-shrink-0 text-caption font-bold">✓</span>
                  <p className="text-body leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-14">
        <p className="text-caption text-[#6E6962] uppercase tracking-wider mb-2">이렇게 만들어요</p>
        <h2 className="text-title font-bold leading-snug mb-10">
          토리가 묻고,<br />당신이 답하면 보여요
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
              title: '미래의 하루를 그리기',
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
                className="text-display font-bold leading-none w-8 flex-shrink-0 mt-0.5"
                style={{ color: '#E5E3DF' }}
              >
                {item.step}
              </span>
              <div>
                <p className="font-semibold text-body mb-1">{item.title}</p>
                <p className="text-caption text-[#6B7280] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-14" style={{ backgroundColor: '#F5F5F3' }}>
        <p className="text-caption text-[#6E6962] uppercase tracking-wider mb-2">완성되면 생기는 것</p>
        <h2 className="text-title font-bold leading-snug mb-6">
          6가지 영역 비전보드<br />+ 미래의 하루 이야기
        </h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {SECTION_COLORS.map((color, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5"
              style={{ backgroundColor: SECTION_LIGHT_COLORS[i], border: `1px solid ${color}30` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-caption font-semibold" style={{ color }}>{SECTION_NAMES[i]}</span>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#E5E3DF]">
          <p className="text-caption text-[#6E6962] mb-2">완성되면 이런 장면이 나와</p>
          <p className="text-body leading-relaxed text-[#6B7280]">
            "카페 창가, 혼자 책 읽는 오전.<br />이게 내가 원하는 &apos;나&apos; 영역의 하루야."
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 text-center">
        <img
          src="/tori-profile-bust.png"
          alt="정원사 토리"
          className="w-12 h-12 rounded-2xl object-cover mx-auto mb-6"
          style={{ boxShadow: '0 8px 24px rgba(28,27,25,0.12)' }}
        />
        <h2 className="font-display text-display font-bold mb-2">지금, 첫 질문 하나부터.</h2>
        <p className="text-body text-[#6B7280] mb-8">막연해도 괜찮아. 토리가 물어볼게.</p>
        <button
          onClick={() => router.push('/onboarding')}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white"
          style={{ backgroundColor: '#1C1B19' }}
        >
          나 발견하러 가기 →
        </button>
        <p className="text-caption text-[#6E6962] mt-3">무료 · 가입 없이 바로 시작</p>
      </section>

    </main>
  );
}
