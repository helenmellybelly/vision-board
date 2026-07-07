'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSection } from '@/lib/questions';
import {
  loadBoard,
  saveMiniStory,
  saveSituationText,
} from '@/lib/storage';
import { SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import { renderStory, BOLD_EDIT_HINT } from '@/components/StoryModal';

type Step = 'situation' | 'story';
const STEP_ORDER: Step[] = ['situation', 'story'];
const STEP_LABELS: Record<Step, string> = {
  situation: '① 순간',
  story: '② 스토리',
};

export default function MomentPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState(loadBoard());
  const [step, setStep] = useState<Step>('situation');

  const [situationInput, setSituationInput] = useState('');
  const [submittedSituation, setSubmittedSituation] = useState('');

  const [story, setStory] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);
  const [additionalInput, setAdditionalInput] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [usedAdditional, setUsedAdditional] = useState(false);

  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');

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
    if (sec.miniStory || sec.situationText) setStep('story');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [step, story, storyLoading]);

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

  if (!section) return null;

  const chips = section.situationChips ?? [];
  const stepIndex = STEP_ORDER.indexOf(step);
  const sectionName = section.title.split(' — ')[0];

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
          <span className="font-semibold text-body">{sectionName} · 순간</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-caption text-[#6E6962] py-1">
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
                    className="text-micro font-medium whitespace-nowrap px-1"
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
          content="미래의 하루까지 그렸으니, 이제 그 삶에서 보고 싶은 구체적인 순간들을 떠올려볼게."
        />
        <ChatBubble
          role="assistant"
          content="이 삶에서 어떤 장면들이 눈에 들어와? 공간, 사람, 상황, 물건 — 뭐든 괜찮아."
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
                    className="text-caption px-3 py-1.5 rounded-full border border-[#E5E3DF] bg-white text-[#6B7280] active:opacity-70"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={situationInput}
              onChange={(e) => setSituationInput(e.target.value)}
              placeholder="여러 줄로 써도 좋아. 구체적일수록 이미지가 선명해져."
              className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-body leading-relaxed resize-none focus:outline-none focus:border-[#C9C5BE] mb-3"
              rows={4}
            />
            <button
              onClick={handleSituationSubmit}
              disabled={!situationInput.trim()}
              className="w-full py-3.5 rounded-xl text-body font-medium text-white transition-opacity disabled:opacity-40"
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
        {step === 'story' && (
          <>
            {storyLoading ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4">
                <p className="text-caption text-[#6E6962] mb-2">잠깐, 하루를 그려볼게...</p>
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse" />
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse mt-2 w-3/4" />
              </div>
            ) : story ? (
              <>
                <div
                  className="mt-3 rounded-2xl border px-4 py-4 mb-3"
                  style={{ borderColor: section.color + '30', backgroundColor: section.color + '08' }}
                >
                  <p className="text-micro font-semibold uppercase tracking-wide mb-2" style={{ color: section.color }}>
                    이 삶의 하루
                  </p>
                  {editingStory ? (
                    <>
                      <textarea
                        value={storyDraft}
                        onChange={(e) => setStoryDraft(e.target.value)}
                        rows={10}
                        autoFocus
                        className="w-full text-body leading-relaxed rounded-xl border border-[#E5E3DF] bg-white px-3 py-2.5 resize-none focus:outline-none focus:border-[#C9C5BE]"
                      />
                      <p className="text-micro text-[#C9C5BE] mt-1 mb-2">{BOLD_EDIT_HINT}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = storyDraft.trim();
                            if (!next) return;
                            setStory(next);
                            saveMiniStory(sectionId, next);
                            setEditingStory(false);
                          }}
                          disabled={!storyDraft.trim()}
                          className="flex-1 py-2 rounded-lg text-caption font-semibold text-white disabled:opacity-40"
                          style={{ backgroundColor: section.color }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingStory(false)}
                          className="px-4 py-2 rounded-lg text-caption text-[#6E6962] border border-[#E5E3DF]"
                        >
                          취소
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-body leading-relaxed">{renderStory(story)}</p>
                  )}
                </div>

                {!editingStory && (
                  <button
                    onClick={() => { setStoryDraft(story); setEditingStory(true); setShowAdditional(false); }}
                    className="text-caption text-[#6E6962] underline mb-3 mr-4"
                  >
                    직접 수정하기
                  </button>
                )}

                {editingStory ? null : !usedAdditional && !showAdditional ? (
                  <button
                    onClick={() => setShowAdditional(true)}
                    className="text-caption text-[#6E6962] underline mb-3"
                  >
                    더 담고 싶은 장면이 있어요
                  </button>
                ) : showAdditional ? (
                  <div className="mb-3">
                    <textarea
                      value={additionalInput}
                      onChange={(e) => setAdditionalInput(e.target.value)}
                      placeholder="예: 친구와 저녁 먹는 장면, 아침 커피 한 잔..."
                      className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-body leading-relaxed resize-none focus:outline-none focus:border-[#C9C5BE] mb-2"
                      rows={2}
                    />
                    <button
                      onClick={handleRegenerate}
                      disabled={!additionalInput.trim() || regenerating}
                      className="w-full py-3 rounded-xl text-body border border-[#E5E3DF] bg-white text-[#374151] disabled:opacity-40"
                    >
                      {regenerating ? '다시 그리는 중...' : '다시 그려줘'}
                    </button>
                  </div>
                ) : null}

                <button
                  onClick={() => router.push(`/scenes/${sectionId}`)}
                  className="w-full py-3.5 rounded-xl text-body font-medium text-white mb-3"
                  style={{ backgroundColor: section.color }}
                >
                  비전보드 이미지 만들기 →
                </button>
              </>
            ) : null}
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
