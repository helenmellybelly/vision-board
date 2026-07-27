'use client';

import { useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { track } from '@vercel/analytics';
import useFocusTrap from './useFocusTrap';
import { saveLoginNudgeSeen } from '@/lib/storage';

// B 소프트 게이트 (R2-2, 기획서 §2) — 게스트가 첫 사진을 담은 뒤 첫 대시보드 방문 시 1회.
// signIn만 호출하면 동의→가입→병합→동기화는 전역 상주 AccountFlow가 전부 처리한다.
export default function LoginNudgeSheet({ onClose }: { onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  useEffect(() => {
    track('login_nudge_shown', { source: 'gate' });
  }, []);

  function handleLogin() {
    track('login_nudge_click', { source: 'gate' });
    // OAuth 취소 복귀 시 재노출 방지 — 이동 전에 클릭 시점으로 스탬프
    saveLoginNudgeSeen();
    void signIn('google', { callbackUrl: '/dashboard' });
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="로그인 안내 시트"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-title font-bold">
            이 보드를 저장하고 이어가려면 Google로 로그인해둬
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-3 -mt-1 p-1.5 rounded-full text-[#6B7280] hover:bg-black/5"
          >
            ✕
          </button>
        </div>
        <p className="text-body text-[#6B7280] mb-5">
          지금은 이 기기 브라우저에만 저장돼. 기기를 바꾸거나 브라우저 데이터를 지우면 사라질 수
          있어.
        </p>
        <button
          onClick={handleLogin}
          className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold mb-2"
        >
          Google로 로그인해두기
        </button>
        <button onClick={onClose} className="w-full py-3 text-body text-[#6B7280]">
          나중에 할게
        </button>
      </div>
    </div>
  );
}
