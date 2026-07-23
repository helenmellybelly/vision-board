'use client';

import { useState } from 'react';

// 스텝3: 막연함 vs 선명함 (v7.1-r1 동시 대비 스택 → v7.4 직접 조작 슬라이더)
// 대비를 "보여주는" 대신 사용자가 슬라이더를 밀어 흑백(막연)을 컬러(선명)로 직접 바꾸게 한다 —
// "막연함→선명함" 전환을 손으로 체감하는 것이 이 스텝의 교훈 그 자체.
const VAGUE = {
  label: '막연한 바람',
  text: '"언젠가 건강하게 살고 싶다..."',
};
const VIVID = {
  label: '생생한 장면',
  text: '"새벽 6시 러닝 끝내고 샤워 후 커피 한 잔.\n몸이 가볍고 하루가 내 것인 느낌."',
};
const IMG =
  'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=60';

export default function Step3Compare({ onComplete }: { onComplete: () => void }) {
  const [clarity, setClarity] = useState(0); // 0(막연) ~ 100(선명)
  const [revealed, setRevealed] = useState(false); // 끝까지 밀었을 때 핵심 메시지 공개 (되돌려도 유지)
  const t = clarity / 100;

  function handleChange(value: number) {
    setClarity(value);
    if (value >= 90 && !revealed) setRevealed(true);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
      <div className="min-h-full flex-shrink-0 flex flex-col justify-center">
        <p className="text-title font-bold text-[#1C1B19] leading-snug flex-shrink-0 mb-2 [@media(min-height:700px)]:mb-3">
          막연함과 선명함, 뭐가 다를까?
        </p>

        {/* 조작형 대비 카드 — 슬라이더 값이 이미지 채도·문장을 함께 바꾼다 */}
        <div
          className="flex items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2.5 transition-shadow duration-500"
          style={{
            borderColor: revealed ? '#A5B4FC' : '#E5E3DF',
            boxShadow: revealed ? '0 4px 14px rgba(99,102,241,0.15)' : 'none',
          }}
        >
          <img
            src={IMG}
            alt="미래의 하루"
            className="w-16 h-16 [@media(min-height:700px)]:w-20 [@media(min-height:700px)]:h-20 rounded-xl object-cover flex-shrink-0"
            style={{
              filter: `grayscale(${1 - t}) brightness(${0.92 + 0.08 * t})`,
              transition: 'filter 0.15s linear',
            }}
          />
          <div className="min-w-0 relative flex-1">
            <p
              className="text-caption font-bold tracking-wide mb-0.5 transition-colors duration-300"
              style={{ color: t < 0.5 ? '#9CA3AF' : '#6366F1' }}
            >
              {t < 0.5 ? VAGUE.label : VIVID.label}
            </p>
            {/* 두 문장을 겹쳐 크로스페이드 — 긴 문장 높이를 기준으로 확보해 점프 방지 */}
            <div className="relative">
              <p
                className="text-body font-semibold text-[#1C1B19] leading-snug whitespace-pre-line"
                style={{ opacity: t }}
              >
                {VIVID.text}
              </p>
              <p
                className="absolute inset-0 text-body text-[#6E6962] leading-snug whitespace-pre-line"
                style={{ opacity: 1 - t }}
              >
                {VAGUE.text}
              </p>
            </div>
          </div>
        </div>

        {/* 슬라이더 — 이 스텝의 핵심 행동 */}
        <div className="flex-shrink-0 mt-3">
          <input
            type="range"
            min={0}
            max={100}
            value={clarity}
            onChange={(e) => handleChange(Number(e.target.value))}
            aria-label="막연함을 선명함으로 바꾸는 슬라이더"
            className="w-full accent-[#6366F1] cursor-pointer"
          />
          <div className="flex justify-between text-micro text-[#9CA3AF] select-none">
            <span>막연함</span>
            <span>선명함</span>
          </div>
        </div>

        {/* 안내 ↔ 핵심 메시지 — 같은 자리를 공유(높이 확보)해 공개 시 레이아웃 점프 방지 */}
        <div className="text-center px-2 flex-shrink-0 mt-3 [@media(min-height:700px)]:mt-4 min-h-[3.5rem] flex flex-col items-center justify-center">
          {revealed ? (
            <div className="animate-fadeIn">
              <p className="text-body text-[#1C1B19] leading-snug">
                원하는 것이 뚜렷해지는 순간, <span className="font-bold">뇌는 그쪽으로 움직이기 시작해.</span>
              </p>
              <p className="text-body font-bold text-[#1C1B19] leading-snug mt-1">그게 비전보드의 힘이야.</p>
            </div>
          ) : (
            <p className="text-caption text-[#6E6962] animate-pulse select-none">
              슬라이더를 끝까지 밀어서 선명하게 만들어봐 →
            </p>
          )}
        </div>

        {/* 비전보드 정의 — 구 Act3 정의 박스를 한 줄로 압축 흡수 */}
        <div
          className="rounded-2xl px-5 py-4 border flex-shrink-0 mt-3 [@media(min-height:700px)]:mt-5"
          style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DF' }}
        >
          <p className="text-caption font-semibold text-[#6E6962] mb-1 tracking-wide uppercase">비전보드란?</p>
          <p className="text-body text-[#1C1B19] leading-relaxed">
            네가 원하는 삶을 이미지와 글로 시각화한, 너만의 지도야.
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
