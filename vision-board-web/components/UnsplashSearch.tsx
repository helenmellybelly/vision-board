'use client';

import { useEffect, useState } from 'react';
import { SectionId } from '@/lib/types';
import { pickRemotePhoto, PICK_NOTICES } from '@/lib/imagePick';

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
  color: string;
  /** 검색 인풋 초기값 (섹션 공통 검색어) */
  defaultQuery: string;
  /** AI 힌트의 '이 키워드로 검색' — 값이 바뀌면 인풋을 채우고 즉시 검색 */
  requestedQuery?: string;
  /** 저장 성공 시 부모가 슬롯 상태를 새로고침하도록 */
  onSaved: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

// Unsplash 직접 검색 (v7.0-r4) — '더 찾아보기' 보조 수단. 구 SceneImageSuggestions(자동 추천) 대체.
// API 키 미설정·검색 실패 시 안내만 남긴다.
export default function UnsplashSearch({ sectionId, color, defaultQuery, requestedQuery, onSaved }: Props) {
  const [query, setQuery] = useState(defaultQuery);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [notice, setNotice] = useState('');

  async function search(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setNotice('');
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(trimmed)}&page=1`);
      const data = await res.json();
      setPhotos(res.ok && Array.isArray(data.photos) ? data.photos.slice(0, 9) : []);
    } catch {
      setPhotos([]);
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }

  // AI 힌트에서 키워드 검색 요청 — 인풋 갱신 + 즉시 검색
  useEffect(() => {
    if (requestedQuery?.trim()) {
      setQuery(requestedQuery);
      search(requestedQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedQuery]);

  async function handlePick(photo: Photo) {
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
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(query); }}
          placeholder="검색어 (영어가 결과가 좋아)"
          className="flex-1 min-w-0 text-caption px-3 py-2.5 rounded-xl border border-[#E5E3DF] bg-white outline-none focus:border-[#9CA3AF] placeholder:text-[#C9C5BE]"
        />
        <button
          onClick={() => search(query)}
          disabled={!query.trim() || loading}
          className="px-3 py-2.5 rounded-xl text-caption font-medium text-white disabled:opacity-40 transition-opacity flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {loading ? '찾는 중...' : '사진 검색'}
        </button>
      </div>

      {searched && !loading && photos.length === 0 && (
        <p className="text-caption text-[#6E6962] mb-2">
          결과가 없어. 다른 검색어로 해보거나, 위의 샘플·내 사진을 써봐.
        </p>
      )}

      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-1">
            {photos.map((photo) => {
              const state = saveStates[photo.id] ?? 'idle';
              return (
                <button
                  key={photo.id}
                  onClick={() => handlePick(photo)}
                  disabled={state !== 'idle'}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E3DF] active:opacity-80"
                  aria-label={photo.alt || '검색 결과 사진 담기'}
                  title={photo.userName ? `Photo by ${photo.userName} on Unsplash` : undefined}
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
          <p className="text-micro text-[#C4C2BE]">
            Photos from{' '}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline">
              Unsplash
            </a>
          </p>
        </>
      )}

      {notice && <p className="text-micro text-[#B45309] mt-1">{notice}</p>}
    </div>
  );
}
