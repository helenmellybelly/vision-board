'use client';

import { WALLPAPER_PRESETS, WallpaperPreset } from '@/lib/wallpaper';
import ScrollRow from '@/components/ScrollRow';

interface Props {
  groups: Array<'휴대폰' | '태블릿' | 'PC'>;
  selectedId?: string;
  onSelect: (preset: WallpaperPreset) => void;
}

// 비율 모양 미니 스와치 — 글자만으로는 사이즈 차이가 안 보인다
function AspectSwatch({ w, h }: { w: number; h: number }) {
  const aspect = w / h;
  return (
    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <span
        className="rounded-[2px] border border-current opacity-70"
        style={
          aspect >= 1
            ? { width: '1.1rem', height: `${1.1 / aspect}rem` }
            : { height: '1.1rem', width: `${1.1 * aspect}rem` }
        }
      />
    </span>
  );
}

// 기기 사이즈 선택 (v7.3) — 패널·리스트 대신 상단 상시 노출 칩 행, 탭 즉시 적용
export default function DevicePresetPicker({ groups, selectedId, onSelect }: Props) {
  const presets = WALLPAPER_PRESETS.filter((p) => groups.includes(p.group));
  return (
    <div role="radiogroup" aria-label="기기 사이즈">
      <ScrollRow className="flex gap-1.5 pb-1 -mx-1 px-1">
        {presets.map((p) => {
          const selected = p.id === selectedId;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(p)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-caption px-3 py-1.5 rounded-full border transition-colors ${
                selected
                  ? 'bg-[#1C1B19] border-[#1C1B19] text-white font-semibold'
                  : 'bg-white border-[#E5E3DF] text-[#6B7280]'
              }`}
            >
              <AspectSwatch w={p.w} h={p.h} />
              {p.shortLabel ?? p.label}
            </button>
          );
        })}
      </ScrollRow>
    </div>
  );
}
