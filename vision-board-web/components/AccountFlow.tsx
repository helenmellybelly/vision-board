'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { track } from '@/lib/analytics';
import { loadBoard, saveBoard } from '@/lib/storage';
import { decideMerge } from '@/lib/merge';
import { syncBoardNow } from '@/lib/sync';
import { getBoardModifiedAt, getBoardRev, getSyncStamp, setSyncStamp } from '@/lib/syncStamp';
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
  const pendingSync = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // "나중에 정할게" 보류 중 — 리로드가 enableSync로 새어 서버를 조용히 덮지 않게 (v8.6).
    // sessionStorage라 탭 세션이 끝나면 소멸 → 다음 세션엔 진짜 충돌일 때만 다시 묻는다.
    if (sessionStorage.getItem('vb-merge-deferred')) return;
    // 병합 검사는 브라우저 세션당 1회 — 리로드마다 시트가 반복되지 않게
    if (!sessionStorage.getItem('vb-merge-checked')) {
      sessionStorage.setItem('vb-merge-checked', '1');
      const res = await fetch('/api/board');
      if (res.ok) {
        const { board: server, updatedAt } = (await res.json()) as {
          board: BoardData | null;
          updatedAt: number | null;
        };
        const decision = decideMerge(loadBoard(), server, updatedAt, {
          ...getSyncStamp(),
          currentRev: getBoardRev(),
          modifiedAt: getBoardModifiedAt(),
        });
        if (decision.action === 'useServer' && server) {
          saveBoard(server); // 리로드 후 loadBoard의 migrateBoard가 스키마를 맞춘다
          // 채택 직후를 "동기화됨"으로 스탬프 — 다음 검사에서 다시 묻지 않게 (v8.6)
          if (updatedAt !== null) setSyncStamp(updatedAt, getBoardRev());
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

  async function runSync(opts?: { keepalive?: boolean; isRetry?: boolean }) {
    if (syncing.current) {
      pendingSync.current = true; // 진행 중(이미지 변환 등) 발생한 저장 유실 방지 — 완료 후 1회 재실행 (v8.6)
      return;
    }
    syncing.current = true;
    let ok = false;
    try {
      ok = await syncBoardNow(opts);
    } finally {
      syncing.current = false;
    }
    if (pendingSync.current) {
      pendingSync.current = false;
      void runSync();
      return;
    }
    // 무음 실패 1회 재시도 — 서버 미러가 조용히 뒤처지는 것 완화. 재시도의 재시도는 없음(과설계 금지),
    // 이후 저장 이벤트가 어차피 새 동기화를 큐잉한다 (v8.6)
    if (!ok && !opts?.isRetry && !retryTimer.current) {
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void runSync({ isRetry: true });
      }, 5000);
    }
  }

  // saveBoard가 쏘는 이벤트를 디바운스 구독 (변환 중 재저장 이벤트도 여기로 수렴)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onSaved() {
      if (!syncEnabled.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void runSync();
      }, 2500);
    }
    // 디바운스 대기분을 탭 이탈 직전에 플러시 — 2.5초 내 이탈로 인한 마지막 저장 유실 방지 (v8.6)
    function flush() {
      if (!syncEnabled.current || !timer) return;
      clearTimeout(timer);
      timer = null;
      void runSync({ keepalive: true });
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush();
    }
    window.addEventListener('vb:board-saved', onSaved);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('vb:board-saved', onSaved);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearTimeout(timer);
      if (retryTimer.current) clearTimeout(retryTimer.current);
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
      if (mergeState.serverAt !== null) setSyncStamp(mergeState.serverAt, getBoardRev());
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
          localAt={getBoardModifiedAt() ?? loadBoard().lastVisitAt ?? null}
          serverAt={mergeState.serverAt}
          localBoard={loadBoard()}
          serverBoard={mergeState.server}
          onChoose={handleMergeChoice}
          onDismiss={() => {
            // 보류 — 이 탭 세션에선 검사도 푸시도 하지 않는다("두 보드 다 그대로" 카피의 계약, v8.6)
            sessionStorage.setItem('vb-merge-deferred', '1');
            setMergeState(null);
          }}
        />
      )}
    </>
  );
}
