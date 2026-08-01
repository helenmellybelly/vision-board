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

/** 병합 시트 옵션 카드 요약 (v8.5) — 타임스탬프만으론 어느 쪽이 내 보드인지 알 수 없다는 피드백.
 *  일기 수 = miniStory 있는 섹션 수, 사진 수 = 업로드·생성 슬롯 합(legacy images는 그 폴백) */
export function boardSummary(b: BoardData | null | undefined): {
  diaryCount: number;
  photoCount: number;
} {
  if (!b || !b.sections) return { diaryCount: 0, photoCount: 0 };
  const sections = Object.values(b.sections);
  const diaryCount = sections.filter((s) => !!s.miniStory?.trim()).length;
  const photoCount = sections.reduce((acc, s) => {
    const modern = [...(s.uploadedImages ?? []), ...(s.generatedImages ?? [])].filter(Boolean)
      .length;
    const legacy = (s.images ?? []).filter(Boolean).length;
    return acc + (modern || legacy);
  }, 0);
  return { diaryCount, photoCount };
}

/** 이 기기 ↔ 서버 동기화 스탬프 (v8.6) — 호출부가 lib/syncStamp에서 읽어 주입한다.
 *  ⚠️ 이 모듈은 순수 유지(./types 외 import·localStorage 금지) — verify-v81r1 D-1이 tsc 단독 컴파일 */
export type SyncStamp = {
  /** 마지막 성공 PUT 응답의 서버 updated_at (epoch ms) */
  serverAt: number | null;
  /** 마지막 성공 PUT 시점의 로컬 rev */
  localRev: number | null;
  /** 현재 로컬 rev */
  currentRev: number;
  /** 마지막 로컬 저장 시각 — ask 라벨·newer 판정용 (lastVisitAt보다 정확) */
  modifiedAt?: number | null;
};

// 내용 비교에서 제외하는 휘발 필드 — 방문·넛지·연출 스탬프는 "보드 내용"이 아니다 (v8.6)
const VOLATILE_BOARD_KEYS = [
  'lastVisitAt',
  'loginBannerDismissedAt',
  'loginNudgeSeen',
  'dashboardIntroSeen',
  'finishCelebrated',
  'storyUpgradeNudgeDismissed',
  'pathChoice',
  'schemaVersion',
];
const VOLATILE_SECTION_KEYS = ['photoFirstNudgeDismissed'];

// Postgres jsonb는 키 순서를 보존하지 않는다 — 재귀 키 정렬 직렬화가 동등성 비교의 전제
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) {
    return '[' + v.map((x) => stableStringify(x === undefined ? null : x)).join(',') + ']';
  }
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function normalizeForCompare(b: BoardData): unknown {
  const clone = JSON.parse(JSON.stringify(b)) as Record<string, unknown>;
  for (const k of VOLATILE_BOARD_KEYS) delete clone[k];
  const sections = clone.sections as Record<string, Record<string, unknown>> | undefined;
  if (sections) {
    for (const s of Object.values(sections)) {
      for (const k of VOLATILE_SECTION_KEYS) delete s[k];
    }
  }
  return clone;
}

/** 휘발 필드를 제외한 내용 동등성 — 동일 보드가 병합 질문을 다시 받지 않게 (v8.6) */
export function boardsEqual(a: BoardData, b: BoardData): boolean {
  return stableStringify(normalizeForCompare(a)) === stableStringify(normalizeForCompare(b));
}

/** 병합 판정 v2 (v8.6) — "양쪽 다 내용 있음"이 아니라 진짜 충돌일 때만 ask.
 *  스탬프가 없으면(구 데이터·검증 하위호환) 기존처럼 ask로 떨어진다. */
export function decideMerge(
  local: BoardData,
  server: BoardData | null,
  serverUpdatedAt: number | null,
  stamp?: SyncStamp
): MergeDecision {
  const serverMeaningful = isBoardMeaningful(server);
  const localMeaningful = isBoardMeaningful(local);
  if (!serverMeaningful) return { action: 'useLocal' };
  if (!localMeaningful) return { action: 'useServer' };
  // 내용이 같으면 물을 게 없다 — 로컬 유지, 이후 푸시가 서버를 최신화
  if (server && boardsEqual(local, server)) return { action: 'useLocal' };
  if (stamp) {
    // 서버가 이 기기의 마지막 푸시 그대로 — 로컬이 같거나 앞선다
    if (stamp.serverAt !== null && serverUpdatedAt !== null && stamp.serverAt === serverUpdatedAt) {
      return { action: 'useLocal' };
    }
    // 마지막 푸시 이후 로컬 무변경 + 서버만 전진(다른 기기 작업) — 조용히 서버 채택
    if (
      stamp.localRev !== null &&
      stamp.localRev === stamp.currentRev &&
      (serverUpdatedAt ?? 0) > (stamp.serverAt ?? 0)
    ) {
      return { action: 'useServer' };
    }
  }
  // 양쪽이 독립적으로 갈라짐 — 자동 덮어쓰기 금지, 선택은 사용자 몫 (기획서 §5)
  const localAt = stamp?.modifiedAt ?? local.lastVisitAt ?? local.startedAt ?? 0;
  return { action: 'ask', newer: (serverUpdatedAt ?? 0) > localAt ? 'server' : 'local' };
}
