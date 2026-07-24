import { loadBoard, trySaveBoard } from './storage';

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

/** 이미지 변환 → 보드 업서트. 실패해도 조용히 넘어간다(§5 롤백 — 서버는 미러일 뿐). */
export async function syncBoardNow(): Promise<boolean> {
  try {
    await convertDataUrlsToBlob();
    const board = loadBoard();
    const res = await fetch('/api/board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: board }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
