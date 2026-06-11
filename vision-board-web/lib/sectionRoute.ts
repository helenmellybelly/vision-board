import { SectionData, SectionId } from './types';

// 섹션 상태에 따라 이어서 할 단계로 라우팅 (대시보드·보드 공용)
export function getSectionRoute(sectionData: SectionData, sectionId: SectionId): string {
  switch (sectionData.status) {
    case 'not_started':
    case 'in_progress':
      return `/section/${sectionId}`;
    case 'text_complete':
      if (!sectionData.sceneText) return `/scene/${sectionId}`;
      if (!sectionData.miniStory) return `/moment/${sectionId}`;
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
      if (!sectionData.sceneText) return '미래의 하루 그리러 가기 →';
      if (!sectionData.miniStory) return '원하는 하루, 스토리로 보기 →';
      return '이미지 만들기 →';
    case 'completed':
      return '다시 보기 →';
  }
}

// 사진은 있는데 채팅·스토리 단계가 남은 섹션 — CTA를 pill로 강조해 다음 단계를 권유
export function shouldHighlightCta(sectionData: SectionData): boolean {
  if (sectionData.status === 'completed') return false;
  const hasPhoto = (sectionData.uploadedImages ?? []).some((img) => !!img);
  return hasPhoto && !sectionData.miniStory;
}
