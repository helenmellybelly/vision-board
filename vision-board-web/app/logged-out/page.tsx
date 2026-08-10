'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';

// 로그아웃 완료 화면 (v8.6) — 로그아웃 후 '/'가 대시보드로 되돌려 체감 변화가 없다는 피드백.
// v8.7 — 로그아웃 시 기기 로컬 보드를 지우므로(계정으로 이관 완료) 안내 문구도 그에 맞게 변경.
// RootRedirect(app/page.tsx)와 무관한 별도 라우트.
export default function LoggedOutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center max-w-md mx-auto w-full px-6 text-center bg-[#FAF9F7] text-[#1C1B19]">
      <p className="text-display mb-2" aria-hidden>
        🌰
      </p>
      <h1 className="text-title font-bold mb-2">로그아웃됐어</h1>
      <p className="text-body text-[#6B7280] mb-8">
        보드는 네 계정에 안전하게 저장됐어. 언제든 다시 로그인하면 바로 이어서 볼 수 있어.
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
