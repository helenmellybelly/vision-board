import { NextResponse } from 'next/server';
import { getIdentity, getRegisteredUser } from '@/lib/authServer';
import { getSql } from '@/lib/db';

// 클라이언트 상태 판별의 단일 소스: authenticated(로그인) / registered(동의 완료 = users 행 존재)
export async function GET() {
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ authenticated: false, registered: false });
  const user = await getRegisteredUser();
  if (!user) {
    return NextResponse.json({
      authenticated: true,
      registered: false,
      email: identity.email,
      name: identity.name,
    });
  }
  const sql = getSql();
  const rows = await sql`SELECT updated_at FROM boards WHERE user_id = ${user.id}`;
  return NextResponse.json({
    authenticated: true,
    registered: true,
    email: user.email,
    name: user.name,
    marketingConsent: user.marketing_consent,
    hasBoard: rows.length > 0,
    boardUpdatedAt: rows[0] ? new Date(rows[0].updated_at as string).getTime() : null,
  });
}
