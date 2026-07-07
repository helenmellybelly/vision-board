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
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import SceneImageSuggestions from '@/components/SceneImageSuggestions';
import StoryModal from '@/components/StoryModal';
import useFocusTrap from '@/components/useFocusTrap';

interface GeneratedImage {
  url: string;
  prompt: string;
  index: number;
}

export default function ScenesPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState(loadBoard());

  // descriptions
  const [descriptions, setDescriptions] = useState<string[]>(['', '', '']);
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  // 장면별 Unsplash 검색어 — 묘사가 만들어지거나 바뀔 때 다시 계산 (v6.20)
  const [imageKeywords, setImageKeywords] = useState<string[]>([]);

  // images — 보드·콜라주와 동일하게 섹션당 3장으로 제한
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const lightboxTrapRef = useFocusTrap<HTMLDivElement>(!!lightboxSrc, () => setLightboxSrc(null));
  const [urlInput, setUrlInput] = useState('');

  const uploadRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [saving, setSaving] = useState(false);
  // 저장 후 다음 행동을 잇는 완료 시트 (v6.21) — 대시보드 왕복 없이 다음 섹션으로
  const [showComplete, setShowComplete] = useState(false);
  const completeTrapRef = useFocusTrap<HTMLDivElement>(showComplete, () => setShowComplete(false));

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];

    if (sec.imageDescriptions && sec.imageDescriptions.length > 0) {
      setDescriptions(sec.imageDescriptions);
      if (sec.imageKeywords && sec.imageKeywords.length > 0) {
        setImageKeywords(sec.imageKeywords);
      } else {
        fetchKeywords(sec.imageDescriptions);
      }
    } else {
      fetchDescriptions(b);
    }

    if (sec.generatedImages && sec.generatedImages.length > 0) {
      const imgs = sec.generatedImages.map((url, i) => ({ url, prompt: '', index: i }));
      setGeneratedImages(imgs);
    }
    if (sec.uploadedImages) {
      const imgs = sec.uploadedImages;
      setUploadedImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
    }
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

  async function fetchDescriptions(boardData = board) {
    const sec = boardData.sections[sectionId];
    setDescribeLoading(true);
    setDescribeError(false);
    try {
      const res = await fetch('/api/image/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          situationText: sec.situationText ?? '',
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

  async function handleRegenerateOne(index: number) {
    setRegeneratingIdx(index);
    try {
      const res = await fetch('/api/image/describe-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex: index,
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          situationText: sectionData?.situationText ?? '',
          sceneText: sectionData?.sceneText ?? '',
          story: sectionData?.miniStory ?? '',
          existingDescriptions: descriptions,
        }),
      });
      const data = await res.json();
      if (res.ok && data.description) {
        const updated = [...descriptions];
        updated[index] = data.description;
        setDescriptions(updated);
        saveImageDescriptions(sectionId, updated);
        fetchKeywords(updated);
      }
    } finally {
      setRegeneratingIdx(null);
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
    } else if (index < 3 && generatedImages[index]?.url) {
      const updated = generatedImages.map((img, i) =>
        i === index ? { ...img, url: '' } : img
      );
      setGeneratedImages(updated);
      saveGeneratedImages(sectionId, updated.map((img) => img.url));
    }
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

  const hasAnyImage = generatedImages.some((img) => img.url) || uploadedImages.some(Boolean);

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
            onClick={() => router.push(`/moment/${sectionId}`)}
            aria-label="순간 단계로 돌아가기"
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

        {/* Descriptions section */}
        <div className="mb-2">
          <p className="text-body font-semibold text-[#1C1B19] mb-1">네 하루에서 순간 3개를 골라봤어</p>
          <p className="text-caption text-[#6E6962]">탭해서 직접 고칠 수 있어</p>
        </div>

        {story && (
          <StoryModal
            story={story}
            color={section.color}
            label="스토리 다시 보기"
            triggerClassName="mb-3"
          />
        )}

        {describeLoading ? (
          <div className="space-y-2 mb-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 animate-pulse">
                <div className="h-3 bg-[#F5F5F3] rounded-full w-16 mb-2" />
                <div className="h-4 bg-[#F5F5F3] rounded-full w-full" />
              </div>
            ))}
          </div>
        ) : describeError ? (
          <div className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4 text-center mb-4">
            <p className="text-body text-[#6B7280] mb-3">묘사를 만들지 못했어.</p>
            <button onClick={() => fetchDescriptions()} className="text-body text-[#374151] underline">
              다시 시도
            </button>
          </div>
        ) : (
          <div className="space-y-2 mb-2">
            {descriptions.map((desc, i) => (
              <div
                key={i}
                className="rounded-2xl border px-4 py-3 transition-colors cursor-pointer"
                style={{
                  borderColor: editingIdx === i ? section.color + '80' : '#E5E3DF',
                  backgroundColor: editingIdx === i ? section.color + '08' : '#ffffff',
                }}
                onClick={() => {
                  if (editingIdx !== i) {
                    setEditingIdx(i);
                    setEditingText(desc);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-micro font-semibold" style={{ color: section.color }}>
                    순간 {i + 1}
                  </span>
                  {editingIdx !== i && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateOne(i);
                      }}
                      disabled={regeneratingIdx === i}
                      className="text-micro text-[#6E6962] border border-[#E5E3DF] rounded-full px-2 py-0.5 active:opacity-60 disabled:opacity-40"
                    >
                      {regeneratingIdx === i ? '제안 중...' : '↻ 다시 제안'}
                    </button>
                  )}
                </div>

                {editingIdx === i ? (
                  <>
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-body leading-relaxed resize-none outline-none bg-transparent placeholder:text-[#D1CEC9]"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = [...descriptions];
                        updated[i] = editingText;
                        setDescriptions(updated);
                        saveImageDescriptions(sectionId, updated);
                        fetchKeywords(updated);
                        setEditingIdx(null);
                      }}
                      className="mt-2 w-full py-1.5 rounded-lg text-caption font-semibold text-white"
                      style={{ backgroundColor: section.color }}
                    >
                      저장
                    </button>
                  </>
                ) : (
                  <p className="text-body leading-relaxed text-[#374151]">{desc || '—'}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!describeLoading && !describeError && (
          <button
            onClick={() => fetchDescriptions()}
            className="w-full py-2 text-caption text-[#6E6962] text-center mb-4"
          >
            묘사 전체 다시 제안받기
          </button>
        )}

        {/* Divider */}
        <div className="border-t border-[#F5F5F3] mb-4" />

        {/* Images section */}
        <div className="mb-3">
          <p className="text-body font-semibold text-[#1C1B19] mb-0.5">나의 비전보드 사진 찾기</p>
          <p className="text-caption text-[#6E6962]">사진 3장을 담으면 이 영역이 완성돼. 직접 올리거나 URL로 불러올 수 있어.</p>
        </div>

        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[0, 1, 2].map((i) => renderSlot(i))}
          </div>
        </div>

        {/* 장면별 Unsplash 추천 — 키 미설정이면 조용히 사라짐 (v6.20: 채팅에서 이동) */}
        <SceneImageSuggestions
          sectionId={sectionId}
          keywords={imageKeywords}
          fallbackQuery={section.imageQuery ?? ''}
          color={section.color}
          onSaved={() => {
            const imgs = loadBoard().sections[sectionId].uploadedImages ?? [];
            setUploadedImages([imgs[0] ?? null, imgs[1] ?? null, imgs[2] ?? null]);
          }}
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

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl text-body font-medium text-white mb-3 disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>

        <div ref={bottomRef} />
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
              <p className="text-body text-[#6B7280] leading-relaxed mb-5">
                잠깐 숨 돌려도 좋고, 흐름 탔으면 이어가자.
              </p>
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
