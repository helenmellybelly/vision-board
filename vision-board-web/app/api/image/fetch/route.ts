import { NextRequest } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { rateLimited } from '@/lib/apiGuard';

// 사용자가 붙여넣은 임의 호스트 이미지의 **1회성 수입** 통로 (v8.7).
//
// /api/image/proxy와 일부러 분리했다. 프록시의 계약은 "좁은 허용 목록 + public·immutable 1년 캐시"다.
// 거기에 임의 호스트를 얹으면 (a) 남의 콘텐츠가 우리 CDN에 1년 눌러앉고 (b) 캐시까지 되는
// 오픈 이미지 프록시가 되어 핫링크·우회 도구로 악용된다.
// 여기는 반대로 no-store·저한도·강한 SSRF 방어를 걸고, 결과는 클라가 즉시 압축해 **내 저장소로**
// 옮긴다(lib/imagePick importRemoteImage). 그래서 보드에는 임의 호스트 URL이 남지 않는다.
//
// ⚠️ 잔여 리스크(수용): DNS rebinding. "조회 → 검증 → fetch" 사이의 TOCTOU를 완전히는 막지 못한다.
// 조회된 IP로 직접 접속 + SNI 조작까지 가면 복잡도가 과하고, Vercel 함수에서 도달 가능한 내부
// VPC 자원이 없다는 점을 근거로 잔여 리스크를 수용한다.

// node:dns/node:net이 필요하다 — 기본값과 같지만 의존성이 명시적이도록 남긴다
export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
// SVG는 제외 — 스크립트를 품을 수 있고, 우리는 <img>/canvas로만 쓴다
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const BLOCKED_NAMES = ['localhost', 'metadata.google.internal'];
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost'];

function fail(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** 사설·루프백·링크로컬 등 공인 인터넷 밖 주소인가 */
function isPrivateIp(addr: string): boolean {
  let ip = addr;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) 는 언랩해서 v4 규칙으로 다시 본다
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) ip = mapped[1];

  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true; // 링크로컬 (클라우드 메타데이터)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] >= 224) return true; // 멀티캐스트·예약
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::' || low === '::1') return true;
    if (low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb'))
      return true; // fe80::/10 링크로컬
    const first = parseInt(low.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 유니크 로컬
    return false;
  }
  return true; // 파싱 불가 = 차단
}

/** 호스트가 공인 인터넷의 것인지 — 이름 블록리스트 + 모든 A/AAAA 레코드 검사 */
async function isPublicHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_NAMES.includes(host)) return false;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return false;
  // IP 리터럴로 직접 온 경우도 같은 규칙
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return false;
    // 하나라도 사설이면 차단 — 라운드로빈으로 내부를 섞어 넣는 우회를 막는다
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}

async function checkUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:') return false;
  if (url.port && url.port !== '443') return false;
  return isPublicHost(url.hostname);
}

export async function GET(req: NextRequest) {
  // 우리 화면에서 온 요청만 — 남이 이 엔드포인트를 이미지 프록시로 쓰지 못하게
  const site = req.headers.get('sec-fetch-site');
  if (site) {
    if (site !== 'same-origin') return fail(403, 'forbidden');
  } else {
    // sec-fetch-site 미지원 브라우저 폴백
    const referer = req.headers.get('referer');
    if (!referer) return fail(403, 'forbidden');
    try {
      if (new URL(referer).host !== req.nextUrl.host) return fail(403, 'forbidden');
    } catch {
      return fail(403, 'forbidden');
    }
  }

  // 붙여넣기는 사람 행위라 낮아도 되지만, 기존 보드 복구는 18슬롯을 한 번에 수입한다 —
  // 그 한 번이 한도에 걸리면 복구가 절반에서 멈춘다. 버킷 분리로 LLM·표시와는 섞이지 않는다
  if (rateLimited(req, 60, 'imgfetch')) return fail(429, 'too many requests');

  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return fail(400, 'url required');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(400, 'invalid url');
  }
  if (!(await checkUrl(url))) return fail(403, 'host not allowed');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  let target = url;
  try {
    for (let hop = 0; ; hop++) {
      res = await fetch(target, {
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'image/*' },
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      if (hop >= MAX_REDIRECTS) {
        clearTimeout(timer);
        return fail(502, 'too many redirects');
      }
      const loc = res.headers.get('location');
      if (!loc) {
        clearTimeout(timer);
        return fail(502, 'upstream error');
      }
      let next: URL;
      try {
        next = new URL(loc, target);
      } catch {
        clearTimeout(timer);
        return fail(502, 'upstream error');
      }
      // 홉마다 같은 검사 — 공개 호스트가 내부 주소로 튕기는 우회를 막는다
      if (!(await checkUrl(next))) {
        clearTimeout(timer);
        return fail(403, 'redirect not allowed');
      }
      target = next;
    }
  } catch {
    clearTimeout(timer);
    return fail(502, 'upstream error');
  }
  clearTimeout(timer);

  // 원본이 없어졌거나 접근 권한이 만료된 경우(예: 만료된 SAS URL) — 호출부가 "만료" 안내로 분기한다
  if (res.status === 403 || res.status === 404 || res.status === 410) return fail(404, 'gone');
  if (!res.ok || !res.body) return fail(502, 'upstream error');

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return fail(415, 'not an image');

  const declaredLen = Number(res.headers.get('content-length') ?? '0');
  if (declaredLen > MAX_BYTES) return fail(413, 'image too large');

  // content-length 없는 응답 방어 — 실제 바이트로 상한
  let sent = 0;
  const capped = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        sent += chunk.byteLength;
        if (sent > MAX_BYTES) {
          ctrl.error(new Error('image too large'));
          return;
        }
        ctrl.enqueue(chunk);
      },
    })
  );

  return new Response(capped, {
    headers: {
      'Content-Type': contentType,
      // 1회성 수입 — 클라가 곧바로 내 저장소로 옮기므로 캐시할 이유가 없다
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
