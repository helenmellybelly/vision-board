'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';

// v7.0-r1 — 랜딩 페이지 제거. 루트는 상태에 따라 배분하는 리다이렉트 라우터만 담당:
// 완료자 → /dashboard, 신규·중간 이탈자 → 저장된 온보딩 스텝.
// (구 랜딩의 HeroBoard는 components/MiniBoardPreview.tsx로 이전 — R5 대시보드 진행 피드백에 재활용)
export default function RootRedirect() {
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
