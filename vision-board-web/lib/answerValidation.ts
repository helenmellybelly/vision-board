import { ExtractedSlots } from './types';

// 섹션 답변 규칙 기반 검증 (v6.19) — AI 의미 검증 전에 무료로 거르는 1차 게이트.
// 순수 함수만 — DOM/storage 의존 금지.

export type AnswerKey = keyof ExtractedSlots;

export type InvalidReason = 'no_letters' | 'jamo_only' | 'repeated' | 'too_short';

export interface ValidationResult {
  valid: boolean;
  reason?: InvalidReason;
  message?: string;
}

// keyword는 "한 단어" 답변이라 2자부터 허용
export const MIN_CHARS: Record<AnswerKey, number> = {
  keyword: 2,
  feeling: 3,
  want: 4,
  current: 5,
};

const MSG_UNREADABLE = '음… 이대로는 내가 이해하기 어려워. 편하게 다시 써줄래?';

function tooShortMessage(key: AnswerKey): string {
  return key === 'keyword'
    ? '한 단어면 충분해. 두 글자 이상으로 써줄래?'
    : '조금만 더 들려줄래? 짧은 한 문장이면 돼.';
}

export function validateAnswer(key: AnswerKey, text: string): ValidationResult {
  const compact = text.replace(/\s+/g, '');

  if (!/[가-힣a-zA-Z]/.test(compact)) {
    return { valid: false, reason: 'no_letters', message: MSG_UNREADABLE };
  }
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(compact)) {
    return { valid: false, reason: 'jamo_only', message: MSG_UNREADABLE };
  }
  if (compact.length >= 4 && /^(.{1,2})\1+$/.test(compact)) {
    return { valid: false, reason: 'repeated', message: MSG_UNREADABLE };
  }
  if (compact.length < MIN_CHARS[key]) {
    return { valid: false, reason: 'too_short', message: tooShortMessage(key) };
  }
  return { valid: true };
}

// 실패한 항목만 반환
export function validateAll(
  answers: Partial<ExtractedSlots>
): Partial<Record<AnswerKey, ValidationResult>> {
  const failures: Partial<Record<AnswerKey, ValidationResult>> = {};
  (Object.keys(MIN_CHARS) as AnswerKey[]).forEach((key) => {
    const result = validateAnswer(key, answers[key] ?? '');
    if (!result.valid) failures[key] = result;
  });
  return failures;
}
