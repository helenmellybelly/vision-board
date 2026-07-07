import { BoardData, SectionData, SectionId } from './types';

const SECTION_IDS: SectionId[] = [1, 2, 3, 4, 5, 6];

// 섹션 상태에 따라 이어서 할 단계로 라우팅 (대시보드·보드 공용)
// v7.0-r2: /moment 흡수 — text_complete는 miniStory 유무로 /scene | /scenes 이분
export function getSectionRoute(sectionData: SectionData, sectionId: SectionId): string {
  switch (sectionData.status) {
    case 'not_started':
    case 'in_progress':
      return `/section/${sectionId}`;
    case 'text_complete':
      if (!sectionData.miniStory) return `/scene/${sectionId}`;
      return `/scenes/${sectionId}`;
    case 'completed':
      return `/scenes/${sectionId}`;
  }
}

export function getSectionCtaLabel(sectionData: SectionData): string {
  switch (sectionData.status) {
    case 'not_started':
      return '원하는 모습 답하러 가기 →';
    case 'in_progress':
      return '이어서 답하기 →';
    case 'text_complete':
      if (!sectionData.miniStory) return '미래의 하루 그리러 가기 →';
      return '이미지 만들기 →';
    case 'completed':
      return '다시 보기 →';
  }
}

// 답변(text_complete 이상)이 있는 섹션 중 이어서 할 첫 단계로 라우팅 (v6.21)
// /review CTA·ProcessBar가 공용 — '/scene/1' 하드코딩 대체
export function getNextIncompleteRoute(board: BoardData): string {
  const eligible = SECTION_IDS.filter((id) => {
    const s = board.sections[id];
    return s.status === 'text_complete' || s.status === 'completed';
  });
  const noStory = eligible.find((id) => !board.sections[id].miniStory);
  if (noStory) return `/scene/${noStory}`;
  const notDone = eligible.find((id) => board.sections[id].status !== 'completed');
  if (notDone) return `/scenes/${notDone}`;
  if (eligible.length === SECTION_IDS.length) return '/finish';
  return '/dashboard';
}

// 위 라우트에 어울리는 CTA 라벨
export function getNextIncompleteCtaLabel(route: string): string {
  if (route.startsWith('/scene/')) return '미래의 하루 그리기 시작 →';
  if (route.startsWith('/scenes/')) return '이어서 사진 담으러 가기 →';
  if (route === '/finish') return '비전보드 완성하러 가기 →';
  return '대시보드로 가기 →';
}

// ProcessBar 단계 탭 목적지 — 각 단계의 "작업할 위치"로 보낸다
// v7.0-r2: 5→4단계 (구 2 하루 그리기 + 3 미래 스토리 → 2 하루 그리기 통합)
export type ProcessStep = 1 | 2 | 3 | 4;

export function getStepRoute(board: BoardData, stepId: ProcessStep): string {
  if (stepId === 1) return '/dashboard';
  if (stepId === 4) return '/finish';
  const eligible = SECTION_IDS.filter((id) => {
    const s = board.sections[id];
    return s.status === 'text_complete' || s.status === 'completed';
  });
  if (stepId === 2) {
    // 하루 그리기(+스토리) — 스토리까지가 이 단계의 완료 정의
    const target = eligible.find((id) => !board.sections[id].miniStory);
    return target ? `/scene/${target}` : '/review';
  }
  // stepId === 3 — 사진 담기: 스토리까지 있는 미완성 섹션이 우선, 없으면 보드로
  const target = eligible.find(
    (id) => board.sections[id].miniStory && board.sections[id].status !== 'completed'
  );
  return target ? `/scenes/${target}` : '/board';
}

// 사진은 있는데 채팅·스토리 단계가 남은 섹션 — CTA를 pill로 강조해 다음 단계를 권유
export function shouldHighlightCta(sectionData: SectionData): boolean {
  if (sectionData.status === 'completed') return false;
  const hasPhoto = (sectionData.uploadedImages ?? []).some((img) => !!img);
  return hasPhoto && !sectionData.miniStory;
}
