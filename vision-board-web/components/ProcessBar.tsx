'use client';

import { useRouter } from 'next/navigation';
import { BoardData } from '@/lib/types';

interface Props {
  board: BoardData;
}

const STEPS = [
  { label: '섹션 답하기', short: '답변' },
  { label: '장면 그리기', short: '장면' },
  { label: '이미지 찾기', short: '이미지' },
  { label: '비전보드',    short: '보드' },
] as const;

function getStepInfo(board: BoardData): {
  currentStep: 1 | 2 | 3 | 4;
  subLabel: string;
} {
  const sections = Object.values(board.sections);
  const textDone = sections.filter(s => s.status === 'text_complete' || s.status === 'completed').length;
  const sceneDone = sections.filter(s => s.sceneText && s.sceneText.trim() !== '').length;
  const imgDone = sections.filter(s => s.status === 'completed').length;

  const allText = textDone === 6;
  const allScene = sceneDone === 6;
  const allImg = imgDone === 6;

  if (!allText) return { currentStep: 1, subLabel: `${textDone}/6 완료` };
  if (!allScene) return { currentStep: 2, subLabel: `${sceneDone}/6 완료` };
  if (!allImg)  return { currentStep: 3, subLabel: `${imgDone}/6 완료` };
  return { currentStep: 4, subLabel: '완성' };
}

const STEP_ROUTES: Record<number, string> = {
  1: '/dashboard',
  2: '/review',
  3: '/board',
  4: '/board',
};

export default function ProcessBar({ board }: Props) {
  const router = useRouter();
  const { currentStep, subLabel } = getStepInfo(board);

  function handleStepClick(stepNum: number) {
    if (stepNum <= currentStep) {
      router.push(STEP_ROUTES[stepNum]);
    }
  }

  return (
    <div className="w-full px-4 pt-4 pb-2">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isFuture = stepNum > currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={stepNum} className="flex items-center flex-1 min-w-0">
              {/* 스텝 아이콘 + 라벨 */}
              <button
                onClick={() => handleStepClick(stepNum)}
                disabled={isFuture}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 active:opacity-60 transition-opacity"
                style={{ cursor: isFuture ? 'default' : 'pointer' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isDone ? '#1C1B19' : isCurrent ? '#1C1B19' : 'transparent',
                    border: isFuture ? '1.5px dashed #D1D5DB' : 'none',
                    color: isDone || isCurrent ? '#fff' : '#9CA3AF',
                  }}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight text-center"
                  style={{ color: isCurrent ? '#1C1B19' : isDone ? '#6B7280' : '#C4C2BE' }}
                >
                  {step.short}
                </span>
                {isCurrent && (
                  <span className="text-[9px] text-[#9CA3AF] leading-tight">{subLabel}</span>
                )}
              </button>

              {/* 연결선 */}
              {!isLast && (
                <div
                  className="flex-1 h-px mx-1.5"
                  style={{ backgroundColor: stepNum < currentStep ? '#1C1B19' : '#E5E3DF' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
