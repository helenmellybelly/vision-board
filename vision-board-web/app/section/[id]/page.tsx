'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveExtractedSlots, markSectionTextComplete } from '@/lib/storage';
import { validateAnswer, validateAll, AnswerKey } from '@/lib/answerValidation';
import { SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';
import { Fragment } from 'react';

type Phase = 'questions' | 'review';

const Q_KEYS: Array<keyof ExtractedSlots> = ['current', 'want', 'feeling', 'keyword'];

type MsgItem =
  | { type: 'lumi'; text: string }
  | { type: 'user'; text: string; qIndex: number };

export default function SectionChatPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Partial<ExtractedSlots>>({});
  const [phase, setPhase] = useState<Phase>('questions');
  const [showHelp, setShowHelp] = useState(false);

  // 리뷰 단계 수정
  const [editingKey, setEditingKey] = useState<keyof ExtractedSlots | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showDownstreamWarning, setShowDownstreamWarning] = useState(false);

  // 답변 검증 (v6.19)
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [reviewErrors, setReviewErrors] = useState<Partial<Record<AnswerKey, string>>>({});
  const [aiChecking, setAiChecking] = useState(false);

  const [savedIndicator, setSavedIndicator] = useState(false);
  const [chatHovered, setChatHovered] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];
    if (sec.extractedSlots && Object.keys(sec.extractedSlots).length > 0) {
      const existing = sec.extractedSlots;
      setAnswers(existing);
      const doneCount = Q_KEYS.filter((k) => existing[k]).length;
      if (sec.status === 'text_complete' || sec.status === 'completed' || doneCount >= 4) {
        setQIdx(4);
        setPhase('review');
      } else {
        setQIdx(doneCount);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [qIdx, phase]);

  function showSaved() {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }

  function handleAnswer(text: string): boolean {
    if (!section || qIdx >= 4) return false;
    const key = section.phaseOneQuestions[qIdx].key;
    const result = validateAnswer(key, text);
    if (!result.valid) {
      setAnswerError(result.message ?? null);
      return false;
    }
    setAnswerError(null);
    setShowHelp(false);
    const newAnswers = { ...answers, [key]: text };
    setAnswers(newAnswers);
    saveExtractedSlots(sectionId, newAnswers);
    showSaved();
    const nextIdx = qIdx + 1;
    if (nextIdx >= 4) setPhase('review');
    setQIdx(nextIdx);
    setBoard(loadBoard());
    return true;
  }

  function handleSaveEdit(key: keyof ExtractedSlots) {
    if (!editValue.trim()) return;
    const result = validateAnswer(key, editValue.trim());
    if (!result.valid) {
      setEditError(result.message ?? null);
      return;
    }
    setEditError(null);
    setReviewErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const updated = { ...answers, [key]: editValue.trim() };
    setAnswers(updated);
    saveExtractedSlots(sectionId, updated);
    showSaved();
    setBoard(loadBoard());
    setEditingKey(null);
    const sec = board?.sections[sectionId];
    if (sec?.sceneText || (sec?.generatedImages && sec.generatedImages.length > 0)) {
      setShowDownstreamWarning(true);
    }
  }

  function handleComplete() {
    markSectionTextComplete(sectionId);
    router.push(`/scene/${sectionId}`);
  }

  function exampleFor(key: keyof ExtractedSlots): string {
    return section?.phaseOneQuestions.find((q) => q.key === key)?.example ?? '';
  }

  function openFirstInvalidEdit(keys: AnswerKey[]) {
    const first = Q_KEYS.find((k) => keys.includes(k));
    if (first) {
      setEditingKey(first);
      setEditValue(answers[first] ?? '');
      setEditError(null);
      setShowDownstreamWarning(false);
    }
  }

  // 하이브리드 게이트: ① 규칙 검증(무료) → ② AI 의미 검증(실패 시 fail-open)
  async function handleProceed() {
    const failures = validateAll(answers);
    const failedKeys = Object.keys(failures) as AnswerKey[];
    if (failedKeys.length > 0) {
      const msgs: Partial<Record<AnswerKey, string>> = {};
      failedKeys.forEach((k) => {
        msgs[k] = failures[k]?.message ?? '다시 한번 써줄래?';
      });
      setReviewErrors(msgs);
      openFirstInvalidEdit(failedKeys);
      return;
    }

    setAiChecking(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch('/api/validate/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          items: Q_KEYS.map((k) => ({
            key: k,
            question: section?.phaseOneQuestions.find((q) => q.key === k)?.questionText ?? '',
            answer: answers[k] ?? '',
          })),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const invalid = Q_KEYS.filter((k) => data.results?.[k]?.valid === false);
        if (invalid.length > 0) {
          const msgs: Partial<Record<AnswerKey, string>> = {};
          invalid.forEach((k) => {
            msgs[k] = data.results[k]?.reason || '이 답변은 내가 이해하기 어려워. 다시 써줄래?';
          });
          setReviewErrors(msgs);
          openFirstInvalidEdit(invalid);
          setAiChecking(false);
          return;
        }
      }
      // res.ok가 아니면 인프라 문제 — 진행을 막지 않는다
    } catch {
      // 네트워크 오류/타임아웃 — 진행을 막지 않는다
    }
    setAiChecking(false);
    handleComplete();
  }

  if (!section || !board) return null;

  const currentQ = phase === 'questions' && qIdx < 4 ? section.phaseOneQuestions[qIdx] : null;
  const helpQs = currentQ?.helpQuestions ?? [];
  const currentExample = currentQ?.example ?? '';

  const msgs: MsgItem[] = [
    { type: 'lumi', text: section.introText },
    { type: 'lumi', text: section.whyText },
  ];

  const displayCount = Math.min(qIdx, 4);
  for (let i = 0; i < displayCount; i++) {
    const q = section.phaseOneQuestions[i];
    msgs.push({ type: 'lumi', text: `${q.cushionText}\n${q.questionText}` });
    const ans = answers[q.key];
    if (ans) msgs.push({ type: 'user', text: ans, qIndex: i });
  }

  if (phase === 'questions' && qIdx < 4) {
    const q = section.phaseOneQuestions[qIdx];
    msgs.push({ type: 'lumi', text: `${q.cushionText}\n${q.questionText}` });
  }

  const scrollClass = chatHovered ? 'scroll-show' : 'scroll-hide';

  return (
    <div className="h-dvh flex flex-col max-w-md md:max-w-xl mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="대시보드로 돌아가기"
            className="text-title text-[#6E6962] pr-1 leading-none"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-body">{section.title.split(' — ')[0]}</span>
        </div>
        <div className="flex items-center gap-3">
          {savedIndicator && (
            <span className="text-micro text-[#6E6962] animate-fadeIn">✓ 저장됨</span>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="text-caption text-[#6E6962] py-1"
          >
            대시보드로
          </button>
        </div>
      </header>

      {/* 스크롤 가능한 채팅 영역 */}
      <div
        ref={chatRef}
        className={`flex-1 overflow-y-auto ${scrollClass} px-4 pt-4 pb-2`}
        onMouseEnter={() => setChatHovered(true)}
        onMouseLeave={() => setChatHovered(false)}
      >
        <div>
          {msgs.map((msg, i) => {
            if (msg.type === 'user') {
              const msgKey = section.phaseOneQuestions[msg.qIndex].key;
              if (phase === 'questions' && editingKey === msgKey) {
                return (
                  <div key={i} className="mb-1">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full text-body rounded-xl border border-[#E5E3DF] px-3 py-2 resize-none focus:outline-none focus:border-[#C9C5BE] leading-relaxed"
                      rows={2}
                      autoFocus
                    />
                    {editError && (
                      <p className="text-caption text-[#B45309] mt-1">{editError}</p>
                    )}
                    <div className="flex gap-3 mt-1.5 justify-end">
                      <button
                        onClick={() => handleSaveEdit(msgKey)}
                        className="text-caption font-semibold text-[#1C1B19]"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setEditError(null); }}
                        className="text-caption text-[#6E6962]"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <Fragment key={i}>
                  <div className="flex flex-col items-end mb-1">
                    <ChatBubble role="user" content={msg.text} />
                    {phase === 'questions' && (
                      <button
                        onClick={() => { setEditingKey(msgKey); setEditValue(msg.text); setEditError(null); }}
                        className="text-micro text-[#6E6962] mt-0.5 pr-1 active:text-[#1C1B19]"
                      >
                        수정
                      </button>
                    )}
                  </div>
                </Fragment>
              );
            }
            return (
              <ChatBubble
                key={i}
                role="assistant"
                content={msg.text}
              />
            );
          })}

          {phase === 'review' && (
            <div className="mt-4 mb-2">
              <div className="rounded-2xl border border-[#E5E3DF] overflow-hidden mb-4">
                <div className="px-4 pt-3 pb-1" style={{ backgroundColor: section.lightColor }}>
                  <p
                    className="text-micro font-semibold uppercase tracking-wide"
                    style={{ color: section.color }}
                  >
                    지금까지 말해준 것들
                  </p>
                </div>
                <div className="bg-white divide-y divide-[#F3F4F6]">
                  {section.phaseOneQuestions.map((q) => {
                    const val = answers[q.key];
                    if (!val) return null;
                    return (
                      <div key={q.key} className="px-4 py-3">
                        <p className="text-micro font-medium" style={{ color: section.color }}>
                          {q.label}
                        </p>
                        <p className="text-caption text-[#6E6962] mt-0.5 leading-relaxed">
                          {q.questionText}
                        </p>
                        {editingKey === q.key ? (
                          <div className="mt-1.5">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full text-body rounded-xl border border-[#E5E3DF] px-3 py-2 resize-none focus:outline-none focus:border-[#C9C5BE] leading-relaxed"
                              rows={2}
                              autoFocus
                            />
                            {editError && (
                              <p className="text-caption text-[#B45309] mt-1">{editError}</p>
                            )}
                            {reviewErrors[q.key] && (
                              <p className="text-micro text-[#6E6962] mt-1 leading-relaxed">
                                예: {exampleFor(q.key)}
                              </p>
                            )}
                            <div className="flex gap-3 mt-1.5">
                              <button
                                onClick={() => handleSaveEdit(q.key)}
                                className="text-caption font-semibold text-[#1C1B19]"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => { setEditingKey(null); setEditError(null); }}
                                className="text-caption text-[#6E6962]"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-1.5 flex items-start justify-between gap-2">
                              <p className="text-body leading-relaxed text-[#1C1B19]">{val}</p>
                              <button
                                onClick={() => { setEditingKey(q.key); setEditValue(val); setEditError(null); setShowDownstreamWarning(false); }}
                                className="text-micro text-[#6E6962] shrink-0 pt-0.5 active:text-[#1C1B19]"
                              >
                                수정
                              </button>
                            </div>
                            {reviewErrors[q.key] && (
                              <div className="mt-2 rounded-xl bg-[#FEF9C3] px-3 py-2.5">
                                <p className="text-caption text-[#92400E]">{reviewErrors[q.key]}</p>
                                {exampleFor(q.key) && (
                                  <p className="text-micro text-[#92400E]/80 mt-1 leading-relaxed">
                                    예: {exampleFor(q.key)}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {showDownstreamWarning && (
                <div className="rounded-xl bg-[#FEF9C3] px-4 py-3 mb-4">
                  <p className="text-caption text-[#92400E] mb-2">
                    답변이 바뀌었으니, 이전에 그린 미래의 하루와 이미지도 다시 만들어보는 게 좋을 것 같아.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/scene/${sectionId}`)}
                      className="text-caption font-semibold text-[#92400E]"
                    >
                      지금 다시 만들기
                    </button>
                    <button
                      onClick={() => setShowDownstreamWarning(false)}
                      className="text-caption text-[#6E6962]"
                    >
                      나중에
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleProceed}
                disabled={aiChecking}
                className="w-full py-3.5 rounded-xl text-body font-semibold bg-[#1C1B19] text-white active:opacity-80 disabled:opacity-60"
              >
                {aiChecking ? '잠깐, 확인해볼게…' : '이 답들로 미래의 하루 그려보기 →'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full mt-3 py-2 text-caption text-[#C9C5BE] text-center active:opacity-70"
              >
                다른 섹션 먼저 할게
              </button>
            </div>
          )}

          <div />
        </div>
      </div>

      {/* 입력창 고정 바텀 패널 (질문 단계에서만) */}
      {currentQ && (
        <div className="shrink-0 border-t border-[#F5F5F3] bg-[#FAF9F7] px-4 pt-3 pb-4">
          {showHelp && (
            <div className="mb-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3">
              <p className="text-micro font-semibold text-[#6E6962] uppercase tracking-wide mb-2">
                이런 각도로 생각해봐
              </p>
              <div className="space-y-1.5">
                {helpQs.map((hq, i) => (
                  <p key={i} className="text-caption text-[#6B7280] leading-relaxed">
                    ○ {hq}
                  </p>
                ))}
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-caption text-[#6E6962] mt-2.5 block"
              >
                닫기
              </button>
            </div>
          )}
          <InlineInput
            onSubmit={handleAnswer}
            placeholder={currentQ.placeholder}
            example={currentExample}
            hint={currentQ.key === 'want' ? '여러 개여도 좋아. 줄 바꿔서 써봐.' : undefined}
            onHelp={helpQs.length > 0 ? () => setShowHelp(true) : undefined}
            error={answerError}
          />
          {/* 사진 먼저 경로 (v7.1-r4) — 답변은 도구일 뿐, 강제하지 않는다. 시각적으론 부차적(EAST) */}
          <button
            onClick={() => router.push(`/scenes/${sectionId}`)}
            className="w-full mt-2.5 py-1 text-caption text-[#C9C5BE] text-center active:opacity-70"
          >
            사진부터 고르고 싶어? 사진 먼저 담기 →
          </button>
        </div>
      )}
    </div>
  );
}
