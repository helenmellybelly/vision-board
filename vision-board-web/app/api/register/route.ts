import { NextRequest, NextResponse } from 'next/server';
import { rateLimited, tooManyRequests } from '@/lib/apiGuard';
import { getIdentity } from '@/lib/authServer';
import { getSql } from '@/lib/db';

// POST = 최초 가입(§5-1 동의 완료 시점에 users 행 생성). 멱등.
// 선택 동의(marketing)는 가입 조건이 될 수 없다 — 값만 기록.
export async function POST(req: NextRequest) {
  if (rateLimited(req)) return tooManyRequests();
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const marketingConsent = (body as { marketingConsent?: unknown })?.marketingConsent === true;
  const sql = getSql();
  await sql`
    INSERT INTO users (google_sub, email, name, marketing_consent, marketing_consent_at)
    VALUES (${identity.googleSub}, ${identity.email}, ${identity.name}, ${marketingConsent},
            ${marketingConsent ? new Date().toISOString() : null})
    ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`;
  return NextResponse.json({ ok: true });
}

// PATCH = 마케팅 동의 변경(철회 포함 — §5-1 언제든 철회, 일시 갱신)
export async function PATCH(req: NextRequest) {
  if (rateLimited(req)) return tooManyRequests();
  const identity = await getIdentity();
  if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const marketingConsent = (body as { marketingConsent?: unknown })?.marketingConsent === true;
  const sql = getSql();
  await sql`
    UPDATE users SET marketing_consent = ${marketingConsent}, marketing_consent_at = now()
    WHERE google_sub = ${identity.googleSub}`;
  return NextResponse.json({ ok: true, marketingConsent });
}
