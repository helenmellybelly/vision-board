// 사진 실측 치수 (v10).
//
// 왜 필요한가: v9까지 배치 엔진은 개별 사진이 가로인지 세로인지 **전혀 몰랐다**. 저장 스키마에
// width/height 필드가 없었고, 엔진은 모든 셀을 픽셀 정사각으로 가정한 뒤 object-cover로 잘라 넣었다.
// 그래서 세로 사진이 정사각 셀에서 40~55% 잘려 나갔고, 그 회피책으로 존재하던 게 매트 갤러리
// (흰 액자 + object-contain)였다. 치수를 알면 두 문제가 동시에 사라진다.
//
// ⚠️ 핵심 계약: 측정은 반드시 displaySrc()를 거치고 crossOrigin을 **설정하지 않는다**.
//    보드의 DOM <img>와 완전히 같은 조건이어야 브라우저 HTTP 캐시를 공유한다. 조건이 어긋나면
//    캐시 엔트리가 갈라져 사진 18장을 통째로 다시 받게 되고, 그게 v8.6까지의
//    "사진 N장은 못 불러와서 빠졌어"의 직접 원인이었다(lib/imageSrc.ts 헤더 참고).

import { displaySrc } from './imageSrc';
import { mapLimit } from './mapLimit';

/** 저장되는 치수 레코드. f = 슬롯 내용 지문 — 사진이 교체되면 자동으로 무효화된다 */
export interface PhotoDim {
  w: number;
  h: number;
  f: string;
}

/** 슬롯 내용 지문 — src 전체를 키로 쓸 수 없어서(200KB data URL) 길이+꼬리로 근사한다.
 *  충돌해도 손해는 "비율을 한 번 잘못 쓴다"뿐이고, 다음 교체에서 길이가 바뀌며 자연 복구된다. */
export function fingerprint(src: string): string {
  return `${src.length}:${src.slice(-16)}`;
}

/** 저장된 치수에서 이 슬롯의 가로세로비를 꺼낸다. 없거나 지문이 어긋나면 undefined(= 모름). */
export function ratioOf(
  dims: Record<string, PhotoDim> | undefined,
  key: string,
  src: string,
): number | undefined {
  const d = dims?.[key];
  if (!d || d.w <= 0 || d.h <= 0) return undefined;
  if (d.f !== fingerprint(src)) return undefined;
  return d.w / d.h;
}

/** 한 장 측정. 실패·타임아웃이면 null — 호출부는 "모름"으로 취급하고 넘어간다. */
export function measure(src: string, timeoutMs = 12_000): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    let done = false;
    const finish = (v: { w: number; h: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(v);
    };
    const timer = setTimeout(() => {
      // 빈 문자열을 넣으면 브라우저가 현재 페이지 URL로 다시 요청한다 — 취소는 data:,로 (v8.7)
      img.src = 'data:,';
      finish(null);
    }, timeoutMs);
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      finish(w > 0 && h > 0 ? { w, h } : null);
    };
    img.onerror = () => finish(null);
    // ⚠️ crossOrigin을 설정하지 말 것 — DOM <img>와 캐시 키를 맞춘다
    img.src = displaySrc(src);
  });
}

/**
 * 여러 장 측정. 동시 실행 상한 + 전체 데드라인.
 *
 * 데드라인이 필요한 이유: 프록시 장애 시 18장이 각자 12초를 기다리면 백필이 사실상 멈춘 것처럼
 * 보인다. 시간이 다 되면 그때까지 측정된 것만 돌려주고, 나머지는 다음 마운트에서 다시 시도한다.
 */
export async function measureMany(
  items: { key: string; src: string }[],
  limit = 6,
  opts?: { deadlineMs?: number },
): Promise<Map<string, PhotoDim>> {
  const out = new Map<string, PhotoDim>();
  if (!items.length) return out;

  const deadlineMs = opts?.deadlineMs ?? 6_000;
  let expired = false;
  const deadline = setTimeout(() => {
    expired = true;
  }, deadlineMs);

  await mapLimit(items, limit, async (item) => {
    if (expired) return;
    const d = await measure(item.src);
    if (d) out.set(item.key, { w: d.w, h: d.h, f: fingerprint(item.src) });
  });

  clearTimeout(deadline);
  return out;
}
