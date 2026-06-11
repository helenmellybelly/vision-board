'use client';

import { SECTION_COLORS } from '@/lib/colors';
import EditableYear from './EditableYear';

interface Props {
  images: string[];
  year: string;
  onYearChange: (year: string) => void;
}

// 미니멀 정렬 — 흰 배경, 상단 타이틀, 균일 정사각 그리드, 하단 섹션 컬러 도트
// minimal 배경화면(lib/wallpaper.ts)과 같은 시각 언어
export default function CollageMinimal({ images, year, onYearChange }: Props) {
  if (images.length === 0) return null;

  return (
    <div className="rounded-3xl px-5 py-7 md:px-8 md:py-9 bg-white border border-[#E5E3DF]">
      <div className="text-center select-none mb-5">
        <p className="text-micro font-semibold tracking-[0.3em] text-[#6E6962] uppercase">Vision Board</p>
        <EditableYear
          year={year}
          onYearChange={onYearChange}
          className="font-display text-display font-bold text-[#1C1B19] tracking-widest"
        />
        <p className="text-micro text-[#9A958E] mt-1">연도를 탭하면 수정할 수 있어</p>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            loading="lazy"
            className="w-full aspect-square object-cover rounded-lg"
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2.5 mt-6">
        {SECTION_COLORS.map((color) => (
          <span key={color} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}
