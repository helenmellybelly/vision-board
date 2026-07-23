'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 전체 초기화는 되돌릴 수 없으므로 명시적 확인 후에만 실행한다 (v7.4 감사 H2).
// 예전에는 마운트 즉시 localStorage.clear()를 호출해, 오래된 북마크·히스토리·오타 URL로
// 진입만 해도 전 보드가 영구 삭제됐다.
export default function ResetPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  function handleReset() {
    localStorage.clear();
    setDone(true);
    router.replace('/onboarding');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        {done ? (
          <p className="text-[#6E6962] text-body">초기화 중...</p>
        ) : (
          <>
            <h1 className="text-title text-[#2C2A27] mb-3">정말 처음부터 다시 시작할까?</h1>
            <p className="text-body text-[#6E6962] mb-8">
              지금까지 담은 답변·사진·일기·콜라주가 모두 지워지고 되돌릴 수 없어.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl bg-[#C0392B] text-white text-body font-medium"
              >
                전부 지우고 다시 시작
              </button>
              <button
                onClick={() => router.back()}
                className="w-full py-3 rounded-xl border border-[#E5E3DF] text-[#6E6962] text-body"
              >
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
