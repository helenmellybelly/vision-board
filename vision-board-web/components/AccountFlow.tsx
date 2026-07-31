'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { track } from '@/lib/analytics';
import { loadBoard, saveBoard } from '@/lib/storage';
import { decideMerge } from '@/lib/merge';
import { syncBoardNow } from '@/lib/sync';
import { BoardData } from '@/lib/types';
import ConsentSheet from './ConsentSheet';
import MergeSheet from './MergeSheet';

type Me = {
  authenticated: boolean;
  registered: boolean;
  email?: string;
  name?: string;
  marketingConsent?: boolean;
  hasBoard?: boolean;
  boardUpdatedAt?: number | null;
};

// 로그인 후 전역 오케스트레이션: 미등록→동의 시트(§5-1), 등록→병합 검사(§5), 이후 디바운스 동기화.
// 어느 화면에서 로그인하든 동작해야 하므로 Providers(레이아웃)에 상주한다.
export default function AccountFlow() {
  const { status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [mergeState, setMergeState] = useState<{
    server: BoardData;
    serverAt: number | null;
    newer: 'local' | 'server';
  } | null>(null);
  const syncEnabled = useRef(false);
  const syncing = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/me');
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as Me;
      setMe(data);
      if (!data.registered) {
        setShowConsent(true);
        return;
      }
      await afterRegistered();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function afterRegistered() {
    // 병합 검사는 브라우저 세션당 1회 — 리로드마다 시트가 반복되지 않게
    if (!sessionStorage.getItem('vb-merge-checked')) {
      sessionStorage.setItem('vb-merge-checked', '1');
      const res = await fetch('/api/board');
      if (res.ok) {
        const { board: server, updatedAt } = (await res.json()) as {
          board: BoardData | null;
          updatedAt: number | null;
        };
        const decision = decideMerge(loadBoard(), server, updatedAt);
        if (decision.action === 'useServer' && server) {
          saveBoard(server); // 리로드 후 loadBoard의 migrateBoard가 스키마를 맞춘다
          window.location.reload();
          return;
        }
        if (decision.action === 'ask' && server) {
          setMergeState({ server, serverAt: updatedAt, newer: decision.newer });
          return; // 선택 전 자동 업서트 금지 (§5)
        }
      }
    }
    enableSync();
  }

  function enableSync() {
    if (syncEnabled.current) return;
    syncEnabled.current = true;
    void runSync();
  }

  async function runSync() {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await syncBoardNow();
    } finally {
      syncing.current = false;
    }
  }

  // saveBoard가 쏘는 이벤트를 디바운스 구독 (변환 중 재저장 이벤트도 여기로 수렴)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onSaved() {
      if (!syncEnabled.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(), 2500);
    }
    window.addEventListener('vb:board-saved', onSaved);
    return () => {
      window.removeEventListener('vb:board-saved', onSaved);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConsent(marketingConsent: boolean) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketingConsent }),
    });
    if (!res.ok) return;
    track('signup_consent_done', { marketing: marketingConsent });
    setShowConsent(false);
    await afterRegistered();
  }

  function handleDeclineConsent() {
    setShowConsent(false);
    void signOut({ redirect: false }); // 게스트로 계속 — localStorage 무손상 (§1 관문 아님)
  }

  function handleMergeChoice(choice: 'local' | 'server') {
    if (!mergeState) return;
    track('login_merge_choice', { choice });
    if (choice === 'server') {
      saveBoard(mergeState.server);
      setMergeState(null);
      window.location.reload();
      return;
    }
    setMergeState(null);
    enableSync(); // 로컬 채택 → 다음 업서트가 서버를 덮는다
  }

  return (
    <>
      {showConsent && (
        <ConsentSheet
          email={me?.email ?? ''}
          onAccept={handleConsent}
          onDecline={handleDeclineConsent}
        />
      )}
      {mergeState && (
        <MergeSheet
          newer={mergeState.newer}
          localAt={loadBoard().lastVisitAt ?? null}
          serverAt={mergeState.serverAt}
          localBoard={loadBoard()}
          serverBoard={mergeState.server}
          onChoose={handleMergeChoice}
          onDismiss={() => setMergeState(null)}
        />
      )}
    </>
  );
}
