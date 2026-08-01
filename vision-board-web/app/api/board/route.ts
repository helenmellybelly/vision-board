import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, tooManyRequests } from '@/lib/apiGuard';
import { getRegisteredUser } from '@/lib/authServer';
import { getSql } from '@/lib/db';

export async function GET() {
  const user = await getRegisteredUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`SELECT data, updated_at FROM boards WHERE user_id = ${user.id}`;
  if (!rows[0]) return NextResponse.json({ board: null, updatedAt: null });
  return NextResponse.json({
    board: rows[0].data,
    updatedAt: new Date(rows[0].updated_at as string).getTime(),
  });
}

// 디바운스 업서트 대상 (§5 동기화 — last-write-wins). base64 이미지는 클라가
// 먼저 Blob URL로 변환하므로 정상 페이로드는 수십 KB — 1.5MB 초과는 변환 누락 신호로 거절.
export async function PUT(req: NextRequest) {
  if (rateLimited(req, 30)) return tooManyRequests();
  const user = await getRegisteredUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 1_500_000) {
    return NextResponse.json(
      { error: 'payload too large (convert images to blob first)' },
      { status: 413 }
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const data = (body as { data?: unknown })?.data as
    | { sections?: unknown; schemaVersion?: number }
    | undefined;
  if (!data || typeof data !== 'object' || !data.sections) {
    return NextResponse.json({ error: 'invalid board' }, { status: 400 });
  }
  const sql = getSql();
  const rows = await sql`
    INSERT INTO boards (user_id, data, schema_version, updated_at)
    VALUES (${user.id}, ${JSON.stringify(data)}::jsonb, ${data.schemaVersion ?? 4}, now())
    ON CONFLICT (user_id) DO UPDATE
    SET data = EXCLUDED.data, schema_version = EXCLUDED.schema_version, updated_at = now()
    RETURNING updated_at`;
  // 클라 동기화 스탬프용 — GET과 동일 변환식(epoch ms)이어야 병합 판정 비교가 성립 (v8.6)
  return NextResponse.json({
    ok: true,
    updatedAt: rows[0] ? new Date(rows[0].updated_at as string).getTime() : null,
  });
}
