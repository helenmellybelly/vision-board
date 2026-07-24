import { NextRequest, NextResponse } from 'next/server';
import { del, list } from '@vercel/blob';
import { rateLimited, tooManyRequests } from '@/lib/apiGuard';
import { getRegisteredUser } from '@/lib/authServer';
import { getSql } from '@/lib/db';

// 계정 삭제 = users·boards(CASCADE)·Blob 즉시 삭제 (§7 삭제권).
// Blob 삭제가 실패해도 계정 삭제는 진행 — 개인정보 원본(users/boards)이 우선.
export async function DELETE(req: NextRequest) {
  if (rateLimited(req)) return tooManyRequests();
  const user = await getRegisteredUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `boards/${user.id}/`, cursor });
      if (page.blobs.length > 0) await del(page.blobs.map((b) => b.url));
      cursor = page.cursor ?? undefined;
    } while (cursor);
  } catch (e) {
    console.error('blob cleanup failed (account delete continues)', e);
  }
  const sql = getSql();
  await sql`DELETE FROM users WHERE id = ${user.id}`;
  return NextResponse.json({ ok: true });
}
