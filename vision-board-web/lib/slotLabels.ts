import { ExtractedSlots, SlotId } from './types';

// 4개 답변 슬롯의 캐논 라벨·표시 순서 (v6.21 단일 소스)
// 순서는 질문 순서와 동일: 지금 → 원해 → 더 들여다보기 → 방향 키워드
export const SLOT_LABELS: Record<number, string> = {
  1: '지금',
  3: '원해',
  5: '더 들여다보기',
  2: '방향 키워드',
};

export const SLOT_ORDER: SlotId[] = [1, 3, 5, 2];

// extractedSlots 키 기준 라벨 — 위와 같은 라벨의 키 형태 (scene 컨텍스트 카드 등)
export const SLOT_KEY_LABELS: Record<keyof ExtractedSlots, string> = {
  current: SLOT_LABELS[1],
  want: SLOT_LABELS[3],
  feeling: SLOT_LABELS[5],
  keyword: SLOT_LABELS[2],
};
