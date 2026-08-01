'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import useFocusTrap from './useFocusTrap';
import { resetBoard } from '@/lib/storage';
import { clearSyncStamp } from '@/lib/syncStamp';

// 같은 탭 재로그인 시 병합 검사가 통째로 건너뛰어지지 않게 — 세션 스탬프 정리 (v8.6)
function clearMergeSessionStamps() {
  sessionStorage.removeItem('vb-merge-checked');
  sessionStorage.removeItem('vb-merge-deferred');
}

// 도토리 아이콘 (v8.5) — 범용 사람 아이콘이 정원사 토리 세계관과 이질적이라는 피드백.
// ⚠️ 버튼 aria-label('내 계정 — 로그인됨'/'계정')은 verify-r2a·v79 계약 — 아이콘만 교체
function AcornIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.8c-.6 0-1 .5-1 1v1.7h2V2.8c0-.5-.4-1-1-1Z" fill="#6B4226" />
      <path
        d="M12 3.8c-4.3 0-7.2 2.2-7.2 5.2 0 .6.5 1 1 1h12.4c.5 0 1-.4 1-1 0-3-2.9-5.2-7.2-5.2Z"
        fill="#8B5E3C"
      />
      <path
        d="M5.6 11.4c.4 4.7 2.8 8.7 6.4 11.8 3.6-3.1 6-7.1 6.4-11.8H5.6Z"
        fill="#C98A4B"
      />
    </svg>
  );
}

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
      clearMergeSessionStamps();
      clearSyncStamp(); // 서버 보드가 사라졌으므로 동기화 스탬프는 무의미 (v8.6)
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
        aria-label={loggedIn ? '내 계정 — 로그인됨' : '계정'}
        className="relative p-2 rounded-full border border-[#E5E1DA] bg-[#FAF7F2] text-[#1C1B19] hover:bg-black/5"
      >
        <AcornIcon />
        {/* 로그인 상태 점 — 아이콘만으로 게스트/로그인 구분이 안 보인다는 피드백(v7.9) */}
        {loggedIn && (
          <span
            aria-hidden
            className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-white"
          />
        )}
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
                  onClick={() => {
                    clearMergeSessionStamps();
                    // 완료 화면으로 풀 리로드 이동 — 세션 잔상 없이 게스트 상태 재부트.
                    // signOut 실패 시에도 이동한다(리로드가 세션을 재평가, v8.6)
                    const go = () => {
                      window.location.href = '/logged-out';
                    };
                    void signOut({ redirect: false }).then(go, go);
                  }}
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
