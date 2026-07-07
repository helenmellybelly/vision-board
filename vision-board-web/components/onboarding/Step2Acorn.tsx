'use client';

import { useState, useEffect, useRef } from 'react';
import { josa } from '@/lib/josa';

// 스텝2: 도토리 이야기 (v7.0-r1 — 탭 채팅 형식 유지, 메시지 7→3개 압축으로 탭 6→2번)
// 핵심 서사 유지: 2,400배 성장 → 심어야만 자란다(어디에 놓이느냐) → 비전보드는 너를 심을 땅
const ACORN_MESSAGES = [
  (name: string) =>
    `${name ? `${josa(name, '아/야')}, ` : ''}너 그거 아니? 도토리 있잖아, 그 2.5cm짜리 씨앗.\n땅에 심으면 최대 60m 참나무가 돼. 2,400배야.`,
  () =>
    `근데 비밀이 하나 있어.\n땅에 심어야만 그렇게 돼. 책상 위에 두면 그냥 도토리야.\n중요한 건 어디에 놓이느냐는 거지.`,
  (name: string) =>
    `${name ? josa(name, '이라는/라는') : '너라는'} 도토리도 똑같아.\n비전보드는 너를 심을 땅이야.\n참나무가 될 잠재력을 꺼내줄 환경이지.`,
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
            그 가능성, 꺼내볼게 →
          </button>
        </div>
      )}
    </div>
  );
}
