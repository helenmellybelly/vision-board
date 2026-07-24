import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { rateLimited, tooManyRequests } from '@/lib/apiGuard';
import { getRegisteredUser } from '@/lib/authServer';

// base64 data URL 1장 → Blob 업로드 → 공개 URL 반환 (가입 시점 일괄 변환 + 증분, §5)
// 업로드 이미지는 compressImage(0.60/800) 산출물이라 보통 100~200KB — 700KB 상한은 여유치.
export async function POST(req: NextRequest) {
  if (rateLimited(req, 40)) return tooManyRequests();
  const user = await getRegisteredUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const dataUrl = (body as { dataUrl?: unknown })?.dataUrl;
  const m =
    typeof dataUrl === 'string' ? /^data:image\/(jpeg|png);base64,(.+)$/.exec(dataUrl) : null;
  if (!m) return NextResponse.json({ error: 'invalid dataUrl' }, { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 700_000) return NextResponse.json({ error: 'image too large' }, { status: 413 });
  const ext = m[1] === 'png' ? 'png' : 'jpg';
  const blob = await put(`boards/${user.id}/${crypto.randomUUID()}.${ext}`, buf, {
    access: 'public',
    contentType: `image/${m[1]}`,
  });
  return NextResponse.json({ url: blob.url });
}
