import { SECTIONS } from './questions';
import { loadBoard, saveUploadedImage } from './storage';
import { importRemoteImage } from './imagePick';
import { SectionId } from './types';

// 이미 보드에 들어있는 원격 사진의 복구 (v8.7).
//
// v8.7 이전에는 붙여넣은 URL이 원본 그대로 저장됐다. 그런 사진은 남의 호스트에 인질로 잡혀 있어
// CORS·핫링크 차단·서명 만료 중 하나만 걸려도 배경화면 저장에서 조용히 빠진다.
// 여기서 "내 저장소로 가져오기"를 눌러 그 자리에서 수입한다.
//
// ⚠️ 마운트 시 일괄 변환은 일부러 하지 않는다 — 첫 화면이 멈추고, 잘 보이는 사진까지 용량을 먹고,
// quota가 터지면 절반만 바뀐 보드가 남는다. 실패가 확정된 지점(저장 시트의 빠진 사진 안내,
// 콜라주의 깨진 사진 경고)에서만 사용자가 눌러 실행한다.
// ⚠️ 스키마 마이그레이션에도 넣지 않는다 — migrateBoard는 동기 함수이고, 네트워크 변환을 넣으면
// 부분 실패 상태에서 schemaVersion만 올라가 재시도가 불가능해진다. 보드 스키마 v4 불변.

export interface RemoteSlot {
  sectionId: SectionId;
  slot: number;
  url: string;
  /** CollageBoard·parsePhotoKey와 같은 키 계약 `${sectionId}-${slot}` */
  key: string;
}

export interface NormalizeResult {
  converted: number;
  /** 원본이 사라졌거나 접근 권한이 만료된 사진 키 — 재시도해도 소용없어 "바꾸기"로 안내한다 */
  expired: string[];
  failed: string[];
  quotaHit: boolean;
}

/** 내 저장소 밖에 있는(= 언제든 깨질 수 있는) 사진 슬롯을 찾는다.
 *  onlyKeys를 주면 그 슬롯만 — 저장 시트가 "실제로 빠진 사진"만 고치는 데 쓴다. */
export function findRemoteSlots(onlyKeys?: string[]): RemoteSlot[] {
  const board = loadBoard();
  const want = onlyKeys ? new Set(onlyKeys) : null;
  const out: RemoteSlot[] = [];
  for (const section of SECTIONS) {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    for (let i = 0; i < 3; i++) {
      const url = uploaded[i] || generated[i] || '';
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) continue;
      const key = `${section.id}-${i}`;
      if (want && !want.has(key)) continue;
      out.push({ sectionId: section.id, slot: i, url, key });
    }
  }
  return out;
}

/** 슬롯을 하나씩 수입한다. 부분 성공을 허용 — 한 장이 실패해도 나머지는 살린다. */
export async function normalizeSlots(
  slots: RemoteSlot[],
  onProgress?: (done: number, total: number) => void
): Promise<NormalizeResult> {
  const result: NormalizeResult = { converted: 0, expired: [], failed: [], quotaHit: false };
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const imported = await importRemoteImage(s.url);
    if (!imported.ok) {
      if (imported.reason === 'gone') result.expired.push(s.key);
      else result.failed.push(s.key);
    } else if (!saveUploadedImage(s.sectionId, s.slot, imported.dataUrl)) {
      // 저장 공간이 찼다 — 여기서 멈춘다. 지금까지 바꾼 것은 그대로 유효하다
      result.quotaHit = true;
      onProgress?.(i + 1, slots.length);
      break;
    } else {
      result.converted += 1;
    }
    onProgress?.(i + 1, slots.length);
  }
  return result;
}
