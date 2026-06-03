'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getSection } from '@/lib/questions';
import {
  loadBoard,
  markSectionComplete,
  resetImages,
  resetToAnswers,
  resetToScene,
  resetToSituation,
  saveGeneratedImages,
  saveMiniStory,
  saveSituationText,
} from '@/lib/storage';
import { compressImage } from '@/lib/imageUtils';
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';

type Step = 'situation' | 'story' | 'images';

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

  // images step
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<'missing_key' | 'failed' | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // edit menu
  const [editMenu, setEditMenu] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<'situation' | 'scene' | 'answers' | null>(null);
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
    if (sec.miniStory) {
      setStory(sec.miniStory);
    }
    if (sec.generatedImages && sec.generatedImages.length > 0) {
      const imgs = sec.generatedImages.map((url, i) => ({ url, prompt: '', index: i }));
      setGeneratedImages(imgs);
    }
    // resume at correct step
    if (sec.generatedImages && sec.generatedImages.length > 0) setStep('images');
    else if (sec.miniStory) setStep('story');
    else if (sec.situationText) setStep('story');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, story, generatedImages]);

  const sectionData = board.sections[sectionId];
  const slots = sectionData?.extractedSlots ?? {};

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

  async function handleGenerateImages() {
    setImageLoading(true);
    setImageError(null);
    setStep('images');
    try {
      const res = await fetch('/api/image/generate', {
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
      if (!res.ok) {
        setImageError(data.code === 'MISSING_KEY' ? 'missing_key' : 'failed');
        setImageLoading(false);
        return;
      }
      const imgs: GeneratedImage[] = data.images ?? [];
      setGeneratedImages(imgs);
      // 압축 후 영구 저장 (백그라운드, UI는 원본으로 즉시 표시)
      Promise.all(imgs.map((img) => compressImage(img.url))).then((compressed) => {
        saveGeneratedImages(sectionId, compressed);
      });
    } catch {
      setImageError('failed');
    } finally {
      setImageLoading(false);
    }
  }

  async function handleSaveAndContinue() {
    setSaving(true);
    // 아직 압축 저장이 완료 안 됐을 경우를 대비해 재시도
    if (generatedImages.length > 0) {
      const compressed = await Promise.all(generatedImages.map((img) => compressImage(img.url)));
      saveGeneratedImages(sectionId, compressed);
    }
    markSectionComplete(sectionId);
    router.push('/dashboard');
  }

  function handleEditImages() {
    resetImages(sectionId);
    setGeneratedImages([]);
    setImageError(null);
    setEditMenu(false);
    handleGenerateImages();
  }

  async function handleEditStory() {
    resetToSituation(sectionId);
    setStory('');
    setGeneratedImages([]);
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

  if (!section) return null;

  const chips = section.situationChips ?? [];

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
        <div className="flex items-center gap-1.5 mb-4">
          {(['situation', 'story', 'images'] as Step[]).map((s, i) => (
            <div
              key={s}
              className="h-1 rounded-full flex-1 transition-all"
              style={{
                backgroundColor:
                  step === s
                    ? section.color
                    : (['situation', 'story', 'images'] as Step[]).indexOf(step) > i
                    ? section.color + '60'
                    : '#E5E3DF',
              }}
            />
          ))}
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
            {/* Example chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() =>
                      setSituationInput((prev) =>
                        prev ? `${prev}\n${chip}` : chip
                      )
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

        {/* STEP 2: Story */}
        {(step === 'story' || step === 'images') && (
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
                          placeholder="예: 친구와 저녁 먹는 장면, 아침 커피 한 잔... 꼭 담고 싶은 순간을 써봐"
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
                      onClick={handleGenerateImages}
                      className="w-full py-3.5 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: section.color }}
                    >
                      이 하루를 이미지로 볼게 →
                    </button>
                  </>
                )}
              </>
            ) : null}
          </>
        )}

        {/* STEP 3: Images */}
        {step === 'images' && (
          <>
            {imageLoading ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-6">
                <p className="text-xs text-[#9CA3AF] text-center mb-3">DALL-E로 이미지를 만들고 있어요...</p>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-[#F5F5F3] animate-pulse" />
                  ))}
                </div>
              </div>
            ) : generatedImages.length > 0 ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 mb-4">
                  {generatedImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className="aspect-square rounded-xl overflow-hidden relative"
                    >
                      <Image
                        src={img.url}
                        alt={`generated ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSaveAndContinue}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl text-sm font-medium text-white mb-2 disabled:opacity-60 transition-opacity"
                  style={{ backgroundColor: section.color }}
                >
                  {saving ? '저장 중...' : '저장하고 다음 영역으로 →'}
                </button>
                <button
                  onClick={handleGenerateImages}
                  className="w-full py-3 rounded-xl text-sm border border-[#E5E3DF] bg-white text-[#6B7280] mb-3"
                >
                  이미지 다시 만들기
                </button>

                {/* 수정 메뉴 */}
                <button
                  onClick={() => { setEditMenu(!editMenu); setPendingConfirm(null); }}
                  className="w-full py-2 text-xs text-[#C9C5BE] text-center"
                >
                  {editMenu ? '닫기 ∧' : '더 수정하기 ∨'}
                </button>

                {editMenu && (
                  <div className="mt-2 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
                    {/* 스토리부터 */}
                    <div className="px-4 py-3 border-b border-[#F5F5F3]">
                      {pendingConfirm === 'situation' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">스토리와 이미지가 삭제돼요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditStory} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('situation')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">스토리부터 다시 쓰기</p>
                          <p className="text-xs text-[#9CA3AF]">이미지 삭제됨</p>
                        </button>
                      )}
                    </div>
                    {/* 장면부터 */}
                    <div className="px-4 py-3 border-b border-[#F5F5F3]">
                      {pendingConfirm === 'scene' ? (
                        <div className="rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                          <p className="text-xs text-[#92400E] mb-2">장면·스토리·이미지가 삭제돼요. 계속할까?</p>
                          <div className="flex gap-3">
                            <button onClick={handleEditScene} className="text-xs font-medium text-[#92400E]">계속</button>
                            <button onClick={() => setPendingConfirm(null)} className="text-xs text-[#9CA3AF]">취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPendingConfirm('scene')} className="w-full text-left">
                          <p className="text-sm text-[#374151]">장면부터 다시</p>
                          <p className="text-xs text-[#9CA3AF]">스토리·이미지 삭제됨</p>
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
            ) : (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-5 text-center">
                {imageError === 'missing_key' ? (
                  <>
                    <p className="text-sm text-[#6B7280] mb-1">이미지 생성 기능을 준비 중이에요.</p>
                    <p className="text-xs text-[#9CA3AF] mb-4">글로만 저장하고 계속할 수 있어요.</p>
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
            )}
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && generatedImages[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden">
            <Image
              src={generatedImages[lightboxIndex].url}
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
