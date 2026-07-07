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
  /** 장면별 영어 검색어 3개 — 비어 있으면 fallbackQuery + 페이지 분산으로 대체 */
  keywords: string[];
  /** 키워드가 없을 때 쓰는 섹션 공통 검색어 (lib/questions.ts imageQuery) */
  fallbackQuery: string;
  color: string;
  /** 저장 성공 시 부모가 슬롯 상태를 새로고침하도록 */
  onSaved: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

// 장면 1·2·3 묘사에 어울리는 Unsplash 추천 이미지 (v6.20 — 채팅에서 /scenes로 이동).
// API 키 미설정·결과 0건이면 아무것도 렌더하지 않는다(조용한 실패).
export default function SceneImageSuggestions({ sectionId, keywords, fallbackQuery, color, onSaved }: Props) {
  const [scenePhotos, setScenePhotos] = useState<Photo[][]>([[], [], []]);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    [0, 1, 2].forEach(async (i) => {
      // 키워드가 아직 없으면 섹션 공통 검색어를 페이지만 달리해 장면별로 다른 사진을 보여준다
      const q = keywords[i]?.trim() || fallbackQuery;
      const page = keywords[i]?.trim() ? 1 : i + 1;
      if (!q) return;
      try {
        const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}&page=${page}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.photos)) {
          setScenePhotos((prev) => {
            const next = [...prev];
            next[i] = data.photos.slice(0, 4);
            return next;
          });
        }
      } catch {
        // 조용한 실패
      }
    });
    return () => {
      cancelled = true;
    };
  }, [keywords, fallbackQuery]);

  const hasAny = scenePhotos.some((p) => p.length > 0);
  if (!hasAny) return null;

  // 장면 번호와 같은 슬롯을 우선 채우고, 차 있으면 빈 슬롯 순서대로
  function findSlot(preferred: number): number | null {
    const sec = loadBoard().sections[sectionId];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    const isFree = (i: number) => !uploaded[i] && !generated[i];
    if (isFree(preferred)) return preferred;
    for (let i = 0; i < 3; i++) if (isFree(i)) return i;
    if (!uploaded[preferred]) return preferred;
    for (let i = 0; i < 3; i++) if (!uploaded[i]) return i;
    return null;
  }

  async function handlePick(sceneIdx: number, photo: Photo) {
    if (saveStates[photo.id] === 'saving' || saveStates[photo.id] === 'saved') return;
    setNotice('');
    const slot = findSlot(sceneIdx);
    if (slot === null) {
      setNotice('사진 3장이 가득 찼어. 위에서 한 장 비우면 담을 수 있어.');
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
    <div className="mb-4 animate-fadeIn">
      <div className="mb-2">
        <p className="text-body font-semibold text-[#1C1B19] mb-0.5">이런 이미지들도 있어 🌰</p>
        <p className="text-caption text-[#6E6962]">순간에 어울리는 사진이야. 탭하면 비전보드에 담아둘게.</p>
      </div>
      <div className="space-y-2.5">
        {scenePhotos.map((photos, i) =>
          photos.length === 0 ? null : (
            <div key={i}>
              <p className="text-micro font-semibold mb-1" style={{ color }}>
                순간 {i + 1}
              </p>
              <div className="flex gap-2 overflow-x-auto scroll-hide pb-1 -mx-1 px-1">
                {photos.map((photo) => {
                  const state = saveStates[photo.id] ?? 'idle';
                  return (
                    <button
                      key={photo.id}
                      onClick={() => handlePick(i, photo)}
                      disabled={state !== 'idle'}
                      className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-[#E5E3DF] active:opacity-80"
                      aria-label={photo.alt || `순간 ${i + 1} 추천 이미지 담기`}
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
            </div>
          )
        )}
      </div>
      {notice && <p className="text-micro text-[#B45309] mt-1">{notice}</p>}
      <p className="text-micro text-[#C4C2BE] mt-1">Photos from Unsplash</p>
    </div>
  );
}
