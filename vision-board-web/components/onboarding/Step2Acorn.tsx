'use client';

import { useState, useEffect, useRef } from 'react';
import { josa } from '@/lib/josa';

// 스텝2: 도토리 이야기 (v7.3 — 문안 교체: 심어야 싹튼다 → 나를 어디에 심느냐 → 비전보드=비옥한 땅, 함께 만들자)
const ACORN_MESSAGES = [
  (name: string) =>
    `${name ? `${josa(name, '아/야')}, ` : ''}도토리도 땅에 심겨야 싹을 틔울 수 있어.\n책상 위에 두면 그냥 작은 도토리일 뿐이야.\n중요한 건 우리가 어디에 놓여 있느냐는 거지.`,
  (name: string) =>
    `우리도 도토리랑 같아.\n'나'라는 도토리를 어디에 심느냐에 따라 미래가 달라지거든.\n비전보드를 만드는 건 ${name ? josa(name, '이라는/라는') : '너라는'} 도토리를 비옥한 땅에 심는 일이야.`,
  () =>
    `거대한 참나무가 될 네 잠재력을 깨워줄 환경, 지금 만들어보자.\n그럼, 우리 함께 비전보드를 만들어 볼까?`,
];

export default function Step2Acorn({
  name,
  onComplete,
}: {
  name: string;
  onComplete: () => void;
}) {
  const [acornStep, setAcornStep] = useState(0);
  // v7.4 심기 인터랙션 — 읽기만 하던 스텝에 "직접 심는" 행동을 넣는다: 탭 → 도토리 낙하 → 새싹 → CTA
  const [planted, setPlanted] = useState(false);
  const [ctaReady, setCtaReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 나오면 메시지 영역만 맨 아래로 — 페이지 스크롤바 대신 내부 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [acornStep, planted]);

  function handleTap() {
    if (acornStep < ACORN_MESSAGES.length - 1) {
      setAcornStep((s) => s + 1);
    }
  }

  function handlePlant() {
    if (planted) return;
    setPlanted(true);
    // 애니메이션(낙하 0.7s + 새싹 0.55s 지연)과 맞춘 타이머 — reduced-motion에서도 동작
    setTimeout(() => setCtaReady(true), 1300);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col cursor-pointer" onClick={handleTap}>
      {/* 토리 프로필 헤더 — 고정 */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <img
          src="/tori-profile-bust.png"
          alt="토리"
          className="w-12 h-12 rounded-2xl object-contain flex-shrink-0"
        />
        <p className="text-body font-semibold text-[#1C1B19]">토리</p>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-soft">
        <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-3">
          {Array.from({ length: acornStep + 1 }, (_, i) => (
            <div
              key={i}
              // v7.6 — 이전 버블 딤(opacity-60) 제거: 지난 내용도 또렷하게 남긴다
              className={`bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3${
                i === acornStep ? ' animate-fadeIn' : ''
              }`}
            >
              <p className="text-body leading-relaxed whitespace-pre-line">
                {ACORN_MESSAGES[i](name)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 힌트 / 심기 인터랙션 / CTA — 스크롤 영역 밖 하단 고정 */}
      {acornStep < ACORN_MESSAGES.length - 1 ? (
        <div className="text-center pt-3 pb-1 select-none flex-shrink-0">
          <span className="text-caption text-[#6E6962] animate-pulse">▼ 계속하려면 탭</span>
        </div>
      ) : (
        <div className="animate-fadeIn pt-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* 심기 무대 — 높이 고정으로 단계 전환 시 레이아웃 점프 방지 */}
          <div className="relative h-[104px] select-none" aria-hidden="true">
            {/* 도토리 — 심으면 흙으로 낙하 */}
            <span
              className={`absolute left-1/2 -translate-x-1/2 top-0 text-[2rem] leading-none ${
                planted ? 'animate-acornDrop' : 'animate-breath'
              }`}
            >
              🌰
            </span>
            {/* 새싹 — 낙하 뒤 흙에서 튀어오른다 */}
            {planted && (
              <span className="absolute left-1/2 -translate-x-1/2 bottom-[26px] text-[1.75rem] leading-none animate-sproutPop">
                🌱
              </span>
            )}
            {/* 흙 언덕 */}
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-40 h-7 rounded-[50%]"
              style={{ backgroundColor: '#E8E2D6' }}
            />
          </div>
          {!planted ? (
            <button
              onClick={handlePlant}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              🌰 {name ? `${josa(name, '이라는/라는')} 도토리` : '내 도토리'} 심기
            </button>
          ) : (
            <button
              onClick={onComplete}
              disabled={!ctaReady}
              className={`w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80 ${
                ctaReady ? 'animate-fadeIn' : 'opacity-0'
              }`}
              style={{ backgroundColor: '#1C1B19' }}
            >
              그래, 함께 해보자!
            </button>
          )}
        </div>
      )}
    </div>
  );
}
