'use client';

import { useEffect, useState } from 'react';
import { SectionId } from '@/lib/types';
import { loadBoard, saveUploadedImage } from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';

interface Photo {
  id: string;
  thumb: string;
  regular: string;
  alt: string;
  userName: string;
  userLink: string;
  downloadLocation: string;
}

interface Props {
  sectionId: SectionId;
  query: string;
  /** 저장 성공 시 부모가 보드 상태를 새로고침하도록 */
  onSaved: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

// Scene 1 첫 답변 직후 토리가 제안하는 추천 이미지 (Unsplash, v6.17).
// API 키 미설정·결과 0건이면 아무것도 렌더하지 않는다(조용한 실패).
export default function ImageSuggestions({ sectionId, query, onSaved }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.photos)) setPhotos(data.photos.slice(0, 5));
      } catch {
        // 조용한 실패
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (photos.length === 0) return null;

  // 비어 있는 첫 슬롯 — 생성 이미지가 깔린 슬롯은 피하고, 다 차 있으면 업로드만 빈 슬롯
  function findSlot(): number | null {
    const sec = loadBoard().sections[sectionId];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    for (let i = 0; i < 3; i++) if (!uploaded[i] && !generated[i]) return i;
    for (let i = 0; i < 3; i++) if (!uploaded[i]) return i;
    return null;
  }

  async function handlePick(photo: Photo) {
    if (saveStates[photo.id] === 'saving' || saveStates[photo.id] === 'saved') return;
    setNotice('');
    const slot = findSlot();
    if (slot === null) {
      setNotice('이 영역엔 이미 사진 3장이 가득해. 보드에서 한 장 비우면 담을 수 있어.');
      return;
    }
    setSaveStates((s) => ({ ...s, [photo.id]: 'saving' }));
    try {
      const res = await fetch(`/api/image/proxy?url=${encodeURIComponent(photo.regular)}`);
      if (!res.ok) throw new Error('proxy failed');
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });
      // 업로드(0.60/800)보다 강한 압축 — localStorage 용량 보호
      const compressed = await compressImage(dataUrl, 0.55, 640);
      const ok = saveUploadedImage(sectionId, slot, compressed);
      if (!ok) {
        setSaveStates((s) => ({ ...s, [photo.id]: 'idle' }));
        setNotice('저장 공간이 가득 찼어. 보드에서 사진을 몇 장 지우고 다시 담아줘.');
        return;
      }
      setSaveStates((s) => ({ ...s, [photo.id]: 'saved' }));
      onSaved();
      // Unsplash 다운로드 핑 — 실패해도 무시
      if (photo.downloadLocation) {
        fetch(`/api/unsplash?download=${encodeURIComponent(photo.downloadLocation)}`).catch(() => {});
      }
    } catch {
      setSaveStates((s) => ({ ...s, [photo.id]: 'idle' }));
      setNotice('이미지를 가져오지 못했어. 잠시 후 다시 시도해줘.');
    }
  }

  return (
    <div className="mb-3 animate-fadeIn">
      <div className="bg-white border border-[#E5E3DF] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%]">
        <p className="text-body text-[#1C1B19] leading-relaxed mb-2.5">
          이런 이미지들도 있어 🌰
          <br />
          마음에 들면 탭해봐. 내 비전보드에 담아둘게.
        </p>
        <div className="flex gap-2 overflow-x-auto scroll-hide pb-1 -mx-1 px-1">
          {photos.map((photo) => {
            const state = saveStates[photo.id] ?? 'idle';
            return (
              <button
                key={photo.id}
                onClick={() => handlePick(photo)}
                disabled={state !== 'idle'}
                className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-[#E5E3DF] active:opacity-80"
                aria-label={photo.alt || '추천 이미지 담기'}
              >
                <img src={photo.thumb} alt={photo.alt} loading="lazy" className="w-full h-full object-cover" />
                {state !== 'idle' && (
                  <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-caption font-semibold">
                    {state === 'saving' ? '담는 중...' : '✓ 담았어'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {notice && <p className="text-micro text-[#B45309] mt-2">{notice}</p>}
        <p className="text-micro text-[#C4C2BE] mt-1.5">Photos from Unsplash</p>
      </div>
    </div>
  );
}
