'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// v7.0-r5 — /board(섹션별 그리드)는 /collage로 통합 (완성 이미지 감상 화면 단일화).
// 섹션별 상세·사진 관리는 /scenes/[id]가 담당. 딥링크 호환용 스텁 (R6 철거 예정)
export default function BoardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/collage');
  }, [router]);

  return null;
}
