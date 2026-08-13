import { SECTIONS } from './questions';
import { loadBoard, saveUploadedImage, saveGeneratedImages } from './storage';
import { BoardData, SectionId } from './types';

/** 보드의 모든 사진 슬롯 — 키 계약은 CollageBoard·parsePhotoKey와 같은 `${sectionId}-${slot}`.
 *
 *  ⚠️ 이 순서·우선순위(업로드 > AI 생성)가 곧 배치의 순서다. 다른 곳에서 따로 뽑으면
 *     치수(photoDims)와 배치가 어긋난다 — v12에 /collage 지역 함수에서 여기로 올렸다.
 *     축하 화면(BoardPreview)이 같은 보드를 그려야 하기 때문이고, 두 벌로 두면
 *     "완성 화면만 사진 순서가 다르다"는 종류의 버그가 생긴다. */
export function photoSlotsOf(b: BoardData): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  for (const section of SECTIONS) {
    const sec = b.sections[section.id];
    for (let i = 0; i < 3; i++) {
      const src = sec.uploadedImages?.[i] || sec.generatedImages?.[i] || '';
      if (src) out.push({ key: `${section.id}-${i}`, src });
    }
  }
  return out;
}

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
