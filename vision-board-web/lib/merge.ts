import { BoardData } from './types';

export type MergeDecision =
  | { action: 'useLocal' }
  | { action: 'useServer' }
  | { action: 'ask'; newer: 'local' | 'server' };

/** "내용 있는 보드" — 어떤 섹션이든 대화/이야기/사진이 하나라도 있으면 true (기획서 §5 빈 보드 판정) */
export function isBoardMeaningful(b: BoardData | null | undefined): boolean {
  if (!b || !b.sections) return false;
  if (b.futureDayStory || b.oneSentence) return true;
  return Object.values(b.sections).some(
    (s) =>
      (s.chatMessages?.length ?? 0) > 0 ||
      !!s.sceneText ||
      !!s.miniStory ||
      // 질문 답변·유예만 있는 보드도 내용 있음 — 로그인 시 서버 보드로 조용히 덮이지 않게 (v8.1)
      Object.keys(s.extractedSlots ?? {}).length > 0 ||
      (s.deferredSlots?.length ?? 0) > 0 ||
      (s.uploadedImages ?? []).some(Boolean) ||
      (s.generatedImages ?? []).some(Boolean) ||
      (s.images ?? []).some(Boolean)
  );
}

/** 로컬 최신성은 lastVisitAt(기획서 §5 — 로컬은 lastVisitAt), 서버는 boards.updated_at.
 *  둘 다 내용이 있으면 자동 덮어쓰기 금지 — 최신 쪽만 제안(ask)하고 선택은 사용자 몫. */
export function decideMerge(
  local: BoardData,
  server: BoardData | null,
  serverUpdatedAt: number | null
): MergeDecision {
  const serverMeaningful = isBoardMeaningful(server);
  const localMeaningful = isBoardMeaningful(local);
  if (!serverMeaningful) return { action: 'useLocal' };
  if (!localMeaningful) return { action: 'useServer' };
  const localAt = local.lastVisitAt ?? local.startedAt ?? 0;
  return { action: 'ask', newer: (serverUpdatedAt ?? 0) > localAt ? 'server' : 'local' };
}
