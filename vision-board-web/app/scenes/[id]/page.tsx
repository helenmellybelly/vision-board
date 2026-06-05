'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSection } from '@/lib/questions';
import {
  loadBoard,
  markSectionComplete,
  resetToDescriptions,
  resetToSituation,
  saveGeneratedImages,
  saveImageDescriptions,
  saveUploadedImage,
  saveUploadedImages,
} from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';

interface GeneratedImage {
  url: string;
  prompt: string;
  index: number;
}

function StoryToggle({ story, color }: { story: string; color: string }) {
  const lines = story.split('\n');
  const rendered = lines.map((line, li) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={li}>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <strong key={i} className="font-semibold text-[#1C1B19]">{part}</strong>
            : part
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });

  return (
    <details className="mb-3 rounded-xl border border-[#E5E3DF] bg-white overflow-hidden">
      <summary className="px-4 py-2.5 text-xs text-[#9CA3AF] cursor-pointer list-none flex justify-between items-center select-none">
        <span>📖 스토리 다시 보기</span>
        <span className="text-[10px]">▾</span>
      </summary>
      <div className="px-4 pb-3 pt-2 border-t border-[#F5F5F3]">
        <p
          className="text-xs leading-relaxed text-[#374151]"
          style={{ borderLeft: `2px solid ${color}40`, paddingLeft: 8 }}
        >
          {rendered}
        </p>
      </div>
    </details>
  );
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

  // images
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<'missing_key' | 'failed' | null>(null);
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null, null, null]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [regeneratingSlot, setRegeneratingSlot] = useState<number | null>(null);
  const [visibleSlots, setVisibleSlots] = useState(3);

  const uploadRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [saving, setSaving] = useState(false);
  const [editMenu, setEditMenu] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<'descriptions' | 'story' | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];

    if (sec.imageDescriptions && sec.imageDescriptions.length > 0) {
      setDescriptions(sec.imageDescriptions);
    } else {
      fetchDescriptions(b);
    }

    if (sec.generatedImages && sec.generatedImages.length > 0) {
      const imgs = sec.generatedImages.map((url, i) => ({ url, prompt: '', index: i }));
      setGeneratedImages(imgs);
    }
    if (sec.uploadedImages) {
      const imgs = sec.uploadedImages;
      setUploadedImages([
        imgs[0] ?? null,
        imgs[1] ?? null,
        imgs[2] ?? null,
        imgs[3] ?? null,
        imgs[4] ?? null,
      ]);
      let vs = 3;
      if (imgs[3]) vs = 4;
      if (imgs[4]) vs = 5;
      setVisibleSlots(vs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const sectionData = board.sections[sectionId];
  const story = sectionData?.miniStory ?? '';

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
      }
    } finally {
      setRegeneratingIdx(null);
    }
  }

  async function handleGenerateImages() {
    if (!descriptions.some(Boolean)) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptions,
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          sceneText: sectionData?.sceneText ?? '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.code === 'MISSING_KEY' ? 'missing_key' : 'failed');
        return;
      }
      const imgs: GeneratedImage[] = data.images ?? [];
      setGeneratedImages(imgs);
      Promise.all(imgs.map((img) => compressImage(img.url))).then((compressed) => {
        saveGeneratedImages(sectionId, compressed);
      });
    } catch {
      setImageError('failed');
    } finally {
      setImageLoading(false);
    }
  }

  async function handleRegenerateSlot(index: number) {
    if (!descriptions[index]) return;
    setRegeneratingSlot(index);
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptions: [descriptions[index]],
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          sceneText: sectionData?.sceneText ?? '',
        }),
      });
      const data = await res.json();
      if (res.ok && data.images?.length > 0) {
        const compressed = await compressImage(data.images[0].url);
        const updated = [...generatedImages];
        const existing = updated[index];
        if (existing) {
          updated[index] = { ...existing, url: compressed };
        } else {
          updated[index] = { url: compressed, prompt: data.images[0].prompt, index };
        }
        setGeneratedImages(updated);
        saveGeneratedImages(sectionId, updated.map((img) => img.url));
      }
    } finally {
      setRegeneratingSlot(null);
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
    router.push('/dashboard');
  }

  async function handleEditDescriptions() {
    resetToDescriptions(sectionId);
    setDescriptions(['', '', '']);
    setGeneratedImages([]);
    setUploadedImages([null, null, null, null, null]);
    setImageError(null);
    setEditMenu(false);
    setPendingConfirm(null);
    await fetchDescriptions();
  }

  function handleEditStory() {
    resetToSituation(sectionId);
    router.push(`/moment/${sectionId}`);
  }

  function getSlotUrl(i: number): string | null {
    if (uploadedImages[i]) return uploadedImages[i];
    if (i < 3 && i < generatedImages.length && generatedImages[i]?.url) return generatedImages[i].url;
    return null;
  }

  function isAiSlot(i: number): boolean {
    return !uploadedImages[i] && i < 3 && i < generatedImages.length && !!generatedImages[i]?.url;
  }

  const hasAnyImage = generatedImages.some((img) => img.url) || uploadedImages.some(Boolean);

  if (!section) return null;

  const sectionName = section.title.split(' — ')[0];

  function renderSlot(i: number) {
    const url = getSlotUrl(i);
    const ai = isAiSlot(i);
    const isRegenerating = regeneratingSlot === i;
    return (
      <div
        key={i}
        className="aspect-square rounded-xl overflow-hidden relative border border-[#E5E3DF] bg-[#FAFAFA]"
      >
        {isRegenerating ? (
          <div className="w-full h-full bg-[#F5F5F3] animate-pulse flex items-center justify-center">
            <span className="text-[10px] text-[#B0ABA4]">생성 중...</span>
          </div>
        ) : url ? (
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
            {!ai && (
              <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/40 text-[9px] text-white/80 pointer-events-none">
                내 사진
              </div>
            )}
            <button
              onClick={() => handleRemoveSlot(i)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center z-10"
            >
              ×
            </button>
            {ai && (
              <div
                className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 px-1 pb-1.5 pt-5"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.60) 0%, transparent 100%)' }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); handleRegenerateSlot(i); }}
                  className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[9px] text-white border border-white/30 active:opacity-70"
                >
                  ↻ 다시 생성
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); uploadRefs[i].current?.click(); }}
                  className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[9px] text-white border border-white/30 active:opacity-70"
                >
                  ↑ 직접 올리기
                </button>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => uploadRefs[i].current?.click()}
            className="w-full h-full flex flex-col items-center justify-center text-[#C9C5BE] active:opacity-70"
          >
            <span className="text-2xl leading-none mb-1">+</span>
            <span className="text-[10px]">사진 추가</span>
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
            className="text-[#9CA3AF] text-xs mr-1 active:opacity-60"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{sectionName} · 장면</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs text-[#9CA3AF] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">

        {/* Descriptions section */}
        <div className="mb-2">
          <p className="text-sm font-semibold text-[#1C1B19] mb-1">장면을 만들어 볼까요</p>
          <p className="text-xs text-[#9CA3AF]">탭해서 직접 수정할 수 있어요</p>
        </div>

        {story && <StoryToggle story={story} color={section.color} />}

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
            <p className="text-sm text-[#6B7280] mb-3">묘사 생성에 실패했어요.</p>
            <button onClick={() => fetchDescriptions()} className="text-sm text-[#374151] underline">
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
                  <span className="text-[10px] font-semibold" style={{ color: section.color }}>
                    장면 {i + 1}
                  </span>
                  {editingIdx !== i && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateOne(i);
                      }}
                      disabled={regeneratingIdx === i}
                      className="text-[10px] text-[#9CA3AF] border border-[#E5E3DF] rounded-full px-2 py-0.5 active:opacity-60 disabled:opacity-40"
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
                      className="w-full text-sm leading-relaxed resize-none outline-none bg-transparent placeholder:text-[#D1CEC9]"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const updated = [...descriptions];
                        updated[i] = editingText;
                        setDescriptions(updated);
                        saveImageDescriptions(sectionId, updated);
                        setEditingIdx(null);
                      }}
                      className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: section.color }}
                    >
                      저장
                    </button>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-[#374151]">{desc || '—'}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!describeLoading && !describeError && (
          <button
            onClick={() => fetchDescriptions()}
            className="w-full py-2 text-xs text-[#9CA3AF] text-center mb-4"
          >
            묘사 전체 다시 제안받기
          </button>
        )}

        {/* Divider */}
        <div className="border-t border-[#F5F5F3] mb-4" />

        {/* Images section */}
        <div className="mb-3">
          <p className="text-sm font-semibold text-[#1C1B19] mb-0.5">이미지 추가하기</p>
          <p className="text-xs text-[#9CA3AF]">AI로 만들거나 직접 사진을 올릴 수 있어요. 없어도 저장 가능해요.</p>
        </div>

        {imageLoading ? (
          <div className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-6 mb-3">
            <p className="text-xs text-[#9CA3AF] text-center mb-3">이미지를 만들고 있어요...</p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-[#F5F5F3] animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {!hasAnyImage && imageError === null && (
              <button
                onClick={handleGenerateImages}
                disabled={!descriptions.some(Boolean)}
                className="w-full rounded-2xl border-2 px-4 py-4 text-center active:opacity-70 transition-opacity mb-3 disabled:opacity-40"
                style={{ borderColor: section.color, backgroundColor: section.color + '0d' }}
              >
                <div className="text-lg mb-1">✦</div>
                <div className="text-sm font-semibold" style={{ color: section.color }}>AI로 3장 만들기</div>
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">묘사를 바탕으로 생성해줄게요</div>
              </button>
            )}

            {imageError !== null && !hasAnyImage && (
              <div className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4 text-center mb-3">
                {imageError === 'missing_key' ? (
                  <>
                    <p className="text-sm text-[#6B7280] mb-1">이미지 생성 기능을 준비 중이에요.</p>
                    <p className="text-xs text-[#9CA3AF]">사진을 직접 올리거나 이미지 없이 저장할 수 있어요.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#6B7280] mb-3">이미지 생성에 실패했어요.</p>
                    <button
                      onClick={handleGenerateImages}
                      className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white"
                    >
                      다시 시도
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mb-3">
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[0, 1, 2].map((i) => renderSlot(i))}
              </div>
              {visibleSlots >= 4 && (
                <div className="flex gap-2 mb-2">
                  <div style={{ width: 'calc((100% - 16px) / 3)' }}>
                    {renderSlot(3)}
                  </div>
                  {visibleSlots >= 5 && (
                    <div style={{ width: 'calc((100% - 16px) / 3)' }}>
                      {renderSlot(4)}
                    </div>
                  )}
                </div>
              )}
              {visibleSlots < 5 && (
                <button
                  onClick={() => setVisibleSlots((v) => Math.min(v + 1, 5))}
                  className="text-xs text-[#9CA3AF] underline mt-1 active:opacity-60"
                >
                  + 사진 추가
                </button>
              )}
            </div>

            {hasAnyImage && generatedImages.some((img) => img.url) && (
              <button
                onClick={handleGenerateImages}
                className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white text-[#6B7280] mb-3"
              >
                AI 이미지 다시 만들기
              </button>
            )}

            {imageError && hasAnyImage && (
              <div className="mb-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] px-3 py-2.5 flex items-center justify-between">
                <p className="text-xs text-[#92400E]">AI 이미지 생성에 실패했어요.</p>
                <button onClick={handleGenerateImages} className="text-xs font-medium text-[#92400E] ml-3 flex-shrink-0">
                  다시 시도
                </button>
              </div>
            )}
          </>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl text-sm font-medium text-white mb-3 disabled:opacity-60 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {saving ? '저장 중...' : hasAnyImage ? '저장하고 다음 영역으로 →' : '이미지 없이 저장하고 계속 →'}
        </button>

        {/* Edit menu */}
        <button
          onClick={() => { setEditMenu(!editMenu); setPendingConfirm(null); }}
          className="w-full py-2 text-xs text-[#C9C5BE] text-center"
        >
          {editMenu ? '닫기 ∧' : '더 수정하기 ∨'}
        </button>

        {editMenu && (
          <div className="mt-2 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F5F5F3]">
              {pendingConfirm === 'descriptions' ? (
                <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                  <p className="text-xs text-[#92400E] mb-2">이미지가 삭제되고 묘사를 다시 받아요. 계속할까?</p>
                  <div className="flex gap-3">
                    <button onClick={handleEditDescriptions} className="text-xs font-medium text-[#92400E]">계속</button>
                    <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setPendingConfirm('descriptions')} className="w-full text-left">
                  <p className="text-sm text-[#374151]">묘사 전체 다시 받기</p>
                  <p className="text-xs text-[#9CA3AF]">이미지 삭제됨</p>
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              {pendingConfirm === 'story' ? (
                <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                  <p className="text-xs text-[#92400E] mb-2">스토리·묘사·이미지가 삭제돼요. 계속할까?</p>
                  <div className="flex gap-3">
                    <button onClick={handleEditStory} className="text-xs font-medium text-[#92400E]">계속</button>
                    <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setPendingConfirm('story')} className="w-full text-left">
                  <p className="text-sm text-[#374151]">스토리부터 다시</p>
                  <p className="text-xs text-[#9CA3AF]">묘사·이미지 삭제됨</p>
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden">
            <Image
              src={lightboxSrc}
              alt="full view"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
