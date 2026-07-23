'use client';

import { useState } from 'react';
import { josa } from '@/lib/josa';

// 스텝1: 토리 인사 + 이름 입력 한 화면 (v7.0-r1 — 구 Act0 소개 + Act1 이름을 통합, 클릭 2→1회)
// v7.4: 입력 중 토리가 실시간으로 이름을 불러보는 미리보기 — 첫 화면에서 "관계 맺기"를 체감시킨다
export default function Step1Name({
  initialName,
  onComplete,
}: {
  initialName: string;
  onComplete: (name: string) => void;
}) {
  const [nameInput, setNameInput] = useState(initialName);

  function submit() {
    const n = nameInput.trim();
    if (!n) return;
    onComplete(n);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
      <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-5">
        {/* webm은 진짜 알파 채널. mp4 폴백은 흰 배경이라 multiply로 투과 — 페이지 배경이 밝아야 자연스러움 */}
        <div className="flex justify-center" style={{ backgroundColor: 'transparent' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '220px',
              height: '220px',
              objectFit: 'contain',
              backgroundColor: 'transparent',
              mixBlendMode: 'multiply',
              filter: 'contrast(1.15) saturate(1.1)',
            }}
          >
            <source src="/tori-v3-alpha.webm" type="video/webm" />
            <source src="/tori-v3.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="space-y-1 text-center px-2">
          <p className="text-body text-[#1C1B19] leading-relaxed font-medium">
            안녕! 나는 토리(Tory)야 🌰
          </p>
          <p className="text-body text-[#6B7280] leading-relaxed">
            네가 원하는 삶을 발견하도록 돕는 꿈의 정원사지.
          </p>
          <p className="text-body text-[#6B7280] leading-relaxed">
            우리가 함께 비전보드를 만들어 갈 거야.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-body font-semibold text-center text-[#1C1B19]">
            너를 뭐라고 불러주면 좋을까? 🌱
          </p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && submit()}
            placeholder="이름 또는 닉네임"
            className="w-full px-4 py-3 rounded-xl border border-[#E5E3DF] text-body outline-none focus:border-[#1C1B19] transition-colors bg-white"
          />
          {/* 실시간 호명 미리보기 — 높이를 미리 확보해 입력 중 레이아웃 점프 방지 */}
          <p className="text-caption text-center min-h-[1.25rem] transition-opacity duration-300"
            style={{ color: '#6E6962' }}
            aria-live="polite"
          >
            {nameInput.trim()
              ? `"${josa(nameInput.trim(), '아/야')}, 만나서 반가워!" — 토리가 이렇게 부를 거야 🌰`
              : '토리가 부를 이름이면 돼. 닉네임도 좋아.'}
          </p>
          <button
            onClick={submit}
            disabled={!nameInput.trim()}
            className="w-full py-4 rounded-2xl text-heading font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-80"
            style={{ backgroundColor: '#1C1B19' }}
          >
            이렇게 불러줘 →
          </button>
        </div>
      </div>
    </div>
  );
}
