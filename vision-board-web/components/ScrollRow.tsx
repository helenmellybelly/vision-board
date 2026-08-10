'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 가로 스크롤 행 래퍼 (v7.3) — scroll-hide로 스크롤바를 숨긴 행에서 '더 있음'이 안 보이는 문제 해결.
// 오른쪽 끝에 그라데이션 페이드 + › 버튼을 띄우고, 끝까지 스크롤하면 둘 다 숨긴다.
export default function ScrollRow({
  children,
  className = '',
  fadeColor = '#FFFFFF',
}: {
  children: React.ReactNode;
  className?: string;
  /** 페이드가 녹아들 배경색 (6자리 hex) — 행이 흰 카드가 아닌 곳에 있으면 지정한다 (v8.7) */
  fadeColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // 콘텐츠 교체(카테고리 전환·이미지 로드 실패 필터)로 scrollWidth가 바뀌는 경우까지 — 렌더마다 재측정
  useEffect(update);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  function scrollNext() {
    const el = ref.current;
    if (el) el.scrollBy({ left: el.clientWidth * 0.7, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={`overflow-x-auto scroll-hide ${className}`}>
        {children}
      </div>
      {more && (
        <>
          {/* ⚠️ 끝점을 `to-transparent`로 두면 안 된다 (v8.7) — 그건 '투명한 검정'이라
              흰색→투명 검정 보간이 중간에서 회색 얼룩으로 보인다. 같은 색의 알파 0으로 끝낼 것 */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10"
            style={{ backgroundImage: `linear-gradient(to left, ${fadeColor}, ${fadeColor}00)` }}
          />
          <button
            type="button"
            onClick={scrollNext}
            aria-label="옆으로 더 보기"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-[#E5E3DF] shadow-sm text-[#6B7280] flex items-center justify-center active:opacity-70"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
