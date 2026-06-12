'use client';

import { WALLPAPER_PRESETS, WallpaperPreset } from '@/lib/wallpaper';

interface Props {
  groups: Array<'휴대폰' | '태블릿' | 'PC'>;
  selectedId?: string;
  onSelect: (preset: WallpaperPreset) => void;
}

// 비율 모양 미니 스와치 — 글자만으로는 사이즈 차이가 안 보인다
function AspectSwatch({ w, h }: { w: number; h: number }) {
  const aspect = w / h;
  return (
    <span className="w-10 h-10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <span
        className="rounded-[3px] border-2 border-[#9CA3AF] bg-[#F5F5F3]"
        style={
          aspect >= 1
            ? { width: '2.25rem', height: `${2.25 / aspect}rem` }
            : { height: '2.25rem', width: `${2.25 * aspect}rem` }
        }
      />
    </span>
  );
}

// 기기 사이즈 선택 — 편집 진입 전에 비율을 확정한다 (v6.19 사이즈 우선 플로우)
export default function DevicePresetPicker({ groups, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const presets = WALLPAPER_PRESETS.filter((p) => p.group === group);
        if (presets.length === 0) return null;
        return (
          <div key={group}>
            <p className="text-micro font-semibold text-[#6E6962] uppercase tracking-wide mb-1.5">
              {group}
            </p>
            <div className="rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden divide-y divide-[#F3F4F6]" role="radiogroup" aria-label={`${group} 사이즈`}>
              {presets.map((p) => {
                const selected = p.id === selectedId;
                return (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70"
                    style={selected ? { backgroundColor: '#F5F5F3' } : undefined}
                  >
                    <AspectSwatch w={p.w} h={p.h} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-body font-medium text-[#1C1B19]">{p.label}</span>
                      <span className="block text-micro text-[#6E6962]">
                        {p.w}×{p.h}
                        {p.note ? ` · ${p.note}` : ''}
                      </span>
                    </span>
                    {selected && (
                      <span className="text-caption font-semibold text-[#1C1B19]" aria-hidden="true">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
