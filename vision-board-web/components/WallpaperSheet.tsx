'use client';

import { useEffect, useState } from 'react';
import useFocusTrap from './useFocusTrap';
import { CollageLayout, CollageTemplate } from '@/lib/types';
import { CollageItem } from '@/lib/collageTemplates';
import {
  WALLPAPER_PRESETS,
  WallpaperTarget,
  presetTarget,
  renderBoardLayout,
  renderForPreset,
  saveCanvas,
} from '@/lib/wallpaper';

interface Props {
  year: string;
  /** 저장 타깃 — 폰/PC 탭에서 편집한 배치를 그대로 내보낸다 (v6.18) */
  target: WallpaperTarget;
  /** 화면 보드 그대로 내보내기용 — 현재 템플릿·배치·사진 */
  board: { template: CollageTemplate; layout: CollageLayout; items: CollageItem[] };
  onClose: () => void;
}

export default function WallpaperSheet({ year, target, board, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  // 기기별 프리셋 (v6.17) — 타깃에 맞는 그룹만 노출
  const [presetId, setPresetId] = useState(target === 'desktop' ? 'pc-fhd' : 'phone');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 폰 탭에서 편집한 세로 배치는 휴대폰·태블릿에만, PC 탭 배치는 PC에만 맞는다
  const presetGroups = (target === 'desktop' ? ['PC'] : ['휴대폰', '태블릿']) as Array<
    '휴대폰' | '태블릿' | 'PC'
  >;
  const visiblePresets = WALLPAPER_PRESETS.filter((p) => presetGroups.includes(p.group));
  const preset = visiblePresets.find((p) => p.id === presetId) ?? visiblePresets[0];
  const effTarget = presetTarget(preset);

  const key = `${board.template}-${preset.id}`;

  // 캐논 캔버스 렌더 → 프리셋 해상도 cover-crop
  function renderCurrent(): Promise<HTMLCanvasElement> {
    return renderForPreset(
      (t: WallpaperTarget) => renderBoardLayout(board.template, board.layout, board.items, year, t),
      preset
    );
  }

  // 미리보기 생성 — 프리셋별 1회만. 편집 보드의 배치·스티커를 그대로 옮긴다(WYSIWYG)
  useEffect(() => {
    if (previews[key]) return;
    let cancelled = false;
    (async () => {
      try {
        const canvas = await renderCurrent();
        if (!cancelled) {
          setPreviews((p) => ({ ...p, [key]: canvas.toDataURL('image/jpeg', 0.82) }));
        }
      } catch {
        if (!cancelled) setError('미리보기를 만들지 못했어. 잠시 후 다시 시도해줘.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const canvas = await renderCurrent();
      await saveCanvas(canvas, `vision-board-${year}-${board.template}-${preset.id}.png`);
    } catch {
      setError('저장에 실패했어. 다시 시도해줘.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallpaper-title"
        className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 max-h-[92dvh] overflow-y-auto scroll-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E3DF] rounded-full mx-auto mb-5" />
        <h2 id="wallpaper-title" className="text-heading font-bold mb-1">
          {target === 'desktop' ? 'PC 배경화면 저장' : '폰 배경화면 저장'}
        </h2>
        <p className="text-caption text-[#6E6962] mb-3">
          {target === 'desktop'
            ? '저장한 이미지를 PC 바탕화면으로 설정해봐.'
            : '저장한 이미지를 휴대폰 배경화면으로 설정해봐.'}
        </p>

        {/* 기기 프리셋 — 기종에 맞는 해상도로 저장 (v6.17) */}
        <label className="block mb-4">
          <span className="text-caption font-semibold text-[#1C1B19]">내 기기에 맞추기</span>
          <select
            value={preset.id}
            onChange={(e) => setPresetId(e.target.value)}
            className="mt-1.5 w-full py-2.5 px-3 rounded-xl border border-[#E5E3DF] bg-white text-body text-[#1C1B19]"
          >
            {presetGroups.map((g) => (
              <optgroup key={g} label={g}>
                {visiblePresets.filter((p) => p.group === g).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.w}×{p.h}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {preset.note && (
            <span className="block mt-1.5 text-micro text-[#6E6962]">{preset.note}</span>
          )}
        </label>

        {/* 미리보기 */}
        <div className="relative flex items-center justify-center">
          {previews[key] ? (
            <img
              src={previews[key]}
              alt="배경화면 미리보기"
              className={
                effTarget === 'desktop'
                  ? 'w-full h-auto rounded-2xl border border-[#E5E3DF]'
                  : 'max-h-[46vh] max-w-full w-auto rounded-2xl border border-[#E5E3DF]'
              }
            />
          ) : (
            <div
              className={`rounded-2xl bg-[#F5F5F3] flex items-center justify-center ${
                effTarget === 'desktop' ? 'w-full' : 'h-[46vh]'
              }`}
              style={{
                aspectRatio: `${preset.w} / ${preset.h}`,
              }}
            >
              <span className="text-caption text-[#6E6962] animate-pulse">만드는 중...</span>
            </div>
          )}
        </div>

        {error && <p className="text-caption text-[#B91C1C] mt-3 text-center">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !previews[key]}
          className="mt-5 w-full py-4 rounded-2xl text-heading font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-80"
          style={{ backgroundColor: '#1C1B19' }}
        >
          {saving ? '저장 중...' : '이미지로 저장'}
        </button>
        <button onClick={onClose} className="mt-2 w-full py-2 text-body text-[#6E6962]">
          닫기
        </button>
      </div>
    </div>
  );
}
