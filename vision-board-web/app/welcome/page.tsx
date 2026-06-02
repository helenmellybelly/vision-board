'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, markWelcomeSeen } from '@/lib/storage';

const SECTION_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];

const PHASES = [
  {
    num: '01',
    title: '나를 발견하기',
    desc: '6개 영역에서 각각 질문에 답해. 어떤 순서로 해도 괜찮아.',
    extra: 'dots' as const,
  },
  {
    num: '02',
    title: '원하는 장면 그리기',
    desc: '발견한 나를 바탕으로, 각 영역의 3년 뒤 하루를 그려.',
  },
  {
    num: '03',
    title: '이미지 찾기',
    desc: '장면에 어울리는 사진을 찾아 붙여.',
  },
  {
    num: '04',
    title: '비전보드 완성',
    desc: '6개 영역이 모두 채워지면 미래의 하루 이야기도 함께 완성돼.',
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
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-6"
          style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
        >
          <span className="text-white text-lg">✦</span>
        </div>
        <p className="text-sm text-[#9CA3AF] mb-1">lumi</p>
        <h1 className="text-2xl font-bold leading-snug">
          {userName ? `${userName}아,` : ''} 앞으로<br />이렇게 진행될 거야.
        </h1>
      </div>

      <div className="flex-1 animate-slideUp">
        {PHASES.map((phase, idx) => (
          <div key={phase.num} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#1C1B19' }}
              >
                {phase.num}
              </div>
              {idx < PHASES.length - 1 && (
                <div className="w-px flex-1 mt-2" style={{ backgroundColor: '#E5E3DF', minHeight: '28px' }} />
              )}
            </div>
            <div className="pb-7 flex-1">
              <p className="font-semibold text-sm mb-1">{phase.title}</p>
              <p className="text-xs text-[#6B7280] leading-relaxed">{phase.desc}</p>
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
        className="w-full py-4 rounded-2xl text-base font-semibold text-white mt-2"
        style={{ backgroundColor: '#1C1B19' }}
      >
        시작할게 →
      </button>
    </main>
  );
}
