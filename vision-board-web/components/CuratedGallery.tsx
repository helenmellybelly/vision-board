'use client';

import { useState } from 'react';
import { SectionId } from '@/lib/types';
import { CURATED_CATEGORIES, defaultCategoryFor, CuratedPhoto } from '@/lib/curatedImages';
import { pickRemotePhoto, PICK_NOTICES } from '@/lib/imagePick';

interface Props {
  sectionId: SectionId;
  color: string;
  /** 저장 성공 시 부모가 슬롯 상태를 새로고침하도록 */
  onSaved: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

// 카테고리별 선별 샘플 갤러리 (v7.0-r4) — Unsplash 검색 대신 미리 고른 사진에서 탭해서 담는다.
// 매니페스트는 lib/curatedImages.ts (정적 — API 키·런타임 비용 없음, 이미지는 CDN 핫링크)
export default function CuratedGallery({ sectionId, color, onSaved }: Props) {
  const [catId, setCatId] = useState(defaultCategoryFor(sectionId).id);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState('');
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const category = CURATED_CATEGORIES.find((c) => c.id === catId) ?? CURATED_CATEGORIES[0];
  const photos = category.photos.filter((p) => !broken[p.id]);

  async function handlePick(photo: CuratedPhoto) {
    if (saveStates[photo.id] === 'saving' || saveStates[photo.id] === 'saved') return;
    setNotice('');
    setSaveStates((s) => ({ ...s, [photo.id]: 'saving' }));
    const result = await pickRemotePhoto(sectionId, photo);
    if (result === 'saved') {
      setSaveStates((s) => ({ ...s, [photo.id]: 'saved' }));
      onSaved();
    } else {
      setSaveStates((s) => ({ ...s, [photo.id]: 'idle' }));
      setNotice(PICK_NOTICES[result]);
    }
  }

  return (
    <div className="mb-4">
      <div className="mb-2">
        <p className="text-body font-semibold text-[#1C1B19] mb-0.5">샘플에서 고르기</p>
        <p className="text-caption text-[#6E6962]">어울리는 사진을 탭하면 비전보드에 담아둘게.</p>
      </div>

      {/* 카테고리 칩 */}
      <div className="flex gap-1.5 overflow-x-auto scroll-hide pb-2 -mx-1 px-1">
        {CURATED_CATEGORIES.map((cat) => {
          const active = cat.id === category.id;
          return (
            <button
              key={cat.id}
              onClick={() => { setCatId(cat.id); setNotice(''); }}
              className="flex-shrink-0 text-caption px-3 py-1.5 rounded-full border transition-colors"
              style={{
                borderColor: active ? color : '#E5E3DF',
                backgroundColor: active ? color : '#ffffff',
                color: active ? '#ffffff' : '#6B7280',
                fontWeight: active ? 600 : 400,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* 사진 가로 스크롤 */}
      <div className="flex gap-2 overflow-x-auto scroll-hide pb-1 -mx-1 px-1">
        {photos.map((photo) => {
          const state = saveStates[photo.id] ?? 'idle';
          return (
            <button
              key={photo.id}
              onClick={() => handlePick(photo)}
              disabled={state !== 'idle'}
              className="relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-[#E5E3DF] active:opacity-80"
              aria-label={photo.alt ? `${photo.alt} — 비전보드에 담기` : '샘플 사진 담기'}
              title={photo.author ? `Photo by ${photo.author} on Unsplash` : undefined}
            >
              <img
                src={photo.thumb}
                alt={photo.alt}
                loading="lazy"
                className="w-full h-full object-cover"
                onError={() => setBroken((b) => ({ ...b, [photo.id]: true }))}
              />
              {/* 작가 어트리뷰션 — 하단 그라데이션 위 micro 텍스트 */}
              {photo.author && state === 'idle' && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-1 px-1.5 text-left">
                  <span className="text-micro text-white/85 leading-none">{photo.author}</span>
                </span>
              )}
              {state !== 'idle' && (
                <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-caption font-semibold">
                  {state === 'saving' ? '담는 중...' : '✓ 담았어'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {notice && <p className="text-micro text-[#B45309] mt-1">{notice}</p>}
      <p className="text-micro text-[#C4C2BE] mt-1">
        Photos from{' '}
        <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline">
          Unsplash
        </a>
      </p>
    </div>
  );
}
