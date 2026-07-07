'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// v7.0-r2 — 순간(/moment) 단계는 /scene 통합 페이지에 흡수됨.
// 딥링크·북마크 호환용 리다이렉트 스텁 (R6에서 철거 예정)
export default function MomentRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/scene/${params.id}`);
  }, [router, params.id]);

  return null;
}
