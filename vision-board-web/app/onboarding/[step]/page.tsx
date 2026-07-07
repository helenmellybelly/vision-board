'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  loadBoard,
  saveUserName,
  saveOnboardingStep,
  markOnboardingDone,
} from '@/lib/storage';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import Step1Name from '@/components/onboarding/Step1Name';
import Step2Acorn from '@/components/onboarding/Step2Acorn';
import Step3Compare from '@/components/onboarding/Step3Compare';

type OnboardingStep = 1 | 2 | 3;

// 온보딩 스텝별 URL (v7.0-r1) — 구 단일 /onboarding(useState Act 0~5)을 3스텝으로 분리해
// 이탈 지점을 URL로 추적한다. 스텝 전환은 push(replace 아님) → 브라우저 back과 자연 호환
export default function OnboardingStepPage() {
  const router = useRouter();
  const params = useParams<{ step: string }>();
  const stepNum = Number(params.step);
  const isValidStep = stepNum === 1 || stepNum === 2 || stepNum === 3;
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingDone) {
      router.replace('/dashboard');
      return;
    }
    if (!isValidStep) {
      router.replace('/onboarding/1');
      return;
    }
    setName(board.userName ?? '');
    setReady(true);
  }, [router, stepNum, isValidStep]);

  if (!ready || !isValidStep) return null;
  const step = stepNum as OnboardingStep;

  function goTo(next: OnboardingStep) {
    saveOnboardingStep(next);
    router.push(`/onboarding/${next}`);
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/dashboard');
  }

  return (
    <OnboardingShell
      step={step}
      onBack={step > 1 ? () => router.push(`/onboarding/${step - 1}`) : undefined}
    >
      {step === 1 && (
        <Step1Name
          initialName={name}
          onComplete={(n) => {
            saveUserName(n);
            goTo(2);
          }}
        />
      )}
      {step === 2 && <Step2Acorn name={name} onComplete={() => goTo(3)} />}
      {step === 3 && <Step3Compare onComplete={handleFinish} />}
    </OnboardingShell>
  );
}
