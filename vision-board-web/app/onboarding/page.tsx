'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';

// v7.0-r1 — 온보딩 본체는 /onboarding/[step] 1~3으로 분리.
// 이 경로는 구 링크·북마크 호환용 재개(resume) 리다이렉트만 담당
export default function OnboardingResumeRedirect() {
  const router = useRouter();

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingDone) {
      router.replace('/dashboard');
      return;
    }
    const step = Math.min(Math.max(board.onboardingStep ?? 1, 1), 3);
    router.replace(`/onboarding/${step}`);
  }, [router]);

  return null;
}
