import { NextRequest } from 'next/server';

// 배경화면 캔버스가 CORS 미지원 외부 이미지를 그릴 수 있도록 동일 출처로 우회.
// 허용된 이미지 호스트만 통과 — 비전보드가 실제로 쓰는 출처로 한정한다.
const ALLOWED_HOSTS = ['images.unsplash.com'];

function isAllowed(url: URL): boolean {
  if (ALLOWED_HOSTS.includes(url.hostname)) return true;
  // DALL-E 생성 이미지 (Azure Blob, SAS URL)
  if (url.hostname.endsWith('.blob.core.windows.net')) return true;
  return false;
}

export async function GET(req: NextRequest) {
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

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return new Response('upstream error', { status: 502 });

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return new Response('not an image', { status: 415 });
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
