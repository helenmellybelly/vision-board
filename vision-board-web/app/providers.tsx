'use client';

import { SessionProvider } from 'next-auth/react';

// layout.tsx는 서버 컴포넌트라 SessionProvider(클라이언트 컨텍스트)를 직접 못 감싼다 — 래퍼로 분리
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
