'use client';

import { useRouter } from 'next/navigation';
import { BoardData } from '@/lib/types';

interface Props {
  board: BoardData;
}

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; short: string; route: string }[] = [
  { id: 1, short: '대화', route: '/dashboard' },
  { id: 2, short: '장면', route: '/review' },
  { id: 3, short: '이미지', route: '/board' },
  { id: 4, short: '마무리', route: '/finish' },
];

function getStepInfo(board: BoardData): { currentStep: StepId; subLabel: string } {
  const sections = Object.values(board.sections);
  const textDone = sections.filter((s) => s.status === 'text_complete' || s.status === 'completed').length;
  const sceneDone = sections.filter((s) => s.sceneText && s.sceneText.trim() !== '').length;
  const imgDone = sections.filter((s) => s.status === 'completed').length;

  if (textDone < 6) return { currentStep: 1, subLabel: `${textDone}/6` };
  if (sceneDone < 6) return { currentStep: 2, subLabel: `${sceneDone}/6` };
  if (imgDone < 6) return { currentStep: 3, subLabel: `${imgDone}/6` };
  return { currentStep: 4, subLabel: '완성' };
}

export default function ProcessBar({ board }: Props) {
  const router = useRouter();
  const { currentStep, subLabel } = getStepInfo(board);

  return (
    <div className="w-full px-4 pt-3 pb-2">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isFuture = step.id > currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => !isFuture && router.push(step.route)}
                disabled={isFuture}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-opacity active:opacity-60"
                style={{ cursor: isFuture ? 'default' : 'pointer' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isDone || isCurrent ? '#1C1B19' : 'transparent',
                    border: isFuture ? '1.5px dashed #D1D5DB' : 'none',
                    color: isDone || isCurrent ? '#fff' : '#9CA3AF',
                  }}
                >
                  {isDone ? '✓' : step.id}
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: isCurrent ? '#1C1B19' : isDone ? '#6B7280' : '#C4C2BE' }}
                >
                  {step.short}
                </span>
                {isCurrent && (
                  <span className="text-[9px] text-[#9CA3AF] leading-tight">{subLabel}</span>
                )}
              </button>
              {!isLast && (
                <div
                  className="flex-1 h-px mx-1.5"
                  style={{ backgroundColor: step.id < currentStep ? '#1C1B19' : '#E5E3DF' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
