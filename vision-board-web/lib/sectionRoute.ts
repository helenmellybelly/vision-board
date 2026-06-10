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
      return '장면 그리러 가기 →';
    case 'in_progress':
      return '이어서 그리기 →';
    case 'text_complete':
      if (!sectionData.sceneText) return '장면 그리러 가기 →';
      if (!sectionData.miniStory) return '순간 그리러 가기 →';
      return '이미지 만들기 →';
    case 'completed':
      return '다시 보기 →';
  }
}
