# R2-1 Google 로그인·계정 코어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게스트 우선 원칙을 유지한 채 Google 로그인 + Neon 보드 백업 + 기기 간 이어하기를 도입한다 (회원가입-Google-도입-기획서 §8 첫 슬라이스 중 1·2·4 + 진입점).

**Architecture:** NextAuth v5(beta.32, next 16 지원 확인됨) JWT 세션 + 어댑터 없이 자체 users/boards 테이블(Neon jsonb 1행) 관리. localStorage가 항상 진실 원천이고, 서버는 백업·이어하기용 미러(§5 롤백 원칙). 이미지는 로그인 시점에 base64→Vercel Blob URL로 localStorage 자체를 일괄 변환(기획서 §5 — 동기화 페이로드·quota 동시 해결), 이후 저장 이벤트 디바운스 업서트.

**Tech Stack:** next-auth@5.0.0-beta.32 · @neondatabase/serverless · @vercel/blob · 기존 스택(Next 16.2.6, React 19, Tailwind 4, Playwright verify 스위트)

**스코프 제외 (R2-2로 이월, 별도 플랜):** 첫 사진 직후 소프트 게이트 시트(§2 B), 대시보드 배너 재유도(7일 간격), 배경화면 저장 시트 보조 유도 C 카피.

**이 코드베이스 전제 (작업자 필독):**
- 작업 루트는 `vision-board-web/` (git 루트는 상위 `vision-board/`). 모든 경로는 `vision-board-web/` 기준.
- Next.js 16은 학습 데이터와 다르다(AGENTS.md). middleware는 `proxy.ts`로 개명됐지만 **이 플랜은 proxy/middleware를 쓰지 않는다** — 게스트가 모든 라우트에 접근 가능해야 하므로 보호 라우트가 없다. 인증 검사는 API 라우트 내부에서만.
- 시트 UI 관례: 별도 Modal 라이브러리 없음. `fixed inset-0 bg-black/40 z-50 flex items-end justify-center` 오버레이 + `rounded-t-3xl animate-slideUp` + `role="dialog" aria-modal="true"` + `components/useFocusTrap.ts` 훅. `app/dashboard/page.tsx:308-410`의 pathSheet/photoSheet가 표본.
- 타이포 유틸리티(`text-display`/`text-title`/`text-body`/`text-caption`)만 사용 — `npm run verify`(scripts/check-typography.js)가 정적 검사한다. UI 태스크 후 반드시 실행.
- 검증 관례: 스위트당 하나의 `.claude/verify-*.mjs`(Playwright, dev 서버 localhost:3000 필요, `node .claude/verify-r2a.mjs`로 실행). 이 플랜은 태스크별 마이크로 TDD 대신 **프로젝트 관례(구현 → 전용 verify 스위트 → 회귀 17스위트)**를 따른다. 실 Google OAuth는 헤드리스 불가 → route 모킹으로 UI·연동을 검증하고, 실 OAuth는 배포 후 수동 스모크 1회.
- Windows 함정: `python` 금지(`py -3`), 커밋은 UTF-8 임시파일 + `git commit -F`(세션 고유 파일명, 직후 `git log -1` 검증), Vercel env는 PowerShell 파이프 금지 — 개행 포함 임시 파일 + `cmd /c "npx vercel env add NAME production < file"`.
- dev 서버 재시작 규칙: 빌드 후 검증 전 기존 서버 프로세스 종료 → 새로 기동(청크 불일치로 조용히 깨짐).
- hydration #418 콘솔 에러는 기존 전역 패턴 — 이번 변경 탓으로 오인 금지.

---

## Task 0: 사전 준비 — 외부 리소스 (사용자 액션 포함)

**Files:**
- Modify: `.env.local` (키 5종 추가)

이 태스크만 사용자(helen)의 브라우저 작업이 필요하다. 나머지 태스크는 전부 에이전트가 수행.

- [ ] **Step 1 (사용자): Google OAuth 클라이언트 생성**

Google Cloud Console(console.cloud.google.com) → 새 프로젝트(이름: vision-board) → "API 및 서비스 → OAuth 동의 화면": User Type **External**, 앱 이름 `비전보드`, 지원 이메일 본인 주소, 범위는 기본(openid/email/profile)만, 게시 상태는 "프로덕션"으로 게시(테스트 모드면 100명 제한·7일 만료). → "사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID": 유형 **웹 애플리케이션**, 승인된 리디렉션 URI 2개 등록:

```
http://localhost:3000/api/auth/callback/google
https://vision-board-web.vercel.app/api/auth/callback/google
```

생성된 **클라이언트 ID / 클라이언트 보안 비밀번호**를 확보.

- [ ] **Step 2 (사용자): Neon Postgres + Vercel Blob 생성**

Vercel 대시보드 → `vision-board-web` 프로젝트 → **Storage** 탭 →
1. **Neon Postgres** 생성(Marketplace, 무료 티어) → 프로젝트에 Connect(모든 환경) — 프로덕션 env에 `DATABASE_URL` 자동 주입됨. 로컬용으로 Neon 콘솔("Open in Neon Console") → Connection string(**pooled**) 복사.
2. **Blob** 스토어 생성 → 프로젝트에 Connect — `BLOB_READ_WRITE_TOKEN` 자동 주입. 로컬용 토큰은 스토어 페이지의 `.env.local` 스니펫에서 복사.

⚠️ `vercel env pull`로 값 확인 금지(시크릿 전부 `""` 마스킹) — 콘솔에서 직접 복사한다.

- [ ] **Step 3 (에이전트): AUTH_SECRET 생성 + .env.local 추가**

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

출력값과 사용자가 전달한 값들을 `.env.local` 끝에 추가(기존 키 5종 유지):

```bash
AUTH_SECRET=<위 출력값>
AUTH_GOOGLE_ID=<클라이언트 ID>
AUTH_GOOGLE_SECRET=<클라이언트 보안 비밀>
DATABASE_URL=<Neon pooled connection string>
BLOB_READ_WRITE_TOKEN=<Blob 토큰>
```

- [ ] **Step 4: 확인**

```powershell
node -e "const fs=require('fs');const e=fs.readFileSync('.env.local','utf8');['AUTH_SECRET','AUTH_GOOGLE_ID','AUTH_GOOGLE_SECRET','DATABASE_URL','BLOB_READ_WRITE_TOKEN'].forEach(k=>console.log(k, e.includes(k+'=')&&!new RegExp('^'+k+'=\\s*$','m').test(e)?'OK':'MISSING'))"
```

