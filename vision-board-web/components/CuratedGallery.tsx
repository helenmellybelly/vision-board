'use client';

import { useState } from 'react';
import { SectionId } from '@/lib/types';
import { CURATED_CATEGORIES, defaultCategoryFor, CuratedPhoto } from '@/lib/curatedImages';
import { pickRemotePhoto, unpickRemotePhoto, PICK_NOTICES } from '@/lib/imagePick';

interface Props {
  sectionId: SectionId;
  color: string;
  /** 현재 슬롯에 담겨 있는 원격 사진 id들 — picked 표시의 진실 원천 (v7.1-r2) */
  pickedIds: string[];
  /** 담기/해제 성공 시 부모가 슬롯·pickedIds를 새로고침하도록 */
  onChanged: () => void;
}

// 카테고리별 선별 샘플 갤러리 (v7.0-r4) — Unsplash 검색 대신 미리 고른 사진에서 탭해서 담는다.
// 매니페스트는 lib/curatedImages.ts (정적 — API 키·런타임 비용 없음, 이미지는 CDN 핫링크)
// v7.1-r2: 담긴 사진 재탭 = 해제. picked는 보드(uploadedImageSources) 파생 — 로컬 saved 상태 제거
export default function CuratedGallery({ sectionId, color, pickedIds, onChanged }: Props) {
  const [catId, setCatId] = useState(defaultCategoryFor(sectionId).id);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  const category = CURATED_CATEGORIES.find((c) => c.id === catId) ?? CURATED_CATEGORIES[0];
  const photos = category.photos.filter((p) => !broken[p.id]);

  async function handlePick(photo: CuratedPhoto) {
    if (savingId) return;
    setNotice('');
    if (pickedIds.includes(photo.id)) {
      unpickRemotePhoto(sectionId, photo.id);
      onChanged();
      return;
    }
    setSavingId(photo.id);
    const result = await pickRemotePhoto(sectionId, photo);
    setSavingId(null);
    if (result === 'saved') {
      onChanged();
    } else {
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
          const picked = pickedIds.includes(photo.id);
          const saving = savingId === photo.id;
          return (
            <button
              key={photo.id}
              onClick={() => handlePick(photo)}
              disabled={saving}
              className="relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-[#E5E3DF] active:opacity-80"
              aria-label={
                picked
                  ? `${photo.alt || '샘플 사진'} — 보드에서 빼기`
                  : photo.alt ? `${photo.alt} — 비전보드에 담기` : '샘플 사진 담기'
              }
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
              {photo.author && !picked && !saving && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pt-4 pb-1 px-1.5 text-left">
                  <span className="text-micro text-white/85 leading-none">{photo.author}</span>
                </span>
              )}
              {(picked || saving) && (
                <span className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center text-white text-caption font-semibold">
                  {saving ? '담는 중...' : (
                    <>
                      ✓ 담았어
                      <span className="text-micro font-normal text-white/80 mt-0.5">탭해서 빼기</span>
                    </>
                  )}
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
