'use client';

import { ReactNode } from 'react';
import useFocusTrap from '../useFocusTrap';

interface Props {
  /** <h2>의 id — aria-labelledby가 가리킨다 */
  titleId: string;
  heading: string;
  desc?: string;
  /** 보드를 얼마나 가릴지. 'tall'(88dvh)은 입력 중심 시트, 'mid'(62dvh)는 보드를 보며 조절하는 시트 */
  height?: 'tall' | 'mid';
  children: ReactNode;
  onClose: () => void;
}

/**
 * 콜라주 바텀 시트의 공용 껍데기 — 백드롭·포커스 트랩·손잡이·제목.
 *
 * StickerSheet에서 추출했다 (v11). ⚠️ DOM 구조와 클래스를 바꾸지 말 것 —
 * 기존 스티커 E2E가 이 마크업에 걸려 있다. 새 시트(TitleSheet)는 내용만 다르게 넣는다.
 */
export default function BottomSheet({ titleId, heading, desc, height = 'tall', children, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // ⚠️ Tailwind JIT 스캔을 위해 완성된 클래스 리터럴을 삼항으로 고를 것(문자열 조립 금지)
        className={
          height === 'mid'
            ? 'bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 max-h-[62dvh] overflow-y-auto scroll-soft'
            : 'bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 max-h-[88dvh] overflow-y-auto scroll-soft'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E3DF] rounded-full mx-auto mb-5" />
        <h2 id={titleId} className="text-heading font-bold mb-1">
          {heading}
        </h2>
        {desc && <p className="text-caption text-[#6E6962] mb-4">{desc}</p>}
        {children}
      </div>
    </div>
  );
}
