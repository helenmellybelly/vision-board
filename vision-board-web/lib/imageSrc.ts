// 보드 사진 URL의 단일 관문 (v8.7).
//
// 왜 필요한가: 이전엔 표시(DOM <img>, crossOrigin 없음)와 내보내기(canvas, crossOrigin='anonymous')가
// **같은 사진을 다른 URL·다른 CORS 모드로** 요청했다. 그래서
//   (a) 브라우저 HTTP 캐시 엔트리가 갈라져(캐시 키에 CORS 모드가 들어간다) 내보내기가 매번 재로드,
//   (b) DOM이 먼저 no-cors로 채운 캐시 때문에 anonymous 요청이 실패,
//   (c) 폴백 프록시 요청 18개가 동시에 몰려 일부가 타임아웃 → "사진 N장은 못 불러와서 빠졌어".
// 게다가 DOM은 no-cors라 성공하므로 v8.1의 깨진 사진 경고가 이 실패 모드에선 아예 안 떴다.
//
// 해법: 보드 사진을 그리는 모든 곳이 displaySrc()를 통과한다. 원격 사진은 동일 출처 프록시 URL이
// 되고, 표시와 캔버스가 같은 URL을 crossOrigin 없이 로드한다 → 캐시 엔트리 1개, taint 0,
// 내보내기 시 네트워크 ≈ 0.
//
// ⚠️ app/api/image/proxy/route.ts의 isAllowed()와 락스텝 — 한쪽만 바꾸면 프록시가 403을 주거나
// (여기가 넓을 때) 원격 사진이 프록시를 못 타고 CORS에 의존하게 된다(여기가 좁을 때).

const PROXY_EXACT_HOSTS = ['images.unsplash.com'];
const PROXY_SUFFIX_HOSTS = ['.blob.core.windows.net', '.public.blob.vercel-storage.com'];

/** 이미지 프록시가 실제로 통과시켜주는 호스트인가 */
export function isProxyableHost(hostname: string): boolean {
  if (PROXY_EXACT_HOSTS.includes(hostname)) return true;
  return PROXY_SUFFIX_HOSTS.some((suffix) => hostname.endsWith(suffix));
}

/**
 * 보드 사진 src → 실제로 로드할 URL.
 * 원격 허용 호스트만 프록시로 돌리고, 나머지는 그대로 둔다.
 */
export function displaySrc(src: string): string {
  if (!src) return src;
  // 게스트 보드의 사실상 100% — 로컬 data URL은 CORS·프록시와 무관
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  // 동일 출처 자산(상대 경로)
  if (src.startsWith('/')) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (url.protocol !== 'https:') return src;

  // ⚠️ 여기서 window.location을 보면 안 된다 — 서버 렌더와 클라이언트 렌더의 결과가 갈려
  // 하이드레이션 불일치가 된다. 우리 오리진은 어차피 허용 목록에 없어 아래에서 그대로 통과한다.
  // 허용 밖 임의 호스트는 프록시가 403을 주므로 보내봐야 손해다. 원본을 그대로 두고,
  // lib/imageNormalize.ts의 복구 동선이 내 저장소로 수입해 이 분기 자체를 없앤다.
  if (!isProxyableHost(url.hostname)) return src;

  return `/api/image/proxy?url=${encodeURIComponent(src)}`;
}

/**
 * "다시 시도"용 — 오염되거나 실패가 캐시된 엔트리를 우회한다.
 * data URL 등 프록시를 안 타는 src에는 붙이지 않는다(길이만 늘고 의미 없음).
 */
export function bustedSrc(resolved: string, nonce: number): string {
  if (!nonce) return resolved;
  if (!resolved.startsWith('/api/image/proxy?')) return resolved;
  return `${resolved}&retry=${nonce}`;
}
