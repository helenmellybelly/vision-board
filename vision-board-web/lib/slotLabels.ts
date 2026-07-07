import { ExtractedSlots } from './types';

// 4개 답변 슬롯의 캐논 라벨·표시 순서 (v6.21 단일 소스, v7.0-r6: 숫자 슬롯ID 제거 — extractedSlots 키 기준)
// 순서는 질문 순서와 동일: 지금 → 원해 → 더 들여다보기 → 방향 키워드
export const SLOT_KEY_ORDER: (keyof ExtractedSlots)[] = ['current', 'want', 'feeling', 'keyword'];

export const SLOT_KEY_LABELS: Record<keyof ExtractedSlots, string> = {
  current: '지금',
  want: '원해',
  feeling: '더 들여다보기',
  keyword: '방향 키워드',
};
