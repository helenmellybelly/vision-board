import { NextRequest } from 'next/server';
import { rateLimited } from '@/lib/apiGuard';

// 보드 사진의 유일한 원격 배달 경로 (v8.7).
// 표시(DOM <img>)와 배경화면 캔버스가 **같은 이 URL**을 쓴다 — lib/imageSrc.ts displaySrc()가 관문.
// 그래서 (a) 캔버스 taint·CORS가 변수에서 사라지고 (b) 보드가 이미 받아둔 HTTP 캐시 엔트리를
// 내보내기가 그대로 재사용한다. 여기 허용 목록·캐시 헤더를 바꾸면 두 경로가 동시에 영향받는다.
//
// 허용은 좁게 유지한다 — 임의 호스트 수입은 /api/image/fetch가 담당(1회성·no-store·SSRF 방어).
const ALLOWED_HOSTS = ['images.unsplash.com'];

// 대역폭 남용 방지 (v7.4 감사 M1): 응답 크기·연결 시간 상한
const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

function isAllowed(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  if (ALLOWED_HOSTS.includes(url.hostname)) return true;
  // DALL-E 생성 이미지 (Azure Blob, SAS URL)
  if (url.hostname.endsWith('.blob.core.windows.net')) return true;
  // 우리 앱의 사진 저장소 (v8.4) — 로그인 시 lib/sync가 data URL을 Vercel Blob으로 전환한다.
  // app/api/blob/upload/route.ts(put access:'public')와 락스텝: 저장소 호스트가 바뀌면 여기도 함께.
  // 이 호스트가 빠지면 캔버스 내보내기의 CORS 폴백이 403으로 죽어 사진이 조용히 누락된다.
  if (url.hostname.endsWith('.public.blob.vercel-storage.com')) return true;
  return false;
}

// 실패 응답은 절대 캐시하지 않는다 — 아래 성공 응답이 immutable 1년이라,
// 일시적 502가 캐시되면 그 사진이 영구히 안 나온다.
function fail(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  // 버킷 'img' (v8.7) — 보드 1장당 1요청이라 한도가 커야 하고, LLM 라우트 카운터와 섞이면 안 된다
  if (rateLimited(req, 600, 'img')) {
    return fail(429, 'too many requests');
  }

  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return fail(400, 'url required');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(400, 'invalid url');
  }
  if (!isAllowed(url)) return fail(403, 'host not allowed');

  // 연결 시간 상한 — stall된 업스트림이 함수 시간을 무한 점유하지 않게
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  let target = url;
  try {
    // 리다이렉트는 직접 따라간다 — follow로 두면 허용 호스트가 임의 호스트로 302할 때
    // 목적지 검증 없이 따라가 오픈 프록시가 된다 (v8.7 보안 보강)
    for (let hop = 0; ; hop++) {
      res = await fetch(target, { cache: 'no-store', redirect: 'manual', signal: controller.signal });
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
      if (!isAllowed(next)) {
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
  if (!res.ok || !res.body) return fail(502, 'upstream error');

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return fail(415, 'not an image');
  }

  // 헤더 크기 상한 — 대용량 파일을 스트리밍 프록시로 남용하는 것 차단
  const declaredLen = Number(res.headers.get('content-length') ?? '0');
  if (declaredLen > MAX_BYTES) {
    return fail(413, 'image too large');
  }

  // content-length를 안 주는 chunked 응답 방어 — 실제 흘러간 바이트로 상한을 건다
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
      // 소스 URL이 전부 콘텐츠 주소다 — Unsplash photo id · Blob UUID 경로 · SAS 서명.
      // 같은 URL이 다른 바이트를 돌려주지 않으므로 immutable이 안전하고,
      // CDN(s-maxage)이 받아주면 사진 18장 동시 로드가 함수를 때리지 않는다 (v8.7).
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
