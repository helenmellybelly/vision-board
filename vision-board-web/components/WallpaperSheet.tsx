'use client';

import { useEffect, useMemo, useState } from 'react';
import useFocusTrap from './useFocusTrap';
import { CollageLayout, CollageTemplate } from '@/lib/types';
import { CollageItem } from '@/lib/collageTemplates';
import {
  WALLPAPER_PRESETS,
  WallpaperSectionGroup,
  WallpaperStyle,
  WallpaperTarget,
  presetTarget,
  renderBoardLayout,
  renderForPreset,
  renderSectionPair,
  saveCanvas,
} from '@/lib/wallpaper';

interface Props {
  groups: WallpaperSectionGroup[];
  year: string;
  /** 저장 타깃 — 버튼 2분할로 진입 시점에 확정 (시트 안 토글 없음) */
  target: WallpaperTarget;
  /** 화면 보드 그대로 내보내기용 — 현재 템플릿·배치·사진 */
  board: { template: CollageTemplate; layout: CollageLayout; items: CollageItem[] };
  onClose: () => void;
}

type Mode = 'all' | 'pairs';

export default function WallpaperSheet({ groups, year, target, board, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [mode, setMode] = useState<Mode>('all');
  const [style, setStyle] = useState<WallpaperStyle>('polaroid');
  const [pairIdx, setPairIdx] = useState(0);
  // 기기별 프리셋 (v6.17) — 진입 버튼(폰/PC)에 따라 기본 프리셋 선택
  const [presetId, setPresetId] = useState(target === 'desktop' ? 'pc-fhd' : 'phone');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preset = WALLPAPER_PRESETS.find((p) => p.id === presetId) ?? WALLPAPER_PRESETS[0];
  // 캐논 렌더 좌표(세로/가로)는 프리셋의 방향을 따른다
  const effTarget = presetTarget(preset);
  const presetGroups = ['휴대폰', '태블릿', 'PC'] as const;

  // 2섹션씩 묶기 — 사진이 하나라도 있는 묶음만 슬라이드로
  const pairs = useMemo(() => {
    const result: WallpaperSectionGroup[][] = [];
    for (let i = 0; i < groups.length; i += 2) {
      const pair = groups.slice(i, i + 2);
      if (pair.some((g) => g.images.length > 0)) result.push(pair);
    }
    return result;
  }, [groups]);

  const key = mode === 'all' ? `all-${board.template}-${presetId}` : `pair-${pairIdx}-${style}-${presetId}`;

  // 캐논 캔버스 렌더 → 프리셋 해상도 cover-crop
  function renderCurrent(): Promise<HTMLCanvasElement> {
    return renderForPreset(
      (t: WallpaperTarget) =>
        mode === 'all'
          ? renderBoardLayout(board.template, board.layout, board.items, year, t)
          : renderSectionPair(pairs[pairIdx], year, style, t),
      preset
    );
  }

  // 미리보기 생성 — 모드/스타일/슬라이드/프리셋별 1회만.
  // '한 장 모아담기'는 화면 보드의 배치·스티커를 그대로 옮긴다(WYSIWYG)
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
      const suffix =
        mode === 'all' ? `-${board.template}` : `-${pairs[pairIdx].map((g) => g.label).join('-')}`;
      const styleSuffix = mode === 'pairs' && style === 'minimal' ? '-minimal' : '';
      await saveCanvas(canvas, `vision-board-${year}${suffix}${styleSuffix}-${preset.id}.png`);
    } catch {
      setError('저장에 실패했어. 다시 시도해줘.');
    } finally {
      setSaving(false);
    }
  }

  const pairLabel = (pair: WallpaperSectionGroup[]) =>
    pair.map((g) => g.label).join(' · ');

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
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="mt-1.5 w-full py-2.5 px-3 rounded-xl border border-[#E5E3DF] bg-white text-body text-[#1C1B19]"
          >
            {presetGroups.map((g) => (
              <optgroup key={g} label={g}>
                {WALLPAPER_PRESETS.filter((p) => p.group === g).map((p) => (
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

        {/* 모드 탭 */}
        <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1">
          <button
            onClick={() => setMode('all')}
            className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
              mode === 'all' ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
            }`}
          >
            한 장 모아담기
          </button>
          <button
            onClick={() => setMode('pairs')}
            disabled={pairs.length === 0}
            className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors disabled:opacity-40 ${
              mode === 'pairs' ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
            }`}
          >
            섹션 묶음 {pairs.length}장
          </button>
        </div>

        {/* 스타일 선택 — 섹션 묶음 전용 (한 장 모아담기는 화면의 템플릿을 그대로 따른다) */}
        {mode === 'pairs' && (
        <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="배경화면 스타일">
          <button
            role="radio"
            aria-checked={style === 'polaroid'}
            onClick={() => setStyle('polaroid')}
            className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
              style === 'polaroid' ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
            }`}
          >
            폴라로이드
          </button>
          <button
            role="radio"
            aria-checked={style === 'minimal'}
            onClick={() => setStyle('minimal')}
            className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
              style === 'minimal' ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
            }`}
          >
            미니멀
          </button>
        </div>
        )}

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

          {mode === 'pairs' && pairs.length > 1 && (
            <>
              {pairIdx > 0 && (
                <button
                  onClick={() => setPairIdx((i) => i - 1)}
                  aria-label="이전 묶음"
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center active:opacity-70"
                >
                  ‹
                </button>
              )}
              {pairIdx < pairs.length - 1 && (
                <button
                  onClick={() => setPairIdx((i) => i + 1)}
                  aria-label="다음 묶음"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center active:opacity-70"
                >
                  ›
                </button>
              )}
            </>
          )}
        </div>

        {/* 섹션 묶음 인디케이터 */}
        {mode === 'pairs' && pairs.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              {pairs.map((pair, i) => (
                <button
                  key={i}
                  onClick={() => setPairIdx(i)}
                  aria-label={pairLabel(pair)}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ backgroundColor: i === pairIdx ? '#1C1B19' : '#E5E3DF' }}
                />
              ))}
            </div>
            <p className="text-micro text-[#6E6962]">{pairLabel(pairs[pairIdx])}</p>
          </div>
        )}

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
