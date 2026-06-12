'use client';

import { CollageLayout, CollageTemplate } from '@/lib/types';
import { CollageItem } from '@/lib/collageTemplates';
import { WALLPAPER_SIZES, WallpaperTarget, renderBoardLayout } from '@/lib/wallpaper';
import { useWallpaperPreview } from '@/lib/useWallpaperPreview';

interface Props {
  template: CollageTemplate;
  layout: CollageLayout;
  items: CollageItem[];
  year: string;
  target: WallpaperTarget;
}

// 화면 보드를 실제 배경화면(폰/PC) 캔버스로 렌더해 읽기 전용으로 보여준다 (v6.17 미리보기 토글)
export default function WallpaperPreview({ template, layout, items, year, target }: Props) {
  // layout은 부모가 매 렌더 새 객체로 만들 수 있어 직렬화 키로 변경 감지
  const key = `${template}-${target}-${year}-${items.map((i) => i.key).join(',')}-${JSON.stringify(layout)}`;
  const { src, error } = useWallpaperPreview(key, () =>
    renderBoardLayout(template, layout, items, year, target)
  );

  const size = WALLPAPER_SIZES[target];

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center w-full">
        {src ? (
          <img
            src={src}
            alt={target === 'desktop' ? 'PC 배경화면 미리보기' : '폰 배경화면 미리보기'}
            className={
              target === 'desktop'
                ? 'w-full h-auto rounded-2xl border border-[#E5E3DF] shadow-sm'
                : 'h-[52dvh] w-auto rounded-[2rem] border-4 border-[#1C1B19] shadow-md'
            }
          />
        ) : error ? (
          <p className="text-caption text-[#B91C1C] py-12 text-center">{error}</p>
        ) : (
          <div
            className={`rounded-2xl bg-[#F5F5F3] flex items-center justify-center ${
              target === 'desktop' ? 'w-full' : 'h-[52dvh]'
            }`}
            style={{ aspectRatio: `${size.w} / ${size.h}` }}
          >
            <span className="text-caption text-[#6E6962] animate-pulse">만드는 중...</span>
          </div>
        )}
      </div>
      <p className="text-micro text-[#6E6962] text-center mt-2">
        {target === 'desktop'
          ? 'PC 바탕화면(1920×1080)에 올라간 모습이야.'
          : '폰 잠금화면에 올라간 모습이야. 위쪽은 시계 자리로 비워뒀어.'}
      </p>
    </div>
  );
}
