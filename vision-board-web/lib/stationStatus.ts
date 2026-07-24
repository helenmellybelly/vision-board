import { SectionStatus } from '@/lib/types';

// 스테이션 상태 시각화 단일 소스 (v7.7) — 산책길 지도·미니보드 뱃지가 공유.
// 원칙: 아이콘은 "현재 상태"가 아니라 "다음 행동"을 가리킨다 —
// 💬 답하러 가기 · 📷 사진 담으러 가기 · 🌳 완성 · 🌰 아직 심기 전.
// 사진 먼저 경로(not_started+사진)는 📷 유지 — 🌰로 퇴행해 보이지 않게 (v7.5 계약 승계).
// 주의: aria-label(`${label} — ${STATUS_LABEL[status]}`)은 여기와 무관한 별도 계약 —
// 구 회귀 스위트가 문자열에 의존하므로 아이콘 변경이 라벨에 새어들면 안 된다.

export function statusEmoji(status: SectionStatus, hasPhoto: boolean): string {
  if (status === 'completed') return '🌳';
  if (status === 'text_complete') return '📷';
  if (status === 'in_progress') return '💬';
  if (hasPhoto) return '📷';
  return '🌰';
}

// 데스크톱 호버 툴팁(title) 문구 — 모바일은 호버가 없어 보조 수단으로만 쓴다
export function statusTitle(label: string, status: SectionStatus, hasPhoto: boolean): string {
  if (status === 'completed') return `${label} — 완성! 나무가 자랐어`;
  if (status === 'text_complete') return `${label} — 글은 완성! 이제 사진 담을 차례야`;
  if (status === 'in_progress') return `${label} — 지금 질문에 답하는 중이야`;
  if (hasPhoto) return `${label} — 사진은 담아뒀어. 이야기도 들려줘!`;
  return `${label} — 아직 시작 전이야. 토리랑 걸어볼까?`;
}
