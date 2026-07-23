// 6개 영역 컬러 — 서비스 전체 단일 소스 (v6.16: 최초 Stage 1 팔레트 복원 — 사용자 요청)
// 순서 = 섹션 id 1~6: 나 · 건강 · 관계 · 일 · 돈 · 공간
// 주의: 비비드 톤이라 크림(#FAF9F7)·흰색 배경에서 본문 텍스트 대비 4.5:1 미만인 색이 있음(앰버·오렌지 등)
export const SECTION_COLORS = [
  '#8B5CF6', // 나 — 보라
  '#10B981', // 건강 — 에메랄드
  '#F59E0B', // 관계 — 앰버
  '#3B82F6', // 일 — 블루
  '#F97316', // 돈 — 오렌지
  '#06B6D4', // 공간 — 시안
] as const;

// 연한 배경용 틴트 — 위 컬러와 같은 색상 계열
export const SECTION_LIGHT_COLORS = [
  '#EDE9FE',
  '#D1FAE5',
  '#FEF3C7',
  '#DBEAFE',
  '#FFEDD5',
  '#CFFAFE',
] as const;

// v7.6 숲 서피스 팔레트 — 다크 패널 공통 단일 소스 (산책길 지도·미니보드·콜라주 숲 테마·배경화면 내보내기).
// 대비: 흰 글씨 14.2:1(deep) · #C4C2BE 라벨 9:1 · 완료 칩 #A7F3D0 위 #1F2E22 11:1 — 전부 AA 통과.
// DOM(CollageBoard)과 canvas(wallpaper.ts)가 같은 값을 써야 화면=저장 이미지.
export const FOREST = {
  deep: '#1F2E22', // gradient 상단 — 깊은 숲
  light: '#2A3D2E', // gradient 하단 — 옅은 숲
  base: '#243627', // 단색 fallback (그라디언트 불가 컨텍스트)
  card: '#33473A', // 연도 카드 (구 #3A3734)
  gradientCss: 'linear-gradient(180deg, #1F2E22 0%, #2A3D2E 100%)',
} as const;
