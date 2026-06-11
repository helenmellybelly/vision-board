// 6개 영역 컬러 — 서비스 전체 단일 소스 (v6.12 팔레트 리뉴얼)
// 순서 = 섹션 id 1~6: 나 · 건강 · 관계 · 일 · 돈 · 공간
// 본문 텍스트로 쓰일 수 있어 흰색·크림(#FAF9F7) 배경 대비 4.5:1 이상으로 검증됨
export const SECTION_COLORS = [
  '#6F56C9', // 나 — 보라
  '#27804F', // 건강 — 그린
  '#A8600D', // 관계 — 앰버
  '#356FBE', // 일 — 블루
  '#B54E20', // 돈 — 테라코타
  '#187A8C', // 공간 — 틸
] as const;

// 연한 배경용 틴트 — 위 컬러와 같은 색상 계열
export const SECTION_LIGHT_COLORS = [
  '#F0EDFA',
  '#E7F2EC',
  '#F7EFE3',
  '#E8EFF8',
  '#F8EBE4',
  '#E5F1F3',
] as const;
