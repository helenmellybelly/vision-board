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
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 나오면 메시지 영역만 맨 아래로 — 페이지 스크롤바 대신 내부 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [acornStep]);

  function handleTap() {
    if (acornStep < ACORN_MESSAGES.length - 1) {
      setAcornStep((s) => s + 1);
    }
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
              className={
                i === acornStep
                  ? 'bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 animate-fadeIn'
                  : 'bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 opacity-60'
              }
            >
              <p className="text-body leading-relaxed whitespace-pre-line">
                {ACORN_MESSAGES[i](name)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 힌트 / CTA — 스크롤 영역 밖 하단 고정 */}
      {acornStep < ACORN_MESSAGES.length - 1 ? (
        <div className="text-center pt-3 pb-1 select-none flex-shrink-0">
          <span className="text-caption text-[#6E6962] animate-pulse">▼ 계속하려면 탭</span>
        </div>
      ) : (
        <div className="animate-fadeIn pt-4 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
            style={{ backgroundColor: '#1C1B19' }}
          >
            그래, 함께 해보자!
          </button>
        </div>
      )}
    </div>
  );
}
