import { loadBoard, trySaveBoard } from './storage';
import { getBoardRev, setSyncStamp } from './syncStamp';

// base64 이미지 → Blob URL 치환. localStorage 자체를 바꾼다(기획서 §5 가입 시점 일괄 변환).
// 부분 실패는 그대로 두고 다음 동기화에서 재시도 — localStorage가 진실 원천이라 유실 없음.
export async function convertDataUrlsToBlob(): Promise<void> {
  const board = loadBoard();
  let changed = false;
  for (const section of Object.values(board.sections)) {
    for (const key of ['uploadedImages', 'generatedImages'] as const) {
      const arr = section[key];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v !== 'string' || !v.startsWith('data:image/')) continue;
        try {
          const res = await fetch('/api/blob/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: v }),
          });
          if (!res.ok) continue;
          const { url } = (await res.json()) as { url: string };
          arr[i] = url;
          changed = true;
        } catch {
          // 오프라인 등 — 다음 기회에
        }
      }
    }
  }
  if (changed) trySaveBoard(board);
}

/** 이미지 변환 → 보드 업서트. 실패해도 조용히 넘어간다(§5 롤백 — 서버는 미러일 뿐).
 *  keepalive: 탭 이탈 직전 플러시용 — 64KB 바디 한도로 실패할 수 있으나 스탬프 미기록이라 자가 치유 (v8.6) */
export async function syncBoardNow(opts?: { keepalive?: boolean }): Promise<boolean> {
  try {
    await convertDataUrlsToBlob();
    const board = loadBoard();
    // rev는 변환 완료 후 캡처 — 변환 중 trySaveBoard가 rev를 올린다. PUT 중 사용자가
    // 저장하면 rev가 이 값을 넘어서고, 다음 병합 검사에서 정확히 "로컬 변경 있음"이 된다.
    const rev = getBoardRev();
    const res = await fetch('/api/board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: board }),
      keepalive: opts?.keepalive,
    });
    if (!res.ok) return false;
    const { updatedAt } = (await res.json()) as { updatedAt?: number | null };
    if (typeof updatedAt === 'number') setSyncStamp(updatedAt, rev);
    return true;
  } catch {
    return false;
  }
}
