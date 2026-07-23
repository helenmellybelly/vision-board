import { NextRequest } from 'next/server';
import { rateLimited } from '@/lib/apiGuard';

// 배경화면 캔버스가 CORS 미지원 외부 이미지를 그릴 수 있도록 동일 출처로 우회.
// 허용된 이미지 호스트만 통과 — 비전보드가 실제로 쓰는 출처로 한정한다.
const ALLOWED_HOSTS = ['images.unsplash.com'];

// 대역폭 남용 방지 (v7.4 감사 M1): 응답 크기·연결 시간 상한
const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const FETCH_TIMEOUT_MS = 10_000;

function isAllowed(url: URL): boolean {
  if (ALLOWED_HOSTS.includes(url.hostname)) return true;
  // DALL-E 생성 이미지 (Azure Blob, SAS URL)
  if (url.hostname.endsWith('.blob.core.windows.net')) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (rateLimited(req, 120)) {
    return new Response('too many requests', { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new Response('url required', { status: 400 });

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response('invalid url', { status: 400 });
  }
  if (url.protocol !== 'https:' || !isAllowed(url)) {
    return new Response('host not allowed', { status: 403 });
  }

  // 연결 시간 상한 — stall된 업스트림이 함수 시간을 무한 점유하지 않게
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return new Response('upstream error', { status: 502 });
  }
  clearTimeout(timer);
  if (!res.ok) return new Response('upstream error', { status: 502 });

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return new Response('not an image', { status: 415 });
  }

  // 헤더 크기 상한 — 대용량 파일을 스트리밍 프록시로 남용하는 것 차단
  const declaredLen = Number(res.headers.get('content-length') ?? '0');
  if (declaredLen > MAX_BYTES) {
    return new Response('image too large', { status: 413 });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
