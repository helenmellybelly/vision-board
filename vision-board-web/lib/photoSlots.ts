import { loadBoard, saveUploadedImage, saveGeneratedImages } from './storage';
import { SectionId } from './types';

// 슬롯 이미지 제거의 공용 경로 (v8.1) — /scenes 슬롯 ×와 콜라주 편집 '지우기'가 공유.
// 업로드가 우선 소스라 업로드부터 비우고, 없으면 생성 이미지를 비운다 (scenes 슬롯 표시 규칙과 동일)
export function removeSlotImage(sectionId: SectionId, slot: number): void {
  const sec = loadBoard().sections[sectionId];
  if (sec.uploadedImages?.[slot]) {
    saveUploadedImage(sectionId, slot, null);
    return;
  }
  if (sec.generatedImages?.[slot]) {
    const next = [...sec.generatedImages];
    next[slot] = '';
    saveGeneratedImages(sectionId, next);
  }
}
