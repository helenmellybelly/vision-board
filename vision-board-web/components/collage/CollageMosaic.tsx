'use client';

import EditableYear from './EditableYear';

interface Props {
  images: string[];
  year: string;
  onYearChange: (year: string) => void;
}

// 매거진 모자이크 — 크림 배경, 크기가 섞인 결정적 스팬 패턴, 회전 없음
// 인덱스 기반 순환이라 같은 사진 구성이면 항상 같은 배치
const SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
];

export default function CollageMosaic({ images, year, onYearChange }: Props) {
  if (images.length === 0) return null;

  return (
    <div className="rounded-3xl px-4 py-5 md:px-6 md:py-6 border border-[#E5E3DF]" style={{ backgroundColor: '#FAF9F7' }}>
      <div className="grid grid-cols-4 auto-rows-[72px] md:auto-rows-[104px] gap-2 grid-flow-dense">
        {/* 타이틀 셀 — 패턴의 일부로 흐름에 끼워넣음 */}
        <div className="col-span-2 row-span-1 rounded-xl bg-white border border-[#E5E3DF] flex flex-col items-center justify-center select-none">
          <p className="text-micro font-semibold tracking-[0.3em] text-[#6E6962] uppercase">Vision Board</p>
          <EditableYear
            year={year}
            onYearChange={onYearChange}
            className="font-display text-title font-bold text-[#1C1B19]"
          />
        </div>
        {images.map((src, i) => (
          <div key={i} className={`${SPANS[i % SPANS.length]} rounded-xl overflow-hidden`}>
            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      <p className="text-micro text-[#9A958E] text-center mt-3">연도를 탭하면 수정할 수 있어</p>
    </div>
  );
}
