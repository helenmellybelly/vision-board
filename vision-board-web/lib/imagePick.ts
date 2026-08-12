import { SectionId } from './types';
import { loadBoard, saveUploadedImage } from './storage';
import { compressImageWithDims } from './imageUtils';
import { fingerprint } from './imageDims';

// 원격 사진(큐레이션·Unsplash 검색) 담기 공용 파이프라인 (v7.0-r4)
// proxy → base64 → 압축(0.55/640, 업로드보다 강하게 — localStorage 용량 보호) → 저장 → 다운로드 핑

export interface RemotePhoto {
  /** Unsplash photo id — 슬롯 출처 기록(uploadedImageSources)·담기 해제 토글의 키 (v7.1-r2) */
  id: string;
  regular: string;
  downloadLocation?: string;
}

export type PickResult = 'saved' | 'full' | 'quota' | 'error';

// ── 외부 URL 수입 (v8.7) ──
// 붙여넣은 순간 내 저장소로 복사한다. 보드에 남의 호스트 URL이 남으면 그 뒤로 영원히
// CORS·핫링크 차단·서명 만료에 인질이 되고, 배경화면 저장에서 조용히 빠진다.

export type ImportFailReason = 'pin' | 'not-image' | 'unreachable' | 'gone' | 'too-large' | 'decode';
/** dims(v10): 압축하며 함께 잰 원본 실측 치수. data: pass-through 경로는 재압축을 안 하므로
 *  치수를 모른 채 통과한다(undefined) — /collage 백필이 나중에 채운다. */
export type ImportResult =
  | { ok: true; dataUrl: string; dims?: { w: number; h: number } }
  | { ok: false; reason: ImportFailReason };

// ⚠️ 선두 문구는 검증 계약이다 — '그건 핀 페이지 주소야'(v81r1 C-1a·v81r2 V-7b·smoke S5),
// '이 주소에선 사진을 못 불러왔어'(v81r1 C-2a). 바꾸려면 해당 스위트도 함께.
export const IMPORT_NOTICES: Record<ImportFailReason, string> = {
  pin: "그건 핀 페이지 주소야. 사진을 꾹 눌러서(PC는 우클릭) '이미지 주소 복사'로 가져와줘.",
  'not-image': '이 주소에선 사진을 못 불러왔어. 이미지 자체 주소(…jpg 같은)를 붙여넣어줘.',
  unreachable: '이 주소에선 사진을 못 불러왔어. 이미지 자체 주소(…jpg 같은)를 붙여넣어줘.',
  gone: '이 사진은 만료돼서 다시 가져올 수 없어. 다른 사진으로 바꿔줄래?',
  'too-large': '사진이 너무 커서 못 담았어. 조금 작은 사진으로 해볼래?',
  decode: '이 주소에선 사진을 못 불러왔어. 이미지 자체 주소(…jpg 같은)를 붙여넣어줘.',
};

/** blob → data URL → 압축. pickRemotePhoto와 importRemoteImage의 공용 심장.
 *  ⚠️ compressImage에 https URL을 직접 넘기면 안 된다 — onerror가 원본을 그대로 resolve해 조용히 통과한다. */
async function blobToCompressedDataUrl(
  blob: Blob,
  quality: number,
  maxWidth: number
): Promise<{ dataUrl: string; w: number; h: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
  return compressImageWithDims(dataUrl, quality, maxWidth);
}

/** 외부 이미지 URL → 내 저장소에 넣을 data URL. 모든 붙여넣기 지점의 유일한 관문. */
export async function importRemoteImage(
  rawUrl: string,
  opts?: { quality?: number; maxWidth?: number }
): Promise<ImportResult> {
  const url = rawUrl.trim();
  // 핀 상세 페이지는 HTML이라 사진이 아니다 — 서버를 때리기 전에 걸러 안내를 정확히 한다
  if (/\/pin\//.test(url)) return { ok: false, reason: 'pin' };
  // data URL은 이미 내 것 — 재압축하면 화질만 깎인다 (검증 계약: v81r1 C-3 · v81r2 V-7c 정확 일치)
  if (url.startsWith('data:')) return { ok: true, dataUrl: url };

  let res: Response;
  try {
    res = await fetch(`/api/image/fetch?url=${encodeURIComponent(url)}`);
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (!res.ok) {
    if (res.status === 415) return { ok: false, reason: 'not-image' };
    if (res.status === 413) return { ok: false, reason: 'too-large' };
    if (res.status === 404) return { ok: false, reason: 'gone' };
    return { ok: false, reason: 'unreachable' };
  }
  try {
    const compressed = await blobToCompressedDataUrl(
      await res.blob(),
      opts?.quality ?? 0.55,
      opts?.maxWidth ?? 720
    );
    // compressImage는 실패해도 입력을 그대로 돌려준다 — 결과가 이미지 data URL인지 직접 확인
    if (!compressed.dataUrl.startsWith('data:image/')) return { ok: false, reason: 'decode' };
    return {
      ok: true,
      dataUrl: compressed.dataUrl,
      dims: compressed.w > 0 ? { w: compressed.w, h: compressed.h } : undefined,
    };
  } catch {
    return { ok: false, reason: 'decode' };
  }
}

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
    const compressed = await blobToCompressedDataUrl(await res.blob(), 0.55, 640);
    const ok = saveUploadedImage(
      sectionId,
      slot,
      compressed.dataUrl,
      photo.id,
      compressed.w > 0
        ? { w: compressed.w, h: compressed.h, f: fingerprint(compressed.dataUrl) }
        : null
    );
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
