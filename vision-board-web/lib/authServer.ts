import { auth } from '@/auth';
import { getSql } from '@/lib/db';

export interface SessionIdentity {
  googleSub: string;
  email: string;
  name: string;
}

export interface DbUser {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  marketing_consent: boolean;
}

/** 로그인만 된 상태(가입 전일 수 있음). 없으면 null. */
export async function getIdentity(): Promise<SessionIdentity | null> {
  const session = await auth();
  const googleSub = (session as { googleSub?: string } | null)?.googleSub;
  if (!session?.user || !googleSub) return null;
  return { googleSub, email: session.user.email ?? '', name: session.user.name ?? '' };
}

/** 동의까지 마쳐 users 행이 있는 가입 유저. 없으면 null. */
export async function getRegisteredUser(): Promise<DbUser | null> {
  const identity = await getIdentity();
  if (!identity) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, google_sub, email, name, marketing_consent
    FROM users WHERE google_sub = ${identity.googleSub}`;
  return (rows[0] as unknown as DbUser | undefined) ?? null;
}
