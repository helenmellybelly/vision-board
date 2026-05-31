'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard } from '@/lib/storage';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingDone) {
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return null;
}
