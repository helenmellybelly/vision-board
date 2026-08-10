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
      {/* lg+는 줄바꿈 (v8.7) — 칩이 템플릿 탭 아래 전폭으로 올라오면서, 가로 스크롤로 잘려
          보이던 문제를 없앤다. scrollWidth === clientWidth가 되어 ScrollRow의 › 어포던스도
          저절로 사라진다. 좁은 화면은 스크롤 행 유지 — 7칩을 wrap하면 3행이 되어 보드를 깎는다 */}
      <ScrollRow
        fadeColor="#FAF9F7"
        className="flex gap-1.5 pb-1 -mx-1 px-1 lg:flex-wrap lg:overflow-x-visible lg:mx-0 lg:px-0"
      >
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
              {/* 해상도는 선택된 칩에만 — 별도 캡션 행을 없애 보드에 세로 공간을 양보 (v8.2).
                  aria-hidden — radio 접근성 이름('iPhone' 등 exact 매칭 계약)을 오염시키지 않는다 */}
              {selected && (
                <span aria-hidden="true" className="text-micro font-normal text-white/70">
                  {p.w}×{p.h}
                </span>
              )}
            </button>
          );
        })}
      </ScrollRow>
    </div>
  );
}
