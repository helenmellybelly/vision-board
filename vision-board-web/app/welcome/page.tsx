'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, markWelcomeSeen } from '@/lib/storage';
import { SECTION_COLORS } from '@/lib/colors';

const PHASES = [
  {
    num: '01',
    title: '나 발견하기',
    desc: '6가지 영역에서 각각 네가 진짜 원하는 게 무엇인지 질문으로 알아가.',
    extra: 'dots' as const,
  },
  {
    num: '02',
    title: '미래의 하루 그리기',
    desc: '발견한 나를 바탕으로 3년 뒤의 구체적인 하루를 그려봐.',
  },
  {
    num: '03',
    title: '비전보드 꾸미기',
    desc: '상상한 하루에 어울리는 이미지로 채워.',
  },
  {
    num: '04',
    title: '완성',
    desc: '6개 영역이 모두 채워지면 비전보드가 완성돼. 미래의 하루 이야기도 함께.',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (board.welcomeSeen) {
      router.replace('/dashboard');
      return;
    }
    setUserName(board.userName || '');
    setReady(true);
  }, [router]);

  function handleStart() {
    markWelcomeSeen();
    router.replace('/dashboard');
  }

  if (!ready) return null;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      <div className="mb-8 animate-fadeIn">
        <img
          src="/tori-profile-bust.png"
          alt="토리"
          className="w-10 h-10 rounded-xl object-cover mb-6"
        />
        <p className="text-body text-[#6E6962] mb-1">토리</p>
        <h1 className="text-display font-bold leading-snug">
          {userName ? `${userName}아,` : ''} 함께 만들어갈<br />비전보드를 보여줄게.
        </h1>
      </div>

      {/* 단계가 하나씩 순차 등장 — 버튼까지의 여백을 채우도록 텍스트도 한 단계 키움 */}
      <div className="flex-1">
        {PHASES.map((phase, idx) => (
          <div
            key={phase.num}
            className="flex gap-4 animate-slideUp"
            style={{ animationDelay: `${0.15 + idx * 0.25}s`, animationFillMode: 'backwards' }}
          >
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#1C1B19' }}
              >
                {phase.num}
              </div>
              {idx < PHASES.length - 1 && (
                <div className="w-px flex-1 mt-2" style={{ backgroundColor: '#E5E3DF', minHeight: '28px' }} />
              )}
            </div>
            <div className="pb-7 flex-1">
              <p className="font-semibold text-heading mb-1">{phase.title}</p>
              <p className="text-body text-[#6B7280] leading-relaxed">{phase.desc}</p>
              {phase.extra === 'dots' && (
                <div className="flex gap-1.5 mt-2.5">
                  {SECTION_COLORS.map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color + '70' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleStart}
        className="w-full py-4 rounded-2xl text-heading font-semibold text-white mt-2 animate-fadeIn"
        style={{ backgroundColor: '#1C1B19', animationDelay: `${0.15 + PHASES.length * 0.25}s`, animationFillMode: 'backwards' }}
      >
        시작할게 →
      </button>
    </main>
  );
}
