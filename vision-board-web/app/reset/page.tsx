'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.clear();
    router.replace('/onboarding');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-[#6E6962] text-body">초기화 중...</p>
    </div>
  );
}
