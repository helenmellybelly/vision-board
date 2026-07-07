'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSection, SECTIONS } from '@/lib/questions';
import { getSectionRoute } from '@/lib/sectionRoute';
import {
  loadBoard,
  markSectionComplete,
  saveGeneratedImages,
  saveImageDescriptions,
  saveImageKeywords,
  saveUploadedImage,
  saveUploadedImages,
} from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { getPickedPhotoIds } from '@/lib/imagePick';
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import CuratedGallery from '@/components/CuratedGallery';
import UnsplashSearch from '@/components/UnsplashSearch';
import StoryModal from '@/components/StoryModal';
import MiniBoardPreview from '@/components/MiniBoardPreview';
import useFocusTrap from '@/components/useFocusTrap';

interface GeneratedImage {
  url: string;
  prompt: string;
  index: number;
}

// 사진 담기 (v7.0-r4 재배치) — ① 내 사진 올리기(1순위) ② 큐레이션 샘플 갤러리
// ③ '더 찾아보기'(AI 힌트 + Unsplash 검색 + URL, 접힘). AI 묘사는 필수 스텝 → 선택형 힌트로 강등,
// 펼칠 때만 lazy 호출(온마운트 자동 호출 제거 — API 비용↓)
export default function ScenesPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState(loadBoard());

  // AI 힌트 (구 '순간 1,2,3' 묘사) — 읽기 전용, 펼칠 때만 로드
  const [moreOpen, setMoreOpen] = useState(false);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState(false);
  const [imageKeywords, setImageKeywords] = useState<string[]>([]);
  const [requestedQuery, setRequestedQuery] = useState('');

  // images — 보드·콜라주와 동일하게 섹션당 3장으로 제한
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  // 갤러리 '담았어' 표시의 진실 원천 — 보드의 uploadedImageSources 파생 (v7.1-r2)
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const lightboxTrapRef = useFocusTrap<HTMLDivElement>(!!lightboxSrc, () => setLightboxSrc(null));
  const [urlInput, setUrlInput] = useState('');
  const [slotNotice, setSlotNotice] = useState('');

  const uploadRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [saving, setSaving] = useState(false);
  // 저장 후 다음 행동을 잇는 완료 시트 (v6.21) — 대시보드 왕복 없이 다음 섹션으로
  const [showComplete, setShowComplete] = useState(false);
  const completeTrapRef = useFocusTrap<HTMLDivElement>(showComplete, () => setShowComplete(false));

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];

    // 저장된 힌트가 있으면 상태만 복원 — API 호출은 '더 찾아보기'를 펼칠 때만
    if (sec.imageDescriptions && sec.imageDescriptions.length > 0) {
      setDescriptions(sec.imageDescriptions);
    }
    if (sec.imageKeywords && sec.imageKeywords.length > 0) {
      setImageKeywords(sec.imageKeywords);
    }

    if (sec.generatedImages && sec.generatedImages.length > 0) {
      const imgs = sec.generatedImages.map((url, i) => ({ url, prompt: '', index: i }));
      setGeneratedImages(imgs);
    }
    if (sec.uploadedImages) {
      const imgs = sec.uploadedImages;
      setUploadedImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
    }
    setPickedIds(getPickedPhotoIds(sectionId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const sectionData = board.sections[sectionId];
  const story = sectionData?.miniStory ?? '';

  // 묘사 3개 → 장면별 Unsplash 영어 검색어 3개. 실패해도 흐름엔 영향 없음(섹션 공통 검색어로 대체)
  async function fetchKeywords(descs: string[]) {
    if (!descs.some(Boolean)) return;
    try {
      const res = await fetch('/api/image/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          descriptions: descs,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.keywords)) {
        const kws = data.keywords.slice(0, 3).map(String);
        setImageKeywords(kws);
        saveImageKeywords(sectionId, kws);
      }
    } catch {
      // 조용한 실패
    }
  }

  async function fetchDescriptions() {
    const sec = loadBoard().sections[sectionId];
    setDescribeLoading(true);
    setDescribeError(false);
    try {
      const res = await fetch('/api/image/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          situationText: '',
          sceneText: sec.sceneText ?? '',
          story: sec.miniStory ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.descriptions)) {
        setDescribeError(true);
        return;
      }
      const descs: string[] = data.descriptions.slice(0, 3);
      setDescriptions(descs);
      saveImageDescriptions(sectionId, descs);
      fetchKeywords(descs);
    } catch {
      setDescribeError(true);
    } finally {
      setDescribeLoading(false);
    }
  }

  // '더 찾아보기' 펼침 — 저장된 힌트가 있으면 재사용, 키워드만 없으면 키워드만 lazy 보충
  function handleToggleMore() {
    const next = !moreOpen;
    setMoreOpen(next);
    if (next && descriptions.length > 0 && imageKeywords.length === 0) {
      fetchKeywords(descriptions);
    }
  }

  async function handleUploadFile(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const compressed = await compressImage(raw, 0.60, 800);
      const updated = [...uploadedImages];
      updated[index] = compressed;
      setUploadedImages(updated);
      saveUploadedImage(sectionId, index, compressed);
    };
    reader.readAsDataURL(file);
  }

  // 큰 '내 사진 올리기' — 첫 빈 슬롯의 파일 선택을 연다
  function handleUploadClick() {
    setSlotNotice('');
    const emptyIdx = [0, 1, 2].find((i) => !getSlotUrl(i));
    if (emptyIdx === undefined) {
      setSlotNotice('사진 3장이 가득 찼어. 한 장 비우면 올릴 수 있어.');
      return;
    }
    uploadRefs[emptyIdx].current?.click();
  }

  function handleAddUrl() {
    const url = urlInput.trim();
    if (!url) return;
    const emptyIdx = [0, 1, 2].find((i) => !getSlotUrl(i));
    if (emptyIdx === undefined) return;
    const updated = [...uploadedImages];
    updated[emptyIdx] = url;
    setUploadedImages(updated);
    saveUploadedImage(sectionId, emptyIdx, url);
    setUrlInput('');
  }

  function handleRemoveSlot(index: number) {
    if (uploadedImages[index]) {
      const updated = [...uploadedImages];
      updated[index] = null;
      setUploadedImages(updated);
      saveUploadedImage(sectionId, index, null);
      // 슬롯을 비우면 갤러리 '담았어' 오버레이도 해제 (v7.1-r2)
      setPickedIds(getPickedPhotoIds(sectionId));
    } else if (index < 3 && generatedImages[index]?.url) {
      const updated = generatedImages.map((img, i) =>
        i === index ? { ...img, url: '' } : img
      );
      setGeneratedImages(updated);
      saveGeneratedImages(sectionId, updated.map((img) => img.url));
    }
  }

  function refreshSlots() {
    const imgs = loadBoard().sections[sectionId].uploadedImages ?? [];
    setUploadedImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
    setPickedIds(getPickedPhotoIds(sectionId));
  }

  async function handleSave() {
    setSaving(true);
    const validAiUrls = generatedImages.filter((img) => img.url).map((img) => img.url);
    if (validAiUrls.length > 0) {
      const compressed = await Promise.all(validAiUrls.map((url) => compressImage(url)));
      saveGeneratedImages(sectionId, compressed);
    }
    saveUploadedImages(sectionId, uploadedImages);
    markSectionComplete(sectionId);
    setBoard(loadBoard());
    setSaving(false);
    setShowComplete(true);
  }

  function getSlotUrl(i: number): string | null {
    if (uploadedImages[i]) return uploadedImages[i];
    if (i < 3 && i < generatedImages.length && generatedImages[i]?.url) return generatedImages[i].url;
    return null;
  }

  if (!section) return null;

  const sectionName = section.title.split(' — ')[0];

  function renderSlot(i: number) {
    const url = getSlotUrl(i);
    return (
      <div
        key={i}
        className="aspect-square rounded-xl overflow-hidden relative border border-[#E5E3DF] bg-[#FAFAFA]"
      >
        {url ? (
          <>
            <button
              onClick={() => setLightboxSrc(url)}
              className="absolute inset-0 w-full h-full"
            >
              <Image
                src={url}
                alt={`image ${i + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
            </button>
            <button
              onClick={() => handleRemoveSlot(i)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-caption flex items-center justify-center z-10"
            >
              ×
            </button>
          </>
        ) : (
          <button
            onClick={() => uploadRefs[i].current?.click()}
            className="w-full h-full flex flex-col items-center justify-center text-[#C9C5BE] active:opacity-70"
          >
            <span className="text-display leading-none mb-1">+</span>
            <span className="text-micro">사진 추가</span>
          </button>
        )}
        <input
          ref={uploadRefs[i]}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(i, file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/scene/${sectionId}`)}
            aria-label="미래의 하루 단계로 돌아가기"
            className="text-[#6E6962] text-caption mr-1 active:opacity-60"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-body">{sectionName} · 사진 담기</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-caption text-[#6E6962] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">

        {/* 인트로 */}
        <div className="mb-2">
          <p className="text-body font-semibold text-[#1C1B19] mb-1">이 하루에 어울리는 사진 3장을 담아봐</p>
          <p className="text-caption text-[#6E6962]">3장을 담으면 이 영역이 완성돼.</p>
        </div>

        {story && (
          <StoryModal
            story={story}
            color={section.color}
            label="스토리 다시 보기"
            triggerClassName="mb-3"
          />
        )}

        {/* ① 사진 3슬롯 + 내 사진 올리기 (1순위) */}
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[0, 1, 2].map((i) => renderSlot(i))}
          </div>
          <button
            onClick={handleUploadClick}
            className="w-full py-3.5 rounded-xl text-body font-semibold text-white active:opacity-80"
            style={{ backgroundColor: section.color }}
          >
            📷 내 사진 올리기
          </button>
          {slotNotice && <p className="text-micro text-[#B45309] mt-1">{slotNotice}</p>}
        </div>

        {/* ② 큐레이션 샘플 갤러리 */}
        <CuratedGallery sectionId={sectionId} color={section.color} pickedIds={pickedIds} onChanged={refreshSlots} />

        {/* ③ 더 찾아보기 — AI 힌트 + Unsplash 검색 + URL (접힘) */}
        <button
          onClick={handleToggleMore}
          className="w-full flex items-center justify-between py-3 border-t border-[#F5F5F3] text-body text-[#6B7280] active:opacity-70"
          aria-expanded={moreOpen}
        >
          <span className="font-medium">더 찾아보기</span>
          <span className="text-caption">{moreOpen ? '접기 ▲' : '검색·힌트·URL ▼'}</span>
        </button>

        {moreOpen && (
          <div className="animate-fadeIn">
            {/* AI 힌트 — 구 '순간 1,2,3' 편집 스텝을 읽기 전용 검색 힌트로 강등 */}
            <div className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 mb-3">
              <p className="text-caption font-semibold text-[#1C1B19] mb-1">
                어떤 사진을 찾으면 좋을지 모르겠어?
              </p>
              {descriptions.length === 0 && !describeLoading && !describeError && (
                <button
                  onClick={fetchDescriptions}
                  className="text-caption underline"
                  style={{ color: section.color }}
                >
                  토리에게 힌트 받기 🌰
                </button>
              )}
              {describeLoading && (
                <div className="space-y-2 mt-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-4 bg-[#F5F5F3] rounded-full animate-pulse" />
                  ))}
                </div>
              )}
              {describeError && (
                <p className="text-caption text-[#6E6962]">
                  힌트를 만들지 못했어.{' '}
                  <button onClick={fetchDescriptions} className="underline">다시 시도</button>
                </p>
              )}
              {descriptions.length > 0 && !describeLoading && (
                <div className="space-y-2 mt-1">
                  {descriptions.map((desc, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <p className="text-caption text-[#374151] leading-relaxed flex-1">
                        <span className="font-semibold" style={{ color: section.color }}>순간 {i + 1}</span>{' '}
                        {desc}
                      </p>
                      {imageKeywords[i] && (
                        <button
                          onClick={() => setRequestedQuery(imageKeywords[i])}
                          className="flex-shrink-0 text-micro text-[#6E6962] border border-[#E5E3DF] rounded-full px-2 py-0.5 active:opacity-60"
                        >
                          이 키워드로 검색
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={fetchDescriptions}
                    className="text-micro text-[#6E6962] underline"
                  >
                    힌트 다시 받기
                  </button>
                </div>
              )}
            </div>

            {/* Unsplash 직접 검색 */}
            <UnsplashSearch
              sectionId={sectionId}
              color={section.color}
              defaultQuery={imageKeywords[0] ?? section.imageQuery ?? ''}
              requestedQuery={requestedQuery}
              pickedIds={pickedIds}
              onChanged={refreshSlots}
            />

            {/* URL 입력 */}
            <div className="flex gap-2 mb-4">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
                placeholder="이미지 URL 주소 붙여넣기"
                className="flex-1 text-caption px-3 py-2.5 rounded-xl border border-[#E5E3DF] bg-white outline-none focus:border-[#9CA3AF] placeholder:text-[#C9C5BE]"
              />
              <button
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="px-3 py-2.5 rounded-xl text-caption font-medium text-white disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: section.color }}
              >
                불러오기
              </button>
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl text-body font-medium text-white mt-2 mb-3 disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 완료 시트 — 섹션 간 체크인 + 다음 섹션 연속 진행 (v6.21) */}
      {showComplete && (() => {
        const completedCount = SECTIONS.filter(
          (s) => board.sections[s.id].status === 'completed'
        ).length;
        // 현재 섹션 다음부터 순환 탐색 — 미완성 첫 섹션
        const nextSection = [...SECTIONS.slice(sectionId), ...SECTIONS.slice(0, sectionId - 1)].find(
          (s) => board.sections[s.id].status !== 'completed'
        );
        return (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
            onClick={() => setShowComplete(false)}
          >
            <div
              ref={completeTrapRef}
              role="dialog"
              aria-modal="true"
              aria-label="섹션 완성"
              className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-title font-bold mb-1">🐿️ {sectionName} 완성! {completedCount}/6이야.</p>
              <p className="text-body text-[#6B7280] leading-relaxed mb-3">
                방금 이 칸이 채워졌어. 잠깐 숨 돌려도 좋고, 흐름 탔으면 이어가자.
              </p>
              {/* 방금 채워진 칸 강조 미니보드 (v7.0-r5 peak) */}
              <div className="mb-4">
                <MiniBoardPreview board={board} highlightSectionId={sectionId} compact />
              </div>
              {nextSection ? (
                <button
                  onClick={() => router.push(getSectionRoute(board.sections[nextSection.id], nextSection.id))}
                  className="w-full py-3.5 rounded-xl text-body font-semibold text-white active:opacity-80"
                  style={{ backgroundColor: nextSection.color }}
                >
                  다음: {nextSection.shortTitle ?? nextSection.title.split(' — ')[0]} 이어가기 →
                </button>
              ) : (
                <button
                  onClick={() => router.push('/finish')}
                  className="w-full py-3.5 rounded-xl text-body font-semibold text-white bg-[#1C1B19] active:opacity-80"
                >
                  다 채웠다! 비전보드 완성하러 가기 →
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full mt-3 py-2 text-caption text-[#6E6962] text-center active:opacity-70"
              >
                대시보드로
              </button>
            </div>
          </div>
        );
      })()}

      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            ref={lightboxTrapRef}
            role="dialog"
            aria-modal="true"
            aria-label="이미지 확대 보기"
            className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightboxSrc}
              alt="확대된 사진"
              fill
              className="object-cover"
              unoptimized
            />
            <button
              onClick={() => setLightboxSrc(null)}
              aria-label="닫기"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-heading flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