Expected: 5줄 모두 `OK`. (.env.local은 커밋 대상 아님 — .gitignore 확인만)

---

## Task 1: 패키지 설치

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: 설치**

```powershell
npm install next-auth@5.0.0-beta.32 @neondatabase/serverless @vercel/blob
```

Expected: 에러 없이 완료. peer 충돌 없음(next-auth beta.32는 next ^16.0.0 지원 — 2026-07-24 npm 확인).

- [ ] **Step 2: 빌드로 기존 상태 무손상 확인**

```powershell
npm run build
```

Expected: 기존과 동일하게 성공.

- [ ] **Step 3: 커밋**

커밋 메시지를 UTF-8 임시파일(`commit-msg-r2a-t1.txt`)로 작성 후:

```powershell
git add package.json package-lock.json; git commit -F commit-msg-r2a-t1.txt; git log -1 --format=%s
```

메시지: `chore: R2-1 의존성 추가 — next-auth v5 beta(next16 지원)·neon·blob`

---

## Task 2: Neon 스키마 생성 (멱등 스크립트)

**Files:**
- Create: `.claude/db-init-r2.mjs`

- [ ] **Step 1: 스크립트 작성**

```js
// node .claude/db-init-r2.mjs — Neon 스키마 1회 생성 (멱등, 기획서 §5 모델)
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error('DATABASE_URL not in .env.local'); process.exit(1); }
const sql = neon(m[1].trim());

await sql`CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text UNIQUE NOT NULL,
  email text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  marketing_consent boolean NOT NULL DEFAULT false,
  marketing_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
await sql`CREATE TABLE IF NOT EXISTS boards (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  schema_version int NOT NULL DEFAULT 4,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','boards') ORDER BY table_name`;
console.log('schema OK:', t.map((r) => r.table_name).join(', '));
```

- [ ] **Step 2: 실행**

```powershell
node .claude/db-init-r2.mjs
```

Expected: `schema OK: boards, users`

- [ ] **Step 3: 커밋** — `feat: R2-1 Neon 스키마 초기화 스크립트(users/boards jsonb 1행)` (임시파일 `commit-msg-r2a-t2.txt`, 이하 태스크 번호만 바꿔 동일 방식)

---

## Task 3: NextAuth 코어 — auth.ts · 라우트 · SessionProvider

**Files:**
- Create: `auth.ts` (vision-board-web 루트)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx:36-39` (children을 Providers로 감싼다)

- [ ] **Step 1: auth.ts**

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// 어댑터 없는 JWT 세션 — users 테이블은 동의 완료 시점에 /api/register가 직접 생성(§5-1).
// googleSub(계정 식별자)를 토큰→세션으로 전달해 서버 API가 users.google_sub 조회에 쓴다.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  trustHost: true,
  callbacks: {
    jwt({ token, account }) {
      if (account) token.googleSub = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      (session as { googleSub?: string }).googleSub =
        typeof token.googleSub === 'string' ? token.googleSub : undefined;
      return session;
    },
  },
});
```

- [ ] **Step 2: app/api/auth/[...nextauth]/route.ts**

```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: app/providers.tsx**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';

// layout.tsx는 서버 컴포넌트라 SessionProvider(클라이언트 컨텍스트)를 직접 못 감싼다 — 래퍼로 분리
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 4: layout.tsx 수정** — import 추가 후 body 내부만 교체:

```tsx
import Providers from './providers';
```

```tsx
      <body className="min-h-full flex flex-col bg-[#FAF9F7] text-[#1C1B19]">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
```

- [ ] **Step 5: 동작 확인**

```powershell
npm run build
```

Expected: 성공. 이어서 기존 dev 서버 종료 후 `npm run dev` 재기동, 다음으로 확인:

```powershell
curl.exe -s http://localhost:3000/api/auth/providers
```

Expected: `{"google":{...}}` JSON (google provider 노출). `/api/auth/session`은 `null` 또는 `{}`.

- [ ] **Step 6: 커밋** — `feat: R2-1 NextAuth v5 코어 — Google provider·JWT 세션·SessionProvider 래퍼`

---

## Task 4: 서버 헬퍼 — lib/db.ts · lib/authServer.ts

**Files:**
- Create: `lib/db.ts`
- Create: `lib/authServer.ts`

- [ ] **Step 1: lib/db.ts**

```ts
import { neon } from '@neondatabase/serverless';

// 빌드 타임 평가를 피하려고 lazy — env는 런타임(API 라우트)에만 필요하다
let _sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}
```

- [ ] **Step 2: lib/authServer.ts**

```ts
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
```

- [ ] **Step 3: 빌드 확인** — `npm run build` Expected: 성공.

- [ ] **Step 4: 커밋** — `feat: R2-1 서버 헬퍼 — lazy neon 클라이언트·세션/가입 유저 조회`

---

## Task 5: 계정 API — /api/me · /api/register

**Files:**
- Create: `app/api/me/route.ts`
- Create: `app/api/register/route.ts`

- [ ] **Step 1: app/api/me/route.ts**

```ts
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
```

- [ ] **Step 2: app/api/register/route.ts**

```ts
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
```

- [ ] **Step 3: 확인** — dev 서버에서(비로그인이므로 익명/401 경로만 즉시 검증 가능):

```powershell
curl.exe -s http://localhost:3000/api/me
curl.exe -s -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d "{}"
```

Expected: 첫 줄 `{"authenticated":false,"registered":false}`, 둘째 줄 `{"error":"unauthorized"}` (HTTP 401).

- [ ] **Step 4: 커밋** — `feat: R2-1 계정 API — /api/me 상태 판별·/api/register 동의 가입/철회`

---

## Task 6: 병합 판정 로직 — lib/merge.ts

**Files:**
- Create: `lib/merge.ts`

§5 규칙: 한쪽이 빈 보드면 다른 쪽 채택, 둘 다 내용 있으면 최신 쪽 제안 + 사용자 선택(자동 덮어쓰기 금지). 순수 함수로 분리 — verify 스위트가 UI 경유로 3분기 모두 검증한다(Task 12).

- [ ] **Step 1: lib/merge.ts**

