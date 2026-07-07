'use client';

import { useState, useEffect } from 'react';

// 스텝3: 막연함 vs 선명함 (v7.0-r1 — 구 Act3 '비전보드란?' 정의를 한 줄로 흡수,
// VISION_CARDS 3장·예시 보드 이미지는 콘텐츠 과잉 피드백으로 삭제. 구 Act5는 대시보드 인트로 시트로 이동)
const COMPARE_SLIDES = [
  {
    key: 'vague',
    label: '막연한 바람',
    text: '"언젠가 건강하게 살고 싶다..."',
    img: 'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?auto=format&fit=crop&w=800&q=60',
    grayscale: true,
  },
  {
    key: 'vivid',
    label: '생생한 장면',
    text: '"새벽 6시 러닝 끝내고 샤워 후 커피 한 잔.\n몸이 가볍고 하루가 내 것인 느낌."',
    img: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=60',
    grayscale: false,
  },
];

// 막연함 ↔ 선명함 자동 순환 비교 카드 — 수동 조작 없음, 점은 진행 표시만
function CompareAutoCard() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % COMPARE_SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const slide = COMPARE_SLIDES[idx];

  return (
    // 이미지가 남는 공간만큼만 차지하되 카드 전체에 상한(max-h-72)을 둠 —
    // 상한 없이는 flex-1이 잉여 높이를 흡수해 도트와 다음 문구 사이에 빈 공간이 생긴다(v6.15 간격 피드백)
    <div className="flex-1 min-h-0 max-h-72 flex flex-col space-y-1.5">
      <div className="relative rounded-2xl overflow-hidden select-none shadow-sm flex-1 min-h-16">
        <div className="relative h-full">
          {COMPARE_SLIDES.map((s, i) => (
            <img
              key={s.key}
              src={s.img}
              alt={s.label}
              loading={i === 0 ? undefined : 'lazy'}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              style={{
                opacity: i === idx ? 1 : 0,
                filter: s.grayscale ? 'grayscale(0.9) brightness(0.92)' : 'none',
              }}
            />
          ))}
          {/* 하단 그라데이션 + 텍스트 오버레이 */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pt-16 pb-4 pointer-events-none">
            <p
              className="text-caption font-bold tracking-wide mb-0.5 drop-shadow"
              style={{ color: slide.key === 'vivid' ? '#A5B4FC' : '#D1D5DB' }}
            >
              {slide.label}
            </p>
            <p className="text-body font-semibold text-white leading-snug whitespace-pre-line drop-shadow">
              {slide.text}
            </p>
          </div>
        </div>
      </div>

      {/* 점 인디케이터 — 표시 전용 */}
      <div className="flex items-center justify-center gap-1.5 flex-shrink-0" aria-hidden="true">
        {COMPARE_SLIDES.map((s, i) => (
          <span
            key={s.key}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: i === idx ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Step3Compare({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
      <div className="min-h-full flex-shrink-0 flex flex-col justify-center">
        <p className="text-title font-bold text-[#1C1B19] leading-snug flex-shrink-0 mb-2 [@media(min-height:700px)]:mb-3">
          막연함과 선명함의 차이
        </p>

        <CompareAutoCard />

        {/* 핵심 메시지 — 카드와 한 호흡 띄운다 (v6.16 간격 피드백) */}
        <div className="text-center px-2 flex-shrink-0 mt-3 [@media(min-height:700px)]:mt-5">
          <p className="text-body text-[#1C1B19] leading-snug">
            원하는 것이 뚜렷해지는 순간, <span className="font-bold">뇌는 그쪽으로 움직이기 시작해.</span>
          </p>
          <p className="text-body font-bold text-[#1C1B19] leading-snug mt-1">그게 비전보드의 힘이야.</p>
        </div>

        {/* 비전보드 정의 — 구 Act3 정의 박스를 한 줄로 압축 흡수 */}
        <div
          className="rounded-2xl px-5 py-4 border flex-shrink-0 mt-4 [@media(min-height:700px)]:mt-6"
          style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DF' }}
        >
          <p className="text-caption font-semibold text-[#6E6962] mb-1 tracking-wide uppercase">비전보드란?</p>
          <p className="text-body text-[#1C1B19] leading-relaxed">
            네가 원하는 삶을 이미지와 글로 시각화한 나만의 지도.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80 flex-shrink-0 mt-4 [@media(min-height:700px)]:mt-5"
          style={{ backgroundColor: '#1C1B19' }}
        >
          비전보드 시작하기 →
        </button>
      </div>
    </div>
  );
}
