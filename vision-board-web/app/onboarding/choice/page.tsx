'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { loadBoard } from '@/lib/storage';

// 온보딩 종료 선택 화면 (기획서 §2-1 A′) — Google/게스트 2버튼 대등 제시. 하드 게이트 아님.
// 게스트 유의 카피는 기술 어휘 금지 — 기획서 문구 그대로.
export default function OnboardingChoicePage() {
  const router = useRouter();
  const { status } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (!board.onboardingDone) {
      router.replace('/');
      return;
    }
    if (status === 'authenticated') {
      router.replace('/dashboard'); // 이미 로그인 상태면 선택 불필요
      return;
    }
    if (status !== 'loading') setReady(true);
  }, [router, status]);

  if (!ready) return null;

  return (
    <main className="min-h-screen flex flex-col justify-center max-w-md mx-auto w-full px-6 pb-10">
      <img src="/tori-profile-bust.png" alt="토리" className="w-14 h-14 rounded-full mb-4" />
      <h1 className="text-display font-bold mb-2">준비 끝! 어떻게 시작할까?</h1>
      <p className="text-body text-[#6B7280] mb-8">
        Google로 시작하면 보드가 안전하게 보관되고, 다른 기기에서도 이어서 만들 수 있어.
      </p>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold"
      >
        Google로 시작하기
      </button>
      {/* 재방문자 안내 (v8.3 P1) — 기존 회원이 게스트로 잘못 새는 걸 방지 */}
      <p className="text-caption text-[#9CA3AF] text-center mt-1.5 mb-3">
        전에 만들던 보드가 있으면 그대로 이어져.
      </p>
      <button
        onClick={() => router.replace('/dashboard')}
        className="w-full py-3.5 rounded-2xl border border-[#E5E1DA] font-bold mb-6"
      >
        게스트로 시작하기
      </button>
      <p className="text-caption text-[#9CA3AF]">
        지금은 이 기기 브라우저에만 저장돼. 기기를 바꾸거나 브라우저 데이터를 지우면 사라질 수
        있어. 언제든 Google로 로그인하면 안전하게 보관돼 — 게스트로 시작해도 나중에 로그인하면
        지금 보드를 그대로 이어가.
      </p>
    </main>
  );
}
