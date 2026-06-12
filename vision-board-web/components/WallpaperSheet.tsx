'use client';

import { useEffect, useState } from 'react';
import useFocusTrap from './useFocusTrap';
import { CollageLayout, CollageTemplate } from '@/lib/types';
import { CollageItem } from '@/lib/collageTemplates';
import { WallpaperPreset, renderBoardLayout, saveCanvas } from '@/lib/wallpaper';

interface Props {
  year: string;
  /** 편집 진입 전에 선택한 기기 사이즈 — 이 해상도 그대로 내보낸다(무크롭 WYSIWYG, v6.19) */
  preset: WallpaperPreset;
  /** 화면 보드 그대로 내보내기용 — 현재 템플릿·배치·사진 */
  board: { template: CollageTemplate; layout: CollageLayout; items: CollageItem[] };
  onClose: () => void;
}

export default function WallpaperSheet({ year, preset, board, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const landscape = preset.w > preset.h;

  function renderCurrent(): Promise<HTMLCanvasElement> {
    return renderBoardLayout(board.template, board.layout, board.items, year, {
      w: preset.w,
      h: preset.h,
    });
  }

  // 미리보기 생성 — 편집 보드의 배치·스티커를 선택한 해상도 그대로 옮긴다(WYSIWYG)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await renderCurrent();
        if (!cancelled) setPreview(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        if (!cancelled) setError('미리보기를 만들지 못했어. 잠시 후 다시 시도해줘.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {landscape ? 'PC 배경화면 저장' : '폰 배경화면 저장'}
        </h2>
        <p className="text-caption text-[#6E6962] mb-3">
          {preset.label} · {preset.w}×{preset.h} — 편집한 그대로 저장돼.
        </p>

        {/* 미리보기 */}
        <div className="relative flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="배경화면 미리보기"
              className={
                landscape
                  ? 'w-full h-auto rounded-2xl border border-[#E5E3DF]'
                  : 'max-h-[46vh] max-w-full w-auto rounded-2xl border border-[#E5E3DF]'
              }
            />
          ) : (
            <div
              className={`rounded-2xl bg-[#F5F5F3] flex items-center justify-center ${
                landscape ? 'w-full' : 'h-[46vh]'
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
          disabled={saving || !preview}
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
