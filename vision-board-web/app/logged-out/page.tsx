'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';

// 로그아웃 완료 화면 (v8.6) — 로그아웃 후 '/'가 대시보드로 되돌려 체감 변화가 없다는 피드백.
// 보드는 기기에 남는다는 안내 + 재로그인 동선. RootRedirect(app/page.tsx)와 무관한 별도 라우트.
export default function LoggedOutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center max-w-md mx-auto w-full px-6 text-center bg-[#FAF9F7] text-[#1C1B19]">
      <p className="text-display mb-2" aria-hidden>
        🌰
      </p>
      <h1 className="text-title font-bold mb-2">로그아웃됐어</h1>
      <p className="text-body text-[#6B7280] mb-8">
        보드는 이 기기에 그대로 있어. 언제든 다시 로그인하면 저장해둔 보드와 이어져.
      </p>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold mb-2"
      >
        다시 로그인
      </button>
      <Link href="/dashboard" className="w-full py-3 text-body text-[#6B7280]">
        보드로 갈래
      </Link>
    </main>
  );
}
