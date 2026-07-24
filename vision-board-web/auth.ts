import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// 어댑터 없는 JWT 세션 — users 테이블은 동의 완료 시점에 /api/register가 직접 생성(기획서 §5-1).
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
