'use client';

import { useEffect, useMemo, useState } from 'react';
import useFocusTrap from './useFocusTrap';
import {
  WallpaperSectionGroup,
  WallpaperStyle,
  renderAllInOne,
  renderSectionPair,
  saveCanvas,
} from '@/lib/wallpaper';

interface Props {
  groups: WallpaperSectionGroup[];
  year: string;
  onClose: () => void;
}

type Mode = 'all' | 'pairs';

export default function WallpaperSheet({ groups, year, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [mode, setMode] = useState<Mode>('all');
  const [style, setStyle] = useState<WallpaperStyle>('polaroid');
  const [pairIdx, setPairIdx] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 2섹션씩 묶기 — 사진이 하나라도 있는 묶음만 슬라이드로
  const pairs = useMemo(() => {
    const result: WallpaperSectionGroup[][] = [];
    for (let i = 0; i < groups.length; i += 2) {
      const pair = groups.slice(i, i + 2);
      if (pair.some((g) => g.images.length > 0)) result.push(pair);
    }
    return result;
  }, [groups]);

  const key = mode === 'all' ? `all-${style}` : `pair-${pairIdx}-${style}`;

  // 미리보기 생성 — 모드/스타일/슬라이드별 1회만
  useEffect(() => {
    if (previews[key]) return;
    let cancelled = false;
    (async () => {
      try {
        const canvas =
          mode === 'all'
            ? await renderAllInOne(groups, year, style)
            : await renderSectionPair(pairs[pairIdx], year, style);
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
      const canvas =
        mode === 'all'
          ? await renderAllInOne(groups, year, style)
          : await renderSectionPair(pairs[pairIdx], year, style);
      const suffix =
        mode === 'all' ? '' : `-${pairs[pairIdx].map((g) => g.label).join('-')}`;
      const styleSuffix = style === 'minimal' ? '-minimal' : '';
      await saveCanvas(canvas, `vision-board-${year}${suffix}${styleSuffix}.png`);
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
          배경화면으로 저장
        </h2>
        <p className="text-caption text-[#6E6962] mb-4">
          저장한 이미지를 휴대폰 배경화면으로 설정해봐.
        </p>

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

        {/* 스타일 선택 — 디자인 2종 */}
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

        {/* 미리보기 */}
        <div className="relative flex items-center justify-center">
          {previews[key] ? (
            <img
              src={previews[key]}
              alt="배경화면 미리보기"
              className="h-[46vh] w-auto rounded-2xl border border-[#E5E3DF]"
            />
          ) : (
            <div
              className="h-[46vh] rounded-2xl bg-[#F5F5F3] flex items-center justify-center"
              style={{ aspectRatio: '1170 / 2532' }}
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
