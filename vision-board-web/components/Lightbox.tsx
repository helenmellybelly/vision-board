'use client';

import Image from 'next/image';
import useFocusTrap from '@/components/useFocusTrap';
import { displaySrc } from '@/lib/imageSrc';

interface Props {
  src: string | null;
  onClose: () => void;
  /** square — 정사각 크롭(/scenes 슬롯 프리뷰와 동일), contain — 원본 비율 전체(콜라주: 보드에선 크롭돼 있어 확대는 원본이 가치) */
  fit?: 'square' | 'contain';
}

// 공용 이미지 라이트박스 (v8.2) — /scenes 확대 보기에서 추출, 콜라주 감상 모드와 공유.
// aria 계약('이미지 확대 보기' / '닫기')은 기존 스위트 문자열 그대로 유지.
export default function Lightbox({ src, onClose, fit = 'square' }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(!!src, onClose);
  if (!src) return null;
  // 보드·슬롯이 이미 받아둔 것과 같은 URL로 — 확대에서 다시 받지 않는다 (v8.7)
  const resolved = displaySrc(src);
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="이미지 확대 보기"
        className={
          fit === 'square'
            ? 'relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden'
            : 'relative max-w-full'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {fit === 'square' ? (
          <Image src={resolved} alt="확대된 사진" fill className="object-cover" unoptimized />
        ) : (
          // 원본 비율 그대로 — 크기를 모르는 외부 URL이라 fill 대신 natural 사이즈 + max 제한
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolved} alt="확대된 사진" className="max-w-full max-h-[88dvh] object-contain rounded-2xl" />
        )}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/50 text-white text-heading flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}