```ts
import { BoardData } from './types';

export type MergeDecision =
  | { action: 'useLocal' }
  | { action: 'useServer' }
  | { action: 'ask'; newer: 'local' | 'server' };

/** "내용 있는 보드" — 어떤 섹션이든 대화/이야기/사진이 하나라도 있으면 true (§5 빈 보드 판정) */
export function isBoardMeaningful(b: BoardData | null | undefined): boolean {
  if (!b || !b.sections) return false;
  if (b.futureDayStory || b.oneSentence) return true;
  return Object.values(b.sections).some(
    (s) =>
      (s.chatMessages?.length ?? 0) > 0 ||
      !!s.sceneText ||
      !!s.miniStory ||
      (s.uploadedImages ?? []).some(Boolean) ||
      (s.generatedImages ?? []).some(Boolean) ||
      (s.images ?? []).some(Boolean)
  );
}

/** 로컬 최신성은 lastVisitAt(기획서 §5 — 로컬은 lastVisitAt), 서버는 boards.updated_at */
export function decideMerge(
  local: BoardData,
  server: BoardData | null,
  serverUpdatedAt: number | null
): MergeDecision {
  const serverMeaningful = isBoardMeaningful(server);
  const localMeaningful = isBoardMeaningful(local);
  if (!serverMeaningful) return { action: 'useLocal' };
  if (!localMeaningful) return { action: 'useServer' };
  const localAt = local.lastVisitAt ?? local.startedAt ?? 0;
  return { action: 'ask', newer: (serverUpdatedAt ?? 0) > localAt ? 'server' : 'local' };
}
```

⚠️ 구현 전 `lib/types.ts:58-86`(SectionData)을 열어 `images`/`generatedImages` 원소 타입이 string인지 확인하고, 객체라면 `.some(Boolean)`은 유지하되 필드 접근을 맞출 것.

- [ ] **Step 2: 빌드 확인** — `npm run build` Expected: 성공.

- [ ] **Step 3: 커밋** — `feat: R2-1 병합 판정 순수 로직 — 빈 보드 판정·ask 분기(자동 덮어쓰기 금지)`

---

## Task 7: 보드·Blob·계정삭제 API

**Files:**
- Create: `app/api/board/route.ts`
- Create: `app/api/blob/upload/route.ts`
- Create: `app/api/account/route.ts`

- [ ] **Step 1: app/api/board/route.ts**

```ts
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
    return NextResponse.json({ error: 'payload too large (convert images to blob first)' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const data = (body as { data?: unknown })?.data as { sections?: unknown; schemaVersion?: number } | undefined;
  if (!data || typeof data !== 'object' || !data.sections) {
    return NextResponse.json({ error: 'invalid board' }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO boards (user_id, data, schema_version, updated_at)
    VALUES (${user.id}, ${JSON.stringify(data)}::jsonb, ${data.schemaVersion ?? 4}, now())
    ON CONFLICT (user_id) DO UPDATE
    SET data = EXCLUDED.data, schema_version = EXCLUDED.schema_version, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: app/api/blob/upload/route.ts**

```ts
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
  const m = typeof dataUrl === 'string' ? /^data:image\/(jpeg|png);base64,(.+)$/.exec(dataUrl) : null;
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
```

- [ ] **Step 3: app/api/account/route.ts**

```ts
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
```

- [ ] **Step 4: 확인** — 빌드 + 익명 401:

```powershell
npm run build
curl.exe -s http://localhost:3000/api/board
curl.exe -s -X DELETE http://localhost:3000/api/account
```

Expected: 빌드 성공, 두 curl 모두 `{"error":"unauthorized"}`.

- [ ] **Step 5: 커밋** — `feat: R2-1 보드 업서트·Blob 업로드·계정 삭제 API(전부 가입 유저 전용)`

---

## Task 8: 동기화 클라이언트 — storage 이벤트 + lib/sync.ts

**Files:**
- Modify: `lib/storage.ts:159-171` (trySaveBoard 성공 경로에 이벤트 1줄)
- Create: `lib/sync.ts`

- [ ] **Step 1: trySaveBoard에 저장 이벤트 추가**

`lib/storage.ts:159` 부근 `trySaveBoard`를 열어, `localStorage.setItem(...)`이 성공한 직후·`return true` 직전에 아래 1줄을 삽입한다(함수 본문 다른 로직 무변경):

```ts
    window.dispatchEvent(new Event('vb:board-saved')); // 로그인 시 디바운스 서버 동기화 트리거 (R2-1)
```

trySaveBoard가 SSR 가드 없이 localStorage를 직접 만지는 클라이언트 전용 함수임을 확인하고(호출부가 전부 'use client'), 만약 가드가 없다면 `typeof window !== 'undefined'` 조건은 **추가하지 말 것**(기존 동작 유지 — quota 처리 흐름만 관찰 후 삽입 위치 결정).

- [ ] **Step 2: lib/sync.ts**

```ts
import { loadBoard, trySaveBoard } from './storage';

// base64 이미지 → Blob URL 치환. localStorage 자체를 바꾼다(§5 가입 시점 일괄 변환).
// 부분 실패는 그대로 두고 다음 동기화에서 재시도 — localStorage가 진실 원천이라 유실 없음.
export async function convertDataUrlsToBlob(): Promise<void> {
  const board = loadBoard();
  let changed = false;
  for (const section of Object.values(board.sections)) {
    for (const key of ['uploadedImages', 'generatedImages'] as const) {
      const arr = section[key];
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v !== 'string' || !v.startsWith('data:image/')) continue;
        try {
          const res = await fetch('/api/blob/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl: v }),
          });
          if (!res.ok) continue;
          const { url } = (await res.json()) as { url: string };
          arr[i] = url;
          changed = true;
        } catch {
          // 오프라인 등 — 다음 기회에
        }
      }
    }
  }
  if (changed) trySaveBoard(board);
}

