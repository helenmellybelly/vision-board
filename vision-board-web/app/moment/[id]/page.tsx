'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSection } from '@/lib/questions';
import {
  loadBoard,
  markSectionComplete,
  resetAiImages,
  resetImages,
  resetToAnswers,
  resetToDescriptions,
  resetToScene,
  resetToSituation,
  saveGeneratedImages,
  saveImageDescriptions,
  saveMiniStory,
  saveSituationText,
  saveUploadedImage,
  saveUploadedImages,
} from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';

type Step = 'situation' | 'story' | 'describe' | 'images';

const STEP_ORDER: Step[] = ['situation', 'story', 'describe', 'images'];
const STEP_LABELS: Record<Step, string> = {
  situation: '① 순간',
  story: '② 스토리',
  describe: '③ 묘사 확인',
  images: '④ 이미지',
};

function renderStory(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
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
}

interface GeneratedImage {
  url: string;
  prompt: string;
  index: number;
}

export default function MomentPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState(loadBoard());
  const [step, setStep] = useState<Step>('situation');

  // situation step
  const [situationInput, setSituationInput] = useState('');
  const [submittedSituation, setSubmittedSituation] = useState('');

  // story step
  const [story, setStory] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);
  const [additionalInput, setAdditionalInput] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [usedAdditional, setUsedAdditional] = useState(false);

  // describe step
  const [descriptions, setDescriptions] = useState<string[]>(['', '', '']);
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState(false);

  // images step — 5 slots (0-2: AI+override, 3-4: upload only)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<'missing_key' | 'failed' | null>(null);
  const [uploadedImages, setUploadedImages] = useState<(string | null)[]>([null, null, null, null, null]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [regeneratingSlot, setRegeneratingSlot] = useState<number | null>(null);
  const [activeDescIdx, setActiveDescIdx] = useState<number | null>(null);

  const uploadRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // edit menu
  const [editMenu, setEditMenu] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<'descriptions' | 'situation' | 'scene' | 'answers' | null>(null);
  const [saving, setSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];
    if (sec.situationText) {
      setSituationInput(sec.situationText);
      setSubmittedSituation(sec.situationText);
    }
    if (sec.miniStory) setStory(sec.miniStory);
    if (sec.imageDescriptions && sec.imageDescriptions.length > 0) {
      setDescriptions(sec.imageDescriptions);
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
    }
    // resume at correct step
    if (sec.generatedImages && sec.generatedImages.length > 0) setStep('images');
    else if (sec.imageDescriptions && sec.imageDescriptions.length > 0) setStep('describe');
    else if (sec.miniStory || sec.situationText) setStep('story');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [step, story, generatedImages, descriptions, describeLoading]);

  const sectionData = board.sections[sectionId];
  const slots = sectionData?.extractedSlots ?? {};

  // 슬롯 i의 표시 URL: 업로드 > AI 순서
  function getSlotUrl(i: number): string | null {
    if (uploadedImages[i]) return uploadedImages[i];
    if (i < 3 && i < generatedImages.length && generatedImages[i]?.url) return generatedImages[i].url;
    return null;
  }

  function isAiSlot(i: number): boolean {
    return !uploadedImages[i] && i < 3 && i < generatedImages.length && !!generatedImages[i]?.url;
  }

  async function generateStory(situation: string, additional?: string) {
    try {
      const res = await fetch('/api/story/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          extractedSlots: slots,
          sceneText: sectionData?.sceneText ?? '',
          situationText: situation,
          additionalInput: additional,
        }),
      });
      const data = await res.json();
      return (data.story as string) ?? '';
    } catch {
      return '';
    }
  }

  async function fetchDescriptions() {
    setDescribeLoading(true);
    setDescribeError(false);
    try {
      const res = await fetch('/api/image/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          situationText: submittedSituation,
          sceneText: sectionData?.sceneText ?? '',
          story,
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

  async function handleSituationSubmit() {
    if (!situationInput.trim()) return;
    setSubmittedSituation(situationInput);
    saveSituationText(sectionId, situationInput);
    setStoryLoading(true);
    setStep('story');
    const result = await generateStory(situationInput);
    setStory(result);
    saveMiniStory(sectionId, result);
    setStoryLoading(false);
  }

  async function handleRegenerate() {
    if (!additionalInput.trim()) return;
    setRegenerating(true);
    const result = await generateStory(submittedSituation, additionalInput);
    setStory(result);
    saveMiniStory(sectionId, result);
    setAdditionalInput('');
    setShowAdditional(false);
    setRegenerating(false);
    setUsedAdditional(true);
  }

  async function handleGoToDescribe() {
    setStep('describe');
    await fetchDescriptions();
  }

  async function handleGenerateImages() {
    setImageLoading(true);
    setImageError(null);
    setStep('images');
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
        setImageLoading(false);
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

  async function handleSaveAndContinue() {
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

  function handleEditAiImages() {
    resetAiImages(sectionId);
    setGeneratedImages([]);
    setImageError(null);
    setEditMenu(false);
    handleGenerateImages();
  }

  async function handleEditDescriptions() {
    resetToDescriptions(sectionId);
    setDescriptions(['', '', '']);
    setGeneratedImages([]);
    setUploadedImages([null, null, null, null, null]);
    setImageError(null);
    setEditMenu(false);
    setPendingConfirm(null);
    setStep('describe');
    await fetchDescriptions();
  }

  async function handleEditStory() {
    resetToSituation(sectionId);
    setStory('');
    setDescriptions(['', '', '']);
    setGeneratedImages([]);
    setUploadedImages([null, null, null, null, null]);
    setImageError(null);
    setEditMenu(false);
    setPendingConfirm(null);
    setStoryLoading(true);
    setStep('story');
    const result = await generateStory(submittedSituation);
    setStory(result);
    saveMiniStory(sectionId, result);
    setStoryLoading(false);
  }

  function handleEditScene() {
    resetToScene(sectionId);
    router.push(`/scene/${sectionId}`);
  }

  function handleEditAnswers() {
    resetToAnswers(sectionId);
    router.push(`/section/${sectionId}`);
  }

  const hasAnyImage = generatedImages.some((img) => img.url) || uploadedImages.some(Boolean);
  const canSave = hasAnyImage;

  if (!section) return null;

  const chips = section.situationChips ?? [];
  const stepIndex = STEP_ORDER.indexOf(step);

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
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]} · 순간</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs text-[#9CA3AF] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEP_ORDER.map((s, i) => {
            const isActive = step === s;
            const isDone = stepIndex > i;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div
                  className="h-6 rounded-full flex-1 flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: isActive
                      ? section.color
                      : isDone
                      ? section.color + '50'
                      : '#E5E3DF',
                  }}
                >
                  <span
                    className="text-[10px] font-medium whitespace-nowrap px-1"
                    style={{ color: isActive || isDone ? '#fff' : '#9CA3AF' }}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div className="w-1.5 h-px bg-[#E5E3DF] flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 1: Situation */}
        <ChatBubble
          role="assistant"
          content="장면까지 그렸으니, 이제 그 삶에서 보고 싶은 구체적인 순간들을 떠올려볼게요."
        />
        <ChatBubble
          role="assistant"
          content="이 삶에서 어떤 장면들이 눈에 들어와요? 공간, 사람, 상황, 물건 — 뭐든 괜찮아요."
        />

        {step === 'situation' && !submittedSituation && (
          <>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() =>
                      setSituationInput((prev) => prev ? `${prev}\n${chip}` : chip)
                    }
                    className="text-xs px-3 py-1.5 rounded-full border border-[#E5E3DF] bg-white text-[#6B7280] active:opacity-70"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={situationInput}
              onChange={(e) => setSituationInput(e.target.value)}
              placeholder="여러 줄로 써도 좋아요. 구체적일수록 이미지가 선명해져요."
              className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-[#C9C5BE] mb-3"
              rows={4}
            />
            <button
              onClick={handleSituationSubmit}
              disabled={!situationInput.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: section.color }}
            >
              이 순간들로 하루를 그려줘 →
            </button>
          </>
        )}

        {submittedSituation && (
          <ChatBubble role="user" content={submittedSituation} />
        )}

        {/* STEP 2: Story — images 단계에서는 숨김 */}
        {(step === 'story' || step === 'describe') && (
          <>
            {storyLoading ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4">
                <p className="text-xs text-[#9CA3AF] mb-2">잠깐, 하루를 그려볼게요...</p>
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse" />
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse mt-2 w-3/4" />
              </div>
            ) : story ? (
              <>
                <div
                  className="mt-3 rounded-2xl border px-4 py-4 mb-3"
                  style={{ borderColor: section.color + '30', backgroundColor: section.color + '08' }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: section.color }}>
                    이 삶의 하루
                  </p>
                  <p className="text-sm leading-relaxed">{renderStory(story)}</p>
                </div>

                {step === 'story' && (
                  <>
                    {!usedAdditional && !showAdditional ? (
                      <button
                        onClick={() => setShowAdditional(true)}
                        className="text-xs text-[#9CA3AF] underline mb-3"
                      >
                        더 담고 싶은 장면이 있어요
                      </button>
                    ) : showAdditional ? (
                      <div className="mb-3">
                        <textarea
                          value={additionalInput}
                          onChange={(e) => setAdditionalInput(e.target.value)}
                          placeholder="예: 친구와 저녁 먹는 장면, 아침 커피 한 잔..."
                          className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-sm leading-relaxed resize-none focus:outline-none focus:border-[#C9C5BE] mb-2"
                          rows={2}
                        />
                        <button
                          onClick={handleRegenerate}
                          disabled={!additionalInput.trim() || regenerating}
                          className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white text-[#374151] disabled:opacity-40"
                        >
                          {regenerating ? '다시 그리는 중...' : '다시 그려줘'}
                        </button>
                      </div>
                    ) : null}

                    <button
                      onClick={handleGoToDescribe}
                      className="w-full py-3.5 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: section.color }}
                    >
                      이미지 묘사 골라볼게 →
                    </button>
                  </>
                )}
              </>
            ) : null}
          </>
        )}

        {/* STEP 3: Describe — describe 단계에서만 표시 */}
        {step === 'describe' && (
          <>
            <button
              onClick={() => {
                saveImageDescriptions(sectionId, []);
                setDescriptions(['', '', '']);
                setStep('story');
              }}
              className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-2 mb-1 active:opacity-60"
            >
              ← 스토리로 돌아가기
            </button>

            <ChatBubble
              role="assistant"
              content="어떤 장면으로 만들어볼까요? 아래 묘사를 직접 수정해도 돼요."
            />

            {describeLoading ? (
              <div className="mt-2 space-y-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 animate-pulse">
                    <div className="h-3 bg-[#F5F5F3] rounded-full w-16 mb-2" />
                    <div className="h-4 bg-[#F5F5F3] rounded-full w-full" />
                  </div>
                ))}
              </div>
            ) : describeError ? (
              <div className="mt-2 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4 text-center mb-4">
                <p className="text-sm text-[#6B7280] mb-3">묘사 생성에 실패했어요.</p>
                <button
                  onClick={fetchDescriptions}
                  className="text-sm text-[#374151] underline"
                >
                  다시 시도
                </button>
              </div>
            ) : descriptions.some(Boolean) ? (
              <div className="mt-2 space-y-2">
                {descriptions.map((desc, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border px-4 py-3 transition-colors"
                    style={{
                      borderColor: activeDescIdx === i ? section.color + '60' : '#E5E3DF',
                      backgroundColor: activeDescIdx === i ? section.color + '08' : '#ffffff',
                    }}
                    onFocus={() => setActiveDescIdx(i)}
                    onBlur={() => setActiveDescIdx(null)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: section.color }}
                      >
                        장면 {i + 1}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                        style={{ backgroundColor: section.color + '18', color: section.color }}
                      >
                        ✏ 수정 가능
                      </span>
                    </div>
                    <textarea
                      value={desc}
                      onChange={(e) => {
                        const updated = [...descriptions];
                        updated[i] = e.target.value;
                        setDescriptions(updated);
                      }}
                      rows={2}
                      placeholder="직접 수정할 수 있어요"
                      className="w-full text-sm leading-relaxed resize-none outline-none bg-transparent placeholder:text-[#D1CEC9]"
                    />
                  </div>
                ))}
                <p className="text-[11px] text-[#B0ABA4] text-center mb-4">AI가 제안한 묘사예요. 탭해서 직접 수정할 수 있어요.</p>
              </div>
            ) : null}

            {!describeLoading && (
              <>
                {descriptions.some(Boolean) && (
                  <button
                    onClick={handleGenerateImages}
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-white mb-2"
                    style={{ backgroundColor: section.color }}
                  >
                    이 모습들로 만들게요 →
                  </button>
                )}
                <button
                  onClick={fetchDescriptions}
                  className="w-full py-2 text-xs text-[#9CA3AF] text-center"
                >
                  묘사 다시 제안받기
                </button>
              </>
            )}
          </>
        )}

        {/* STEP 4: Images */}
        {step === 'images' && (
          <>
            {/* 이전 단계 맥락 요약 칩 */}
            {story && (
              <details className="mb-3 rounded-xl border border-[#E5E3DF] bg-white overflow-hidden">
                <summary className="px-4 py-2.5 text-xs text-[#9CA3AF] cursor-pointer list-none flex justify-between items-center select-none">
                  <span>스토리 · 묘사 확인 완료</span>
                  <span className="text-[10px]">펼치기 ▾</span>
                </summary>
                <div className="px-4 pb-3 pt-2 border-t border-[#F5F5F3]">
                  <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-3 mb-2">{story}</p>
                  {descriptions.some(Boolean) && (
                    <div className="space-y-1">
                      {descriptions.map((d, i) => d ? (
                        <p key={i} className="text-[11px] text-[#9CA3AF]">
                          <span style={{ color: section.color }} className="font-medium">장면 {i + 1}</span> {d}
                        </p>
                      ) : null)}
                    </div>
                  )}
                </div>
              </details>
            )}

            <ChatBubble
              role="assistant"
              content="이미지를 채워볼게요. AI 이미지나 직접 찍은 사진, 또는 자유롭게 섞어서 최대 5장."
            />

            {/* Back button (only before images load) */}
            {!imageLoading && generatedImages.length === 0 && !imageError && (
              <button
                onClick={async () => {
                  resetToDescriptions(sectionId);
                  setGeneratedImages([]);
                  setImageError(null);
                  setStep('describe');
                  await fetchDescriptions();
                }}
                className="text-xs text-[#9CA3AF] flex items-center gap-1 mt-2 mb-1 active:opacity-60"
              >
                ← 묘사 수정하기
              </button>
            )}

            {imageLoading ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-6">
                <p className="text-xs text-[#9CA3AF] text-center mb-3">이미지를 만들고 있어요...</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-[#F5F5F3] animate-pulse" />
                  ))}
                </div>
                <div className="flex gap-2 justify-center">
                  {[3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-[#F5F5F3] animate-pulse"
                      style={{ width: 'calc((100% - 16px) / 3)' }}
                    />
                  ))}
                </div>
              </div>
            ) : imageError !== null && !hasAnyImage ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-5 text-center">
                {imageError === 'missing_key' ? (
                  <>
                    <p className="text-sm text-[#6B7280] mb-1">이미지 생성 기능을 준비 중이에요.</p>
                    <p className="text-xs text-[#9CA3AF] mb-4">사진을 직접 올리거나 글만 저장하고 계속할 수 있어요.</p>
                    <button
                      onClick={handleSaveAndContinue}
                      className="w-full py-3 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: section.color }}
                    >
                      글만 저장하고 계속하기 →
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#6B7280] mb-4">이미지 생성에 실패했어요.</p>
                    <button
                      onClick={handleGenerateImages}
                      className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white mb-2"
                    >
                      다시 시도
                    </button>
                    <button
                      onClick={handleSaveAndContinue}
                      className="w-full py-2.5 rounded-xl text-xs text-[#9CA3AF]"
                    >
                      글만 저장하고 계속하기
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* 통합 5슬롯 갤러리 */}
                <div className="mt-3 mb-3">
                  <p className="text-xs text-[#9CA3AF] mb-2">
                    AI 이미지와 직접 찍은 사진을 자유롭게 섞어 최대 5장
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[0, 1, 2].map((i) => renderSlot(i))}
                  </div>
                  <div className="flex gap-2 justify-center">
                    {[3, 4].map((i) => (
                      <div key={i} style={{ width: 'calc((100% - 16px) / 3)' }}>
                        {renderSlot(i)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 생성 실패 인라인 알림 (업로드 이미지는 있을 때) */}
                {imageError && hasAnyImage && (
                  <div className="mb-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] px-3 py-2.5 flex items-center justify-between">
                    <p className="text-xs text-[#92400E]">AI 이미지 생성에 실패했어요.</p>
                    <button onClick={handleGenerateImages} className="text-xs font-medium text-[#92400E] ml-3 flex-shrink-0">
                      다시 시도
                    </button>
                  </div>
                )}

                {canSave && (
                  <button
                    onClick={handleSaveAndContinue}
                    disabled={saving || !canSave}
                    className="w-full py-3.5 rounded-xl text-sm font-medium text-white mb-2 disabled:opacity-60 transition-opacity"
                    style={{ backgroundColor: section.color }}
                  >
                    {saving ? '저장 중...' : '저장하고 다음 영역으로 →'}
                  </button>
                )}

                {generatedImages.some((img) => img.url) && (
                  <button
                    onClick={handleEditAiImages}
                    className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white text-[#6B7280] mb-3"
                  >
                    AI 이미지 다시 만들기
                  </button>
                )}

                {/* 수정 메뉴 */}
                <button
                  onClick={() => { setEditMenu(!editMenu); setPendingConfirm(null); }}
                  className="w-full py-2 text-xs text-[#C9C5BE] text-center"
                >
                  {editMenu ? '닫기 ∧' : '더 수정하기 ∨'}
                </button>

                {editMenu && (
                  <div className="mt-2 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
                    {/* 묘사부터 */}
                    <div className="px-4 py-3 border-b border-[#F5F5F3]">
                      {pendingConfirm === 'descriptions' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">이미지가 삭제되고 묘사 단계로 돌아가요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditDescriptions} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('descriptions')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">묘사부터 다시 쓰기</p>
                          <p className="text-xs text-[#9CA3AF]">이미지 삭제됨</p>
                        </button>
                      )}
                    </div>
                    {/* 스토리부터 */}
                    <div className="px-4 py-3 border-b border-[#F5F5F3]">
                      {pendingConfirm === 'situation' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">스토리·묘사·이미지가 삭제돼요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditStory} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('situation')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">스토리부터 다시 쓰기</p>
                          <p className="text-xs text-[#9CA3AF]">묘사·이미지 삭제됨</p>
                        </button>
                      )}
                    </div>
                    {/* 장면부터 */}
                    <div className="px-4 py-3 border-b border-[#F5F5F3]">
                      {pendingConfirm === 'scene' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">장면·스토리·묘사·이미지가 삭제돼요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditScene} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('scene')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">장면부터 다시</p>
                          <p className="text-xs text-[#9CA3AF]">스토리·묘사·이미지 삭제됨</p>
                        </button>
                      )}
                    </div>
                    {/* 답변부터 */}
                    <div className="px-4 py-3">
                      {pendingConfirm === 'answers' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">모든 내용이 삭제돼요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditAnswers} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('answers')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">답변부터 다시</p>
                          <p className="text-xs text-[#9CA3AF]">모든 내용 삭제됨</p>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Lightbox */}
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
