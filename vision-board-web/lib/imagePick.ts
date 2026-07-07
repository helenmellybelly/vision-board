import { SectionId } from './types';
import { loadBoard, saveUploadedImage } from './storage';
import { compressImage } from './imageUtils';

// 원격 사진(큐레이션·Unsplash 검색) 담기 공용 파이프라인 (v7.0-r4)
// proxy → base64 → 압축(0.55/640, 업로드보다 강하게 — localStorage 용량 보호) → 저장 → 다운로드 핑

export interface RemotePhoto {
  /** Unsplash photo id — 슬롯 출처 기록(uploadedImageSources)·담기 해제 토글의 키 (v7.1-r2) */
  id: string;
  regular: string;
  downloadLocation?: string;
}

export type PickResult = 'saved' | 'full' | 'quota' | 'error';

// 선호 슬롯을 우선 채우고, 차 있으면 빈 슬롯 순서대로 (구 SceneImageSuggestions.findSlot)
export function findFreeSlot(sectionId: SectionId, preferred = 0): number | null {
  const sec = loadBoard().sections[sectionId];
  const uploaded = sec.uploadedImages ?? [];
  const generated = sec.generatedImages ?? [];
  const isFree = (i: number) => !uploaded[i] && !generated[i];
  if (isFree(preferred)) return preferred;
  for (let i = 0; i < 3; i++) if (isFree(i)) return i;
  if (!uploaded[preferred]) return preferred;
  for (let i = 0; i < 3; i++) if (!uploaded[i]) return i;
  return null;
}

export async function pickRemotePhoto(
  sectionId: SectionId,
  photo: RemotePhoto,
  preferred = 0
): Promise<PickResult> {
  const slot = findFreeSlot(sectionId, preferred);
  if (slot === null) return 'full';
  try {
    const res = await fetch(`/api/image/proxy?url=${encodeURIComponent(photo.regular)}`);
    if (!res.ok) throw new Error('proxy failed');
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
    const compressed = await compressImage(dataUrl, 0.55, 640);
    const ok = saveUploadedImage(sectionId, slot, compressed, photo.id);
    if (!ok) return 'quota';
    // Unsplash 다운로드 핑 — 실패해도 무시 (가이드라인 준수)
    if (photo.downloadLocation) {
      fetch(`/api/unsplash?download=${encodeURIComponent(photo.downloadLocation)}`).catch(() => {});
    }
    return 'saved';
  } catch {
    return 'error';
  }
}

// 담기 해제 (v7.1-r2) — 출처가 photoId인 슬롯을 비운다. 찾으면 true
export function unpickRemotePhoto(sectionId: SectionId, photoId: string): boolean {
  const sec = loadBoard().sections[sectionId];
  const sources = sec.uploadedImageSources ?? [];
  const i = sources.findIndex((s) => s === photoId);
  if (i === -1) return false;
  saveUploadedImage(sectionId, i, null);
  return true;
}

// 현재 슬롯에 담겨 있는 원격 사진 id들 — 갤러리 picked 상태의 파생 원천 (v7.1-r2)
export function getPickedPhotoIds(sectionId: SectionId): string[] {
  const sec = loadBoard().sections[sectionId];
  const uploaded = sec.uploadedImages ?? [];
  const sources = sec.uploadedImageSources ?? [];
  return sources.filter((s, i): s is string => !!s && !!uploaded[i]);
}

export const PICK_NOTICES: Record<Exclude<PickResult, 'saved'>, string> = {
  full: '사진 3장이 가득 찼어. 위에서 한 장 비우면 담을 수 있어.',
  quota: '저장 공간이 가득 찼어. 보드에서 사진을 몇 장 지우고 다시 담아줘.',
  error: '이미지를 가져오지 못했어. 잠시 후 다시 시도해줘.',
};