/** 이미지 변환 → 보드 업서트. 실패해도 조용히 넘어간다(§5 롤백 — 서버는 미러일 뿐). */
export async function syncBoardNow(): Promise<boolean> {
  try {
    await convertDataUrlsToBlob();
    const board = loadBoard();
    const res = await fetch('/api/board', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: board }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

⚠️ convertDataUrlsToBlob 안의 trySaveBoard가 Step 1 이벤트를 쏘고, 그 이벤트가 다시 syncBoardNow를 부르는 순환은 AccountFlow의 디바운스가 흡수한다(추가 sync 1회로 수렴 — 무한 루프 아님). 그래도 Task 9에서 syncBoardNow 진행 중 재진입을 막는 가드를 둔다.

- [ ] **Step 3: 빌드 확인** — `npm run build` Expected: 성공.

- [ ] **Step 4: 커밋** — `feat: R2-1 동기화 클라이언트 — 저장 이벤트·base64→Blob 변환·업서트`

---

## Task 9: 동의·병합 UI + AccountFlow 오케스트레이터

**Files:**
- Create: `components/ConsentSheet.tsx`
- Create: `components/MergeSheet.tsx`
- Create: `components/AccountFlow.tsx`
- Modify: `app/providers.tsx` (AccountFlow 장착)

- [ ] **Step 1: components/ConsentSheet.tsx**

```tsx
'use client';

import { useState } from 'react';
import useFocusTrap from './useFocusTrap';

// 가입 폼 동의 (§5-1) — 필수(개인정보) + 선택(마케팅) 분리.
// 선택 미체크로 가입을 막을 수 없다(정보통신망법 분리 동의 원칙) — 버튼 활성 조건은 필수만.
export default function ConsentSheet({
  email,
  onAccept,
  onDecline,
}: {
  email: string;
  onAccept: (marketingConsent: boolean) => void;
  onDecline: () => void;
}) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onDecline);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="가입 동의"
    >
      <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
        <h2 className="text-title font-bold mb-1">거의 다 됐어!</h2>
        <p className="text-body text-[#6B7280] mb-4">{email}(으)로 시작할게. 아래만 확인해줘.</p>
        <label className="flex items-start gap-2 mb-3">
          <input
            type="checkbox"
            checked={privacyOk}
            onChange={(e) => setPrivacyOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body">
            [필수] 개인정보 수집·이용 동의 — Google 계정의 이메일·이름만 수집해.{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
              자세히 보기
            </a>
          </span>
        </label>
        <label className="flex items-start gap-2 mb-5">
          <input
            type="checkbox"
            checked={marketingOk}
            onChange={(e) => setMarketingOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body">
            [선택] 마인드/자기발견/자기성장/코칭 관련 정보를 받아보는 것에 동의합니다.
          </span>
        </label>
        <button
          disabled={!privacyOk || busy}
          onClick={() => {
            setBusy(true);
            onAccept(marketingOk);
          }}
          className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold disabled:opacity-40"
        >
          시작하기
        </button>
        <button onClick={onDecline} className="w-full py-3 text-body text-[#6B7280]">
          다음에 할게 (게스트로 계속)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: components/MergeSheet.tsx**

```tsx
'use client';

import useFocusTrap from './useFocusTrap';

function fmt(ts: number | null | undefined): string {
  if (!ts) return '기록 없음';
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// 병합 선택 (§5) — 자동 덮어쓰기 금지. 닫으면 아무 것도 덮지 않고 이번 세션 동기화 보류.
export default function MergeSheet({
  newer,
  localAt,
  serverAt,
  onChoose,
  onDismiss,
}: {
  newer: 'local' | 'server';
  localAt: number | null;
  serverAt: number | null;
  onChoose: (choice: 'local' | 'server') => void;
  onDismiss: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onDismiss);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="보드 선택"
    >
      <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
        <h2 className="text-title font-bold mb-1">보드가 두 개 있어</h2>
        <p className="text-body text-[#6B7280] mb-5">
          이 기기의 보드와 저장해둔 보드가 달라. 어느 쪽을 쓸까? 선택한 쪽이 남고, 다른 쪽은
          덮어써져.
        </p>
        <button
          onClick={() => onChoose('local')}
          className={`w-full text-left rounded-2xl border p-4 mb-3 ${
            newer === 'local' ? 'border-[#1C1B19]' : 'border-[#E5E1DA]'
          }`}
        >
          <span className="text-body font-bold block">
            이 기기의 보드 쓰기{newer === 'local' ? ' · 더 최신이야' : ''}
          </span>
          <span className="text-caption text-[#6B7280]">마지막 작업 {fmt(localAt)}</span>
        </button>
        <button
          onClick={() => onChoose('server')}
          className={`w-full text-left rounded-2xl border p-4 mb-3 ${
            newer === 'server' ? 'border-[#1C1B19]' : 'border-[#E5E1DA]'
          }`}
        >
          <span className="text-body font-bold block">
            저장된 보드 가져오기{newer === 'server' ? ' · 더 최신이야' : ''}
          </span>
          <span className="text-caption text-[#6B7280]">마지막 저장 {fmt(serverAt)}</span>
        </button>
        <button onClick={onDismiss} className="w-full py-3 text-body text-[#6B7280]">
          나중에 정할게
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: components/AccountFlow.tsx**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { track } from '@vercel/analytics';
import { loadBoard, saveBoard } from '@/lib/storage';
import { decideMerge } from '@/lib/merge';
import { syncBoardNow } from '@/lib/sync';
import { BoardData } from '@/lib/types';
import ConsentSheet from './ConsentSheet';
import MergeSheet from './MergeSheet';

type Me = {
  authenticated: boolean;
  registered: boolean;
  email?: string;
  name?: string;
  marketingConsent?: boolean;
  hasBoard?: boolean;
  boardUpdatedAt?: number | null;
};

// 로그인 후 전역 오케스트레이션: 미등록→동의 시트(§5-1), 등록→병합 검사(§5), 이후 디바운스 동기화.
// 어느 화면에서 로그인하든 동작해야 하므로 Providers(레이아웃)에 상주한다.
export default function AccountFlow() {
  const { status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [mergeState, setMergeState] = useState<{
    server: BoardData;
    serverAt: number | null;
    newer: 'local' | 'server';
  } | null>(null);
  const syncEnabled = useRef(false);
  const syncing = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/me');
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as Me;
      setMe(data);
      if (!data.registered) {
        setShowConsent(true);
        return;
      }
      await afterRegistered();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function afterRegistered() {
    // 병합 검사는 브라우저 세션당 1회 — 리로드마다 시트가 반복되지 않게
    if (!sessionStorage.getItem('vb-merge-checked')) {
      sessionStorage.setItem('vb-merge-checked', '1');
      const res = await fetch('/api/board');
      if (res.ok) {
        const { board: server, updatedAt } = (await res.json()) as {
          board: BoardData | null;
          updatedAt: number | null;
        };
        const decision = decideMerge(loadBoard(), server, updatedAt);
        if (decision.action === 'useServer' && server) {
          saveBoard(server); // 리로드 후 loadBoard의 migrateBoard가 스키마를 맞춘다
          window.location.reload();
          return;
        }
        if (decision.action === 'ask' && server) {
          setMergeState({
            server,
            serverAt: updatedAt,
            newer: decision.newer,
          });
          return; // 선택 전 자동 업서트 금지 (§5)
        }
      }
    }
    enableSync();
  }

  function enableSync() {
    if (syncEnabled.current) return;
    syncEnabled.current = true;
    void runSync();
  }

  async function runSync() {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await syncBoardNow();
    } finally {
      syncing.current = false;
    }
  }

  // saveBoard가 쏘는 이벤트를 디바운스 구독 (변환 중 재저장 이벤트도 여기로 수렴)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onSaved() {
      if (!syncEnabled.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void runSync(), 2500);
    }
    window.addEventListener('vb:board-saved', onSaved);
    return () => {
      window.removeEventListener('vb:board-saved', onSaved);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConsent(marketingConsent: boolean) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketingConsent }),
    });
    if (!res.ok) return;
    track('signup_consent_done', { marketing: marketingConsent });
    setShowConsent(false);
    await afterRegistered();
  }

  function handleDeclineConsent() {
    setShowConsent(false);
    void signOut({ redirect: false }); // 게스트로 계속 — localStorage 무손상 (§1 관문 아님)
  }

  function handleMergeChoice(choice: 'local' | 'server') {
    if (!mergeState) return;
    track('login_merge_choice', { choice });
    if (choice === 'server') {
      saveBoard(mergeState.server);
      setMergeState(null);
      window.location.reload();
      return;
    }
    setMergeState(null);
    enableSync(); // 로컬 채택 → 다음 업서트가 서버를 덮는다
  }

  return (
    <>
      {showConsent && (
        <ConsentSheet
          email={me?.email ?? ''}
          onAccept={handleConsent}
          onDecline={handleDeclineConsent}
        />
      )}
      {mergeState && (
        <MergeSheet
          newer={mergeState.newer}
          localAt={loadBoard().lastVisitAt ?? null}
          serverAt={mergeState.serverAt}
          onChoose={handleMergeChoice}
          onDismiss={() => setMergeState(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: providers.tsx에 장착**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import AccountFlow from '@/components/AccountFlow';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <AccountFlow />
    </SessionProvider>
  );
}
```

- [ ] **Step 5: 빌드 + 타이포 검사** — `npm run build` 성공, `npm run verify` PASS.

- [ ] **Step 6: 커밋** — `feat: R2-1 동의·병합 시트 + AccountFlow 오케스트레이터(디바운스 동기화)`

---

## Task 10: 온보딩 종료 선택 화면 (§2-1)

**Files:**
- Create: `app/onboarding/choice/page.tsx`
- Modify: `app/onboarding/[step]/page.tsx:50-53` (handleFinish 목적지 변경)

- [ ] **Step 1: app/onboarding/choice/page.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { loadBoard } from '@/lib/storage';

// 온보딩 종료 선택 화면 (§2-1 A′) — Google/게스트 2버튼 대등 제시. 하드 게이트 아님.
// 게스트 유의 카피는 기술 어휘 금지 — 기획서 문구 그대로.
export default function OnboardingChoicePage() {
  const router = useRouter();
  const { status } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (!board.onboardingDone) {
      router.replace('/');
      return;
    }
    if (status === 'authenticated') {
      router.replace('/dashboard'); // 이미 로그인 상태면 선택 불필요
      return;
    }
    if (status !== 'loading') setReady(true);
  }, [router, status]);

  if (!ready) return null;

  return (
    <main className="min-h-screen flex flex-col justify-center max-w-md mx-auto w-full px-6 pb-10">
      <img src="/tori-profile-bust.png" alt="토리" className="w-14 h-14 rounded-full mb-4" />
      <h1 className="text-display font-bold mb-2">준비 끝! 어떻게 시작할까?</h1>
      <p className="text-body text-[#6B7280] mb-8">
        Google로 시작하면 보드가 안전하게 보관되고, 다른 기기에서도 이어서 만들 수 있어.
      </p>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold mb-3"
      >
        Google로 시작하기
      </button>
      <button
        onClick={() => router.replace('/dashboard')}
        className="w-full py-3.5 rounded-2xl border border-[#E5E1DA] font-bold mb-6"
      >
        게스트로 시작하기
      </button>
      <p className="text-caption text-[#9CA3AF]">
        지금은 이 기기 브라우저에만 저장돼. 기기를 바꾸거나 브라우저 데이터를 지우면 사라질 수
        있어. 언제든 Google로 로그인하면 안전하게 보관돼 — 게스트로 시작해도 나중에 로그인하면
        지금 보드를 그대로 이어가.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: handleFinish 수정** — `app/onboarding/[step]/page.tsx:50-53`:

```ts
  function handleFinish() {
    markOnboardingDone();
    router.replace('/onboarding/choice'); // 대시보드 진입 전 Google/게스트 선택 (§2-1, R2-1)
  }
```

(onboardingDone을 먼저 마킹 — choice에서 이탈해도 대시보드 가드에 걸리지 않는다.)

- [ ] **Step 3: 수동 확인** — dev 서버에서 localStorage 초기화 후 온보딩 3스텝 완료 → choice 화면 렌더 → "게스트로 시작하기" → /dashboard 진입. (자동화는 Task 13 스위트가 커버)

- [ ] **Step 4: 커밋** — `feat: R2-1 온보딩 종료 선택 화면 — Google/게스트 대등 2버튼·유의 카피(§2-1)`

---

## Task 11: 대시보드 계정 버튼 + 계정 시트 (§4 1차)

**Files:**
- Create: `components/AccountButton.tsx`
- Modify: `app/dashboard/page.tsx:156-157` (헤더 우측에 버튼 추가)

- [ ] **Step 1: components/AccountButton.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { UserRound } from 'lucide-react';
import useFocusTrap from './useFocusTrap';
import { resetBoard } from '@/lib/storage';

type Me = { registered: boolean; email?: string; marketingConsent?: boolean };

// 대시보드 헤더의 계정 진입점 — 마이페이지 1차는 별도 페이지 대신 시트 (§4)
export default function AccountButton() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wipeLocal, setWipeLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    if (!open || status !== 'authenticated') return;
    void fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d as Me));
  }, [open, status]);

  async function toggleMarketing() {
    if (!me) return;
    const next = !me.marketingConsent;
    const res = await fetch('/api/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketingConsent: next }),
    });
    if (res.ok) setMe({ ...me, marketingConsent: next });
  }

  async function handleDelete() {
    setBusy(true);
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) {
      if (wipeLocal) resetBoard();
      await signOut({ redirect: false });
      window.location.href = '/';
      return;
    }
    setBusy(false);
  }

  const loggedIn = status === 'authenticated';

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setConfirmDelete(false);
        }}
        aria-label="계정"
        className="p-1.5 rounded-full text-[#6B7280] hover:bg-black/5"
      >
        <UserRound size={18} />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="계정 시트"
        >
          <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
            {!loggedIn ? (
              <>
                <h2 className="text-title font-bold mb-1">보드, 잃어버리지 않게 해줄게</h2>
                <p className="text-body text-[#6B7280] mb-5">
                  지금은 이 기기 브라우저에만 저장돼. Google로 로그인하면 안전하게 보관되고, 다른
                  기기에서도 이어서 만들 수 있어.
                </p>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold mb-2"
                >
                  Google로 로그인
                </button>
                <button onClick={() => setOpen(false)} className="w-full py-3 text-body text-[#6B7280]">
                  닫기
                </button>
              </>
            ) : !confirmDelete ? (
              <>
                <h2 className="text-title font-bold mb-1">내 계정</h2>
                <p className="text-body text-[#6B7280] mb-4">{me?.email ?? ''}</p>
                <label className="flex items-center justify-between mb-5">
                  <span className="text-body">마인드·자기성장 소식 받기 (선택)</span>
                  <input
                    type="checkbox"
                    checked={me?.marketingConsent ?? false}
                    onChange={toggleMarketing}
                  />
                </label>
                <button
                  onClick={() => void signOut({ redirect: false }).then(() => setOpen(false))}
                  className="w-full py-3.5 rounded-2xl border border-[#E5E1DA] font-bold mb-2"
                >
                  로그아웃
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-3 text-body text-[#B91C1C]"
                >
                  계정 삭제
                </button>
                <button onClick={() => setOpen(false)} className="w-full py-3 text-body text-[#6B7280]">
                  닫기
                </button>
              </>
            ) : (
              <>
                <h2 className="text-title font-bold mb-1">정말 삭제할까?</h2>
                <p className="text-body text-[#6B7280] mb-4">
                  서버에 저장된 보드와 계정 정보가 바로 삭제돼. 되돌릴 수 없어.
                </p>
                <label className="flex items-start gap-2 mb-5">
                  <input
                    type="checkbox"
                    checked={wipeLocal}
                    onChange={(e) => setWipeLocal(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-body">이 기기의 보드도 함께 지우기</span>
                </label>
                <button
                  disabled={busy}
                  onClick={handleDelete}
                  className="w-full py-3.5 rounded-2xl bg-[#B91C1C] text-white font-bold mb-2 disabled:opacity-40"
                >
                  삭제하기
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="w-full py-3 text-body text-[#6B7280]"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

⚠️ lucide-react 1.17에 `UserRound`가 없으면 `User`로 교체(임포트만). 이모지 사용 금지 — v75r1 스위트가 대시보드 이모지 카운트를 직접 단언한다.

- [ ] **Step 2: 대시보드 헤더에 장착** — `app/dashboard/page.tsx:156-157`의 `<ProcessGuide />`를 다음으로 교체:

```tsx
            <div className="flex items-center gap-1">
              <AccountButton />
              <ProcessGuide />
            </div>
```

import 추가: `import AccountButton from '@/components/AccountButton';`

- [ ] **Step 3: 빌드 + 타이포 검사** — `npm run build` 성공, `npm run verify` PASS. ⚠️ 대시보드 높이 예산 ≤1.2뷰포트(v71r3) — 버튼은 기존 헤더 행 안이라 높이 불변 확인.

- [ ] **Step 4: 커밋** — `feat: R2-1 대시보드 계정 버튼·계정 시트 — 로그인/로그아웃/마케팅 동의 토글/계정 삭제(§4 1차)`

---

## Task 12: 개인정보처리방침 페이지 (§7)

**Files:**
- Create: `app/privacy/page.tsx`

- [ ] **Step 1: app/privacy/page.tsx** (서버 컴포넌트, 정적)

```tsx
export const metadata = { title: '개인정보처리방침 — 비전보드' };

// §7 — 가입 도입 시점 필수. 수집 최소화·삭제권·분석 본문 미포함 원칙을 그대로 문서화.
export default function PrivacyPage() {
  return (
    <main className="max-w-md md:max-w-xl mx-auto w-full px-6 py-10">
      <h1 className="text-display font-bold mb-6">개인정보처리방침</h1>
      <div className="space-y-5 text-body text-[#374151]">
        <section>
          <h2 className="text-title font-bold mb-1">수집하는 정보</h2>
          <p>
            Google 로그인 시 Google 계정 식별자·이메일·이름만 수집합니다. 그 외 정보는 수집하지
            않습니다. 로그인하지 않으면 어떤 개인정보도 서버에 저장되지 않습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">보드 데이터</h2>
          <p>
            작성한 보드(답변·이야기·사진)는 기본적으로 이 기기 브라우저에만 저장됩니다. Google로
            로그인한 경우에만 보관·기기 간 이어하기를 위해 서버에 저장됩니다. 보드 내용은 분석
            도구로 전송하지 않습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">마케팅 정보 수신 (선택)</h2>
          <p>
            선택 동의 시 마인드/자기발견/자기성장/코칭 관련 정보를 보내드릴 수 있습니다. 동의하지
            않아도 모든 기능을 쓸 수 있고, 계정 시트에서 언제든 철회할 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">보관과 삭제</h2>
          <p>
            계정 정보와 서버의 보드는 계정 삭제 시 즉시 삭제됩니다. 계정 삭제는 대시보드의 계정
            시트에서 직접 할 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">문의</h2>
          <p>helen.easytask@gmail.com</p>
        </section>
        <p className="text-caption text-[#9CA3AF]">시행일: 2026-07-24</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 확인** — `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/privacy` Expected: `200`.

- [ ] **Step 3: 커밋** — `feat: R2-1 개인정보처리방침 페이지(§7 — 수집 최소화·삭제권·시행일)`

---

## Task 13: 검증 — 전용 스위트 + 회귀

**Files:**
- Create: `.claude/verify-r2a.mjs`

- [ ] **Step 1: verify-r2a.mjs 작성** — 기존 verify-v78r1.mjs의 헬퍼 스타일(chromium, BASE, seed, PASS/FAIL 카운트)을 따르되, 인증은 route 모킹으로 주입한다. 골격:

```js
// node .claude/verify-r2a.mjs — R2-1 Google 로그인 코어 검증 (실 OAuth는 모킹, dev 서버 필요)
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}

const SESSION = {
  user: { name: '헬렌', email: 'helen@test.dev' },
  googleSub: 'sub-123',
  expires: '2099-01-01T00:00:00.000Z',
};

// 의미 있는 보드 시드 — schemaVersion 4, 섹션 1에 대화 1개
function meaningfulBoard(extra = {}) {
  const sections = {};
  for (let i = 1; i <= 6; i++) {
    sections[i] = { status: 'not_started', currentPhase: 1, images: [] };
  }
  sections[1] = {
    ...sections[1],
    status: 'in_progress',
    chatMessages: [{ role: 'user', content: '테스트 답변' }],
  };
  return {
    sections,
    onboardingDone: true,
    userName: '헬렌',
    startedAt: Date.now() - 86400000,
    lastVisitAt: Date.now() - 3600000,
    schemaVersion: 4,
    dashboardIntroSeen: true,
    ...extra,
  };
}

function emptyBoard() {
  const b = meaningfulBoard();
  b.sections[1] = { status: 'not_started', currentPhase: 1, images: [] };
  return b;
}

async function newPage(browser, { board, session, me, serverBoard, captures }) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (board) {
    await page.addInitScript((b) => {
      localStorage.setItem('vision-board-data', JSON.stringify(b));
    }, board);
  }
  await page.route('**/api/auth/session', (r) =>
    r.fulfill({ json: session ?? null })
  );
  if (me) await page.route('**/api/me', (r) => r.fulfill({ json: me }));
  if (serverBoard !== undefined) {
    await page.route('**/api/board', (r) => {
      if (r.request().method() === 'PUT') {
        captures?.push({ url: '/api/board PUT', body: r.request().postData() });
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({ json: serverBoard });
    });
  }
  await page.route('**/api/register', (r) => {
    captures?.push({ url: `/api/register ${r.request().method()}`, body: r.request().postData() });
    return r.fulfill({ json: { ok: true } });
  });
  return { ctx, page };
}

const browser = await chromium.launch();

// [1] choice: 온보딩 미완료면 / 로 가드
{
  const { ctx, page } = await newPage(browser, { session: null });
  await page.goto(`${BASE}/onboarding/choice`);
  await page.waitForURL('**/');
  check('choice 온보딩 미완료 가드', true);
  await ctx.close();
}

// [2] choice: 2버튼 + 유의 카피
{
  const { ctx, page } = await newPage(browser, { board: meaningfulBoard(), session: null });
  await page.goto(`${BASE}/onboarding/choice`);
  check('choice Google 버튼', await page.getByText('Google로 시작하기').isVisible());
  check('choice 게스트 버튼', await page.getByText('게스트로 시작하기').isVisible());
  check('choice 유의 카피', await page.getByText('이 기기 브라우저에만 저장돼').isVisible());
  // [3] 게스트로 시작 → 대시보드
  await page.getByText('게스트로 시작하기').click();
  await page.waitForURL('**/dashboard');
  check('게스트 시작 → 대시보드', true);
  await ctx.close();
}

// [4] 비로그인 대시보드: 계정 버튼 → 로그인 시트
{
  const { ctx, page } = await newPage(browser, { board: meaningfulBoard(), session: null });
  await page.goto(`${BASE}/dashboard`);
  await page.getByLabel('계정').click();
  check('비로그인 계정 시트: Google 로그인', await page.getByText('Google로 로그인').isVisible());
  await ctx.close();
}

// [5] 로그인+미등록 → 동의 시트: 필수 체크 전 disabled, 선택 미체크로도 진행 가능
{
  const captures = [];
  const { ctx, page } = await newPage(browser, {
    board: meaningfulBoard(),
    session: SESSION,
    me: { authenticated: true, registered: false, email: 'helen@test.dev' },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  const start = page.getByRole('button', { name: '시작하기' });
  await start.waitFor();
  check('동의: 필수 미체크 시 비활성', await start.isDisabled());
  await page.getByText('[필수]').locator('xpath=..').locator('input').check();
  check('동의: 필수 체크 후 활성', await start.isEnabled());
  await start.click();
  await page.waitForTimeout(500);
  const reg = captures.find((c) => c.url === '/api/register POST');
  check('동의: 선택 미체크로 가입 POST(marketing=false)', !!reg && JSON.parse(reg.body).marketingConsent === false);
  await ctx.close();
}

// [6] 등록 유저 + 서버 보드 없음 → 자동 업서트 PUT 발생
{
  const captures = [];
  const { ctx, page } = await newPage(browser, {
    board: meaningfulBoard(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
    serverBoard: { board: null, updatedAt: null },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  check('서버 빈 보드 → 로컬 자동 업서트', captures.some((c) => c.url === '/api/board PUT'));
  await ctx.close();
}

// [7] 둘 다 의미 보드 → 병합 시트 → 서버 선택 시 localStorage 교체
{
  const serverData = meaningfulBoard({ userName: '서버헬렌' });
  const { ctx, page } = await newPage(browser, {
    board: meaningfulBoard(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: true, boardUpdatedAt: Date.now() },
    serverBoard: { board: serverData, updatedAt: Date.now() },
  });
  await page.goto(`${BASE}/dashboard`);
  check('병합 시트 렌더', await page.getByText('보드가 두 개 있어').isVisible());
  await page.getByText('저장된 보드 가져오기').click();
  await page.waitForTimeout(800);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  check('서버 보드 채택 → localStorage 교체', stored.userName === '서버헬렌');
  await ctx.close();
}

// [8] 로컬 빈 보드 + 서버 의미 보드 → 자동 채택(시트 없이)
{
  const serverData = meaningfulBoard({ userName: '서버헬렌' });
  const { ctx, page } = await newPage(browser, {
    board: emptyBoard(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: true, boardUpdatedAt: Date.now() },
    serverBoard: { board: serverData, updatedAt: Date.now() },
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')));
  check('로컬 빈 보드 → 서버 자동 채택', stored.userName === '서버헬렌');
  await ctx.close();
}

// [9] 등록 유저 계정 시트: 이메일·로그아웃·계정 삭제·마케팅 토글 PATCH
{
  const captures = [];
  const { ctx, page } = await newPage(browser, {
    board: meaningfulBoard(),
    session: SESSION,
    me: { authenticated: true, registered: true, email: 'helen@test.dev', marketingConsent: false, hasBoard: false, boardUpdatedAt: null },
    serverBoard: { board: null, updatedAt: null },
    captures,
  });
  await page.goto(`${BASE}/dashboard`);
  await page.getByLabel('계정').click();
  check('계정 시트: 이메일', await page.getByText('helen@test.dev').isVisible());
  check('계정 시트: 로그아웃', await page.getByText('로그아웃').isVisible());
  check('계정 시트: 계정 삭제', await page.getByText('계정 삭제').isVisible());
  await page.getByText('소식 받기').locator('xpath=..').locator('input').check();
  await page.waitForTimeout(400);
  check('마케팅 토글 PATCH', captures.some((c) => c.url === '/api/register PATCH'));
  await ctx.close();
}

// [10] /privacy 200 + 핵심 텍스트
{
  const { ctx, page } = await newPage(browser, { session: null });
  const res = await page.goto(`${BASE}/privacy`);
  check('/privacy 200', res.status() === 200);
  check('/privacy 본문', await page.getByText('수집하는 정보').isVisible());
  await ctx.close();
}

await browser.close();
console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail ? 1 : 0);
```

작성 시 기존 verify-v78r1.mjs를 열어 seed 보드 형태(SectionData 필수 필드)를 그대로 재사용할 것 — 위 `meaningfulBoard()`의 섹션 골격이 실제 타입과 다르면 스위트 쪽을 맞춘다. 병합 검사 sessionStorage 1회 가드 때문에 각 케이스는 새 context를 쓴다(위 구조가 이미 그렇게 되어 있음).

- [ ] **Step 2: 실행 — 전용 스위트**

```powershell
node .claude/verify-r2a.mjs
```

Expected: `N/N PASS` (0 FAIL). 실패 시: 이번에 변경하지 않은 기준선(기존 페이지·이전 커밋)에서 같은 조건 재현으로 기존 이슈인지 먼저 분리(전역 규칙).

- [ ] **Step 3: 회귀 17스위트**

```powershell
Get-ChildItem .claude/verify-v7*.mjs | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: $($_.Name)" } }
```

Expected: 전 스위트 PASS. 주의 지점 — 대시보드 헤더 변경(v7 계열 헤더 단언), 온보딩 finish 목적지 변경(v7r1~ 온보딩 스위트가 `/dashboard` 도착을 단언하면 choice 경유로 깨질 수 있음 → **스위트가 깨지면 UX 변경에 맞춰 구 스위트를 갱신하는 것까지가 완료 정의**(프로젝트 규칙, v7.4 교훈). 갱신 내역은 커밋 메시지에 명기).

- [ ] **Step 4: 커밋** — `test: R2-1 전용 verify 스위트(모킹 10케이스) + 회귀 갱신`

---

## Task 14: 배포 + 프로덕션 스모크

**Files:** 없음 (환경·배포 작업)

- [ ] **Step 1: Vercel env 등록** — Neon·Blob은 Task 0에서 Connect로 자동 주입됨. 수동 등록은 3종: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. 각각 **개행 포함 임시 파일**로:

```powershell
# 예: AUTH_SECRET (나머지 2종 동일 패턴, 파일명만 교체)
Set-Content -Path env-auth-secret.txt -Value "<값>" -Encoding utf8
cmd /c "npx vercel env add AUTH_SECRET production < env-auth-secret.txt"
Remove-Item env-auth-secret.txt
```

⚠️ PowerShell 파이프로 넘기면 빈 값이 등록된다(전역 규칙). 등록 검증은 pull이 아니라 배포 후 실호출로.

- [ ] **Step 2: 배포**

```powershell
npx vercel --prod
```

⚠️ 이 명령은 세션 권한 분류기에 차단될 수 있음 — 차단 시 사용자에게 재요청. GitHub 자동 배포 없음(CLI 필수).

- [ ] **Step 3: 프로덕션 스모크(자동)** — 기존 9경로 200 + 신규 3:

```powershell
@('/', '/dashboard', '/onboarding/1', '/onboarding/choice', '/privacy', '/api/auth/providers', '/api/me') | ForEach-Object {
  $c = (Invoke-WebRequest -Uri "https://vision-board-web.vercel.app$_" -UseBasicParsing -MaximumRedirection 5).StatusCode
  Write-Host "$c $_"
}
```

Expected: 전부 200. `/api/auth/providers` 응답에 `google` 포함, `/api/me`는 `{"authenticated":false,...}`.

- [ ] **Step 4: 실 OAuth 수동 스모크(사용자 1회)** — 프로덕션에서 실제 Google 로그인 → 동의 시트(필수/선택) → 가입 → 대시보드 복귀 → 사진 1장 담기 → Neon 콘솔에서 `SELECT email, marketing_consent FROM users;` / `SELECT updated_at FROM boards;`로 행 생성·업서트 확인(§9 쿼리). 이어서 같은 계정으로 시크릿 창 로그인 → 서버 보드 자동 채택(기기 간 이어하기) 확인.

- [ ] **Step 5: 마무리 커밋·푸시** — 잔여 변경 커밋 후 `git push`, `git log -1` 검증. 이후 /wrap은 별도로.

---

## Self-Review 결과 (작성 시점)

- **스펙 커버리지**: §8-1(인증·스키마·업서트·Blob) = Task 1~8, §8-2(선택 화면) = Task 10, §8-4(동의·병합·계정 시트·방침) = Task 5·9·11·12. §8-3(소프트 게이트·배너·C 유도)은 R2-2로 명시 이월. §5 병합 규칙 3분기 전부 Task 6+13 커버. §5-1 분리 동의(선택 미체크 가입 가능) Task 9+13[5] 커버.
- **자동 덮어쓰기 금지(§5)**: ask 분기에서 선택 전 sync 비활성 + MergeSheet 닫기 = 보류(어느 쪽도 덮지 않음) — AccountFlow 설계에 반영.
- **타입 일관성**: getSql/getIdentity/getRegisteredUser/decideMerge/syncBoardNow 시그니처가 태스크 간 동일 사용. Me 타입은 AccountFlow/AccountButton에 로컬 정의(공유 필요 시 구현 중 lib로 승격 가능 — 선택).
- **알려진 확인 포인트**(구현 중 실물과 대조): ① SectionData 원소 타입(Task 6 주의), ② trySaveBoard 본문 삽입 위치(Task 8 주의), ③ lucide `UserRound` 존재(Task 11 주의), ④ 온보딩 회귀 스위트의 finish 목적지 단언(Task 13 주의).
