'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { UserRound } from 'lucide-react';
import useFocusTrap from './useFocusTrap';
import { resetBoard } from '@/lib/storage';

type Me = { registered: boolean; email?: string; marketingConsent?: boolean };

// 대시보드 헤더의 계정 진입점 — 마이페이지 1차는 별도 페이지 대신 시트 (기획서 §4)
export default function AccountButton() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wipeLocal, setWipeLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    if (!open || status !== 'authenticated') return;
    void fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d as Me));
  }, [open, status]);

  async function toggleMarketing() {
    if (!me) return;
    const next = !me.marketingConsent;
    const res = await fetch('/api/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketingConsent: next }),
    });
    if (res.ok) setMe({ ...me, marketingConsent: next });
  }

  async function handleDelete() {
    setBusy(true);
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      if (wipeLocal) resetBoard();
      await signOut({ redirect: false });
      window.location.href = '/';
      return;
    }
    setBusy(false);
  }

  const loggedIn = status === 'authenticated';

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setConfirmDelete(false);
        }}
        aria-label="계정"
        className="p-1.5 rounded-full text-[#6B7280] hover:bg-black/5"
      >
        <UserRound size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="계정 시트"
        >
          <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
            {!loggedIn ? (
              <>
                <h2 className="text-title font-bold mb-1">보드, 잃어버리지 않게 해줄게</h2>
                <p className="text-body text-[#6B7280] mb-5">
                  지금은 이 기기 브라우저에만 저장돼. Google로 로그인하면 안전하게 보관되고, 다른
                  기기에서도 이어서 만들 수 있어.
                </p>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold mb-2"
                >
                  Google로 로그인
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-3 text-body text-[#6B7280]"
                >
                  닫기
                </button>
              </>
            ) : !confirmDelete ? (
              <>
                <h2 className="text-title font-bold mb-1">내 계정</h2>
                <p className="text-body text-[#6B7280] mb-4">{me?.email ?? ''}</p>
                <label className="flex items-center justify-between mb-5">
                  <span className="text-body">마인드·자기성장 소식 받기 (선택)</span>
                  <input
                    type="checkbox"
                    checked={me?.marketingConsent ?? false}
                    onChange={toggleMarketing}
                  />
                </label>
                <button
                  onClick={() => void signOut({ redirect: false }).then(() => setOpen(false))}
                  className="w-full py-3.5 rounded-2xl border border-[#E5E1DA] font-bold mb-2"
                >
                  로그아웃
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-3 text-body text-[#B91C1C]"
                >
                  계정 삭제
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-3 text-body text-[#6B7280]"
                >
                  닫기
                </button>
              </>
            ) : (
              <>
                <h2 className="text-title font-bold mb-1">정말 삭제할까?</h2>
                <p className="text-body text-[#6B7280] mb-4">
                  서버에 저장된 보드와 계정 정보가 바로 삭제돼. 되돌릴 수 없어.
                </p>
                <label className="flex items-start gap-2 mb-5">
                  <input
                    type="checkbox"
                    checked={wipeLocal}
                    onChange={(e) => setWipeLocal(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-body">이 기기의 보드도 함께 지우기</span>
                </label>
                <button
                  disabled={busy}
                  onClick={handleDelete}
                  className="w-full py-3.5 rounded-2xl bg-[#B91C1C] text-white font-bold mb-2 disabled:opacity-40"
                >
                  삭제하기
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-full py-3 text-body text-[#6B7280]"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
