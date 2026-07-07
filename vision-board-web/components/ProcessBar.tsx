'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BoardData } from '@/lib/types';
import { getStepRoute } from '@/lib/sectionRoute';

interface Props {
  board: BoardData;
}

type StepId = 1 | 2 | 3 | 4 | 5;

// 라벨은 시스템 구조가 아니라 사용자의 행동 언어로 — v6.15 리네이밍 (구: 대화·하루·스토리·이미지·마무리)
// 목적지는 정적 라우트가 아니라 getStepRoute()가 진행 상태 기반으로 결정 (v6.21)
const STEPS: { id: StepId; short: string }[] = [
  { id: 1, short: '꿈 꺼내기' },
  { id: 2, short: '하루 그리기' },
  { id: 3, short: '미래 스토리' },
  { id: 4, short: '사진 담기' },
  { id: 5, short: '완성' },
];

// 현재 경로가 가리키는 단계 (허브 페이지는 null → 상태 기반 fallback)
function getRouteStep(pathname: string): StepId | null {
  if (pathname.startsWith('/section')) return 1;
  if (pathname.startsWith('/scenes')) return 4; // '/scene'보다 먼저 매칭해야 함
  if (pathname.startsWith('/scene')) return 2;
  if (pathname.startsWith('/moment')) return 3;
  if (pathname.startsWith('/board')) return 4;
  if (pathname.startsWith('/finish')) return 5;
  return null;
}

function getStepInfo(board: BoardData, routeStep: StepId | null): {
  currentStep: StepId;
  maxStep: StepId;
  subLabel: string;
} {
  const sections = Object.values(board.sections);
  const textDone = sections.filter((s) => s.status === 'text_complete' || s.status === 'completed').length;
  const sceneDone = sections.filter((s) => s.sceneText && s.sceneText.trim() !== '').length;
  const storyDone = sections.filter((s) => s.miniStory && s.miniStory.trim() !== '').length;
  const imgDone = sections.filter((s) => s.status === 'completed').length;

  let stateStep: StepId = 5;
  if (textDone < 6) stateStep = 1;
  else if (sceneDone < 6) stateStep = 2;
  else if (storyDone < 6) stateStep = 3;
  else if (imgDone < 6) stateStep = 4;

  const currentStep = routeStep ?? stateStep;
  const maxStep = Math.max(stateStep, currentStep) as StepId;
  const subLabels: Record<StepId, string> = {
    1: `${textDone}/6`,
    2: `${sceneDone}/6`,
    3: `${storyDone}/6`,
    4: `${imgDone}/6`,
    5: '완성',
  };
  return { currentStep, maxStep, subLabel: subLabels[currentStep] };
}

export default function ProcessBar({ board }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentStep, maxStep, subLabel } = getStepInfo(board, getRouteStep(pathname));

  return (
    <div className="w-full px-4 pt-3 pb-2">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isFuture = step.id > maxStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => !isFuture && router.push(getStepRoute(board, step.id))}
                disabled={isFuture}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-opacity active:opacity-60"
                style={{ cursor: isFuture ? 'default' : 'pointer' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold transition-all"
                  style={{
                    backgroundColor: isDone || isCurrent ? '#1C1B19' : 'transparent',
                    border: isFuture ? '1.5px dashed #D1D5DB' : 'none',
                    color: isDone || isCurrent ? '#fff' : '#9CA3AF',
                  }}
                >
                  {isDone ? '✓' : step.id}
                </div>
                <span
                  className="text-micro font-semibold leading-tight"
                  style={{ color: isCurrent ? '#1C1B19' : isDone ? '#6B7280' : '#C4C2BE' }}
                >
                  {step.short}
                </span>
                {isCurrent && (
                  <span className="text-micro text-[#6E6962] leading-tight">{subLabel}</span>
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
