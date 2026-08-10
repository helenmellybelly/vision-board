// 이 기기 ↔ 서버 동기화 스탬프 (v8.6) — 보드 스키마(v4)와 분리된 기기 로컬 메타.
// 보드 JSON에 넣으면 서버 왕복 시 다른 기기의 스탬프가 섞이므로 별도 localStorage 키가 계약이다.
const REV_KEY = 'vb-board-rev';
const MODIFIED_AT_KEY = 'vb-board-modified-at';
const SYNCED_LOCAL_REV_KEY = 'vb-synced-local-rev';
const SYNCED_SERVER_AT_KEY = 'vb-synced-server-at';

function readInt(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 로컬 보드 저장 횟수 — trySaveBoard 성공마다 +1. 없으면 0 */
export function getBoardRev(): number {
  return readInt(REV_KEY) ?? 0;
}

/** 마지막 로컬 저장 시각 (MergeSheet "마지막 작업" 라벨 — lastVisitAt보다 정확) */
export function getBoardModifiedAt(): number | null {
  return readInt(MODIFIED_AT_KEY);
}

export function bumpBoardRev(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REV_KEY, String(getBoardRev() + 1));
    localStorage.setItem(MODIFIED_AT_KEY, String(Date.now()));
  } catch {
    // 쿼터 초과 등 — 스탬프가 없으면 병합 검사가 ask로 떨어질 뿐, 데이터 유실 없음
  }
}

export function getSyncStamp(): { serverAt: number | null; localRev: number | null } {
  return {
    serverAt: readInt(SYNCED_SERVER_AT_KEY),
    localRev: readInt(SYNCED_LOCAL_REV_KEY),
  };
}

/** PUT 성공 시 — 서버 updated_at(epoch ms)과 푸시한 시점의 로컬 rev를 기록 */
export function setSyncStamp(serverAt: number, localRev: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNCED_SERVER_AT_KEY, String(serverAt));
    localStorage.setItem(SYNCED_LOCAL_REV_KEY, String(localRev));
  } catch {
    // 미기록 시 다음 병합 검사가 ask — 안전 측
  }
}

/** 계정 삭제 등 서버 보드가 사라졌을 때 — 동기화 관계 스탬프만 제거(로컬 저장 이력은 유지) */
export function clearSyncStamp(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNCED_SERVER_AT_KEY);
  localStorage.removeItem(SYNCED_LOCAL_REV_KEY);
}

/** 로그아웃 전체 초기화(v8.7) — 계정으로 이관 완료되어 기기 로컬 이력이 더 이상 필요 없을 때만 호출 */
export function clearAllDeviceStamps(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REV_KEY);
  localStorage.removeItem(MODIFIED_AT_KEY);
  localStorage.removeItem(SYNCED_SERVER_AT_KEY);
  localStorage.removeItem(SYNCED_LOCAL_REV_KEY);
}
