'use client';

import { useEffect, useRef, useState } from 'react';

// 캔버스 렌더 → dataURL 미리보기 훅.
// key가 바뀔 때만 다시 그린다 — layout 객체 동일성 대신 직렬화 키를 받아 부모 리렌더 루프를 피한다.
export function useWallpaperPreview(
  key: string,
  render: () => Promise<HTMLCanvasElement>
): { src: string; error: string } {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    let cancelled = false;
    setSrc('');
    setError('');
    (async () => {
      try {
        const canvas = await renderRef.current();
        if (!cancelled) setSrc(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        if (!cancelled) setError('미리보기를 만들지 못했어. 잠시 후 다시 시도해줘.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { src, error };
}
