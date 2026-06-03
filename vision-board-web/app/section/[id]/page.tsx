'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveExtractedSlots, markSectionTextComplete } from '@/lib/storage';
import { SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';

type Phase = 'questions' | 'review';

const Q_KEYS: Array<keyof ExtractedSlots> = ['current', 'want', 'feeling', 'keyword'];
const KEY_TO_SLOT_ID: Record<string, number> = { current: 1, want: 3, feeling: 5, keyword: 2 };

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

  // 인라인 수정 (질문 단계 중 기존 답변 수정)
  const [inlineEditIdx, setInlineEditIdx] = useState<number | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  // 리뷰 단계 수정
  const [editingKey, setEditingKey] = useState<keyof ExtractedSlots | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showDownstreamWarning, setShowDownstreamWarning] = useState(false);

  const [savedIndicator, setSavedIndicator] = useState(false);
  const [chatHovered, setChatHovered] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qIdx, phase]);

  function showSaved() {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }

  function handleAnswer(text: string) {
    if (!section || qIdx >= 4) return;
    setShowHelp(false);
    const key = section.phaseOneQuestions[qIdx].key;
    const newAnswers = { ...answers, [key]: text };
    setAnswers(newAnswers);
    saveExtractedSlots(sectionId, newAnswers);
    showSaved();
    const nextIdx = qIdx + 1;
    if (nextIdx >= 4) setPhase('review');
    setQIdx(nextIdx);
    setBoard(loadBoard());
  }

  function handleInlineEditSave() {
    if (inlineEditIdx === null || !section) return;
    const trimmed = inlineEditValue.trim();
    if (!trimmed) return;
    const key = section.phaseOneQuestions[inlineEditIdx].key;
    const newAnswers = { ...answers, [key]: trimmed };
    setAnswers(newAnswers);
    saveExtractedSlots(sectionId, newAnswers);
    showSaved();
    setBoard(loadBoard());
    setInlineEditIdx(null);
    setInlineEditValue('');
  }

  function handleSaveEdit(key: keyof ExtractedSlots) {
    if (!editValue.trim()) return;
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

  if (!section || !board) return null;

  const currentQ = phase === 'questions' && qIdx < 4 ? section.phaseOneQuestions[qIdx] : null;
  const currentSlotId = currentQ ? KEY_TO_SLOT_ID[currentQ.key] : null;
  const helpQs = currentSlotId
    ? (section.slots.find((s) => s.id === currentSlotId)?.helpQuestions ?? [])
    : [];
  const currentExample = currentSlotId
    ? (section.slots.find((s) => s.id === currentSlotId)?.example ?? '')
    : '';

  const msgs: MsgItem[] = [
    { type: 'lumi', text: section.introText },
    { type: 'lumi', text: section.whyText },
    { type: 'lumi', text: '천천히, 떠오르는 대로 답해줘. 틀린 답은 없어.' },
  ];

  const displayCount = Math.min(qIdx, 4);
  for (let i = 0; i < displayCount; i++) {
    const q = section.phaseOneQuestions[i];
    msgs.push({ type: 'lumi', text: q.cushionText });
    msgs.push({ type: 'lumi', text: q.questionText });
    const ans = answers[q.key];
    if (ans) msgs.push({ type: 'user', text: ans, qIndex: i });
  }

  if (phase === 'questions' && qIdx < 4) {
    const q = section.phaseOneQuestions[qIdx];
    msgs.push({ type: 'lumi', text: q.cushionText });
    msgs.push({ type: 'lumi', text: q.questionText });
  }

  const scrollClass = chatHovered ? 'scroll-show' : 'scroll-hide';

  return (
    <div className="h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-lg text-[#9CA3AF] pr-1 leading-none"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
        </div>
        <div className="flex items-center gap-3">
          {savedIndicator && (
            <span className="text-[11px] text-[#9CA3AF] animate-fadeIn">✓ 저장됨</span>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-[#9CA3AF] py-1"
          >
            대시보드로
          </button>
        </div>
      </header>

      {/* 스크롤 가능한 채팅 영역 */}
      <div
        ref={bottomRef as React.RefObject<HTMLDivElement>}
        className={`flex-1 overflow-y-auto ${scrollClass} px-4 pt-4 pb-2`}
        onMouseEnter={() => setChatHovered(true)}
        onMouseLeave={() => setChatHovered(false)}
      >
        {/* bottomRef를 이 div 안 끝에 따로 둬야 해서 내부 div로 분리 */}
        <div>
          {msgs.map((msg, i) => {
            if (msg.type === 'user') {
              const isEditing = inlineEditIdx === msg.qIndex;
              return (
                <div key={i} className="flex flex-col items-end mb-1">
                  {isEditing ? (
                    <div className="w-full mb-2">
                      <textarea
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-[#C9C5BE]"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-3 mt-1.5 justify-end">
                        <button
                          onClick={handleInlineEditSave}
                          className="text-xs font-semibold text-[#1C1B19] px-3 py-1 rounded-lg bg-[#1C1B19] text-white"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => { setInlineEditIdx(null); setInlineEditValue(''); }}
                          className="text-xs text-[#9CA3AF]"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <button
                        onClick={() => { setInlineEditIdx(msg.qIndex); setInlineEditValue(msg.text); }}
                        className="text-[10px] text-[#C9C5BE] mb-1 shrink-0 active:text-[#9CA3AF]"
                      >
                        수정
                      </button>
                      <ChatBubble role="user" content={msg.text} />
                    </div>
                  )}
                </div>
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
                    className="text-[11px] font-semibold uppercase tracking-wide"
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
                      <div key={q.key} className="px-4 py-2.5">
                        <div className="flex gap-3">
                          <p className="text-[11px] text-[#9CA3AF] w-20 shrink-0 pt-0.5 font-medium">
                            {q.label}
                          </p>
                          {editingKey === q.key ? (
                            <div className="flex-1">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full text-sm rounded-xl border border-[#E5E3DF] px-3 py-2 resize-none focus:outline-none focus:border-[#C9C5BE] leading-relaxed"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-3 mt-1.5">
                                <button
                                  onClick={() => handleSaveEdit(q.key)}
                                  className="text-xs font-semibold text-[#1C1B19]"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => setEditingKey(null)}
                                  className="text-xs text-[#9CA3AF]"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-start justify-between gap-2">
                              <p className="text-sm leading-relaxed text-[#1C1B19]">{val}</p>
                              <button
                                onClick={() => { setEditingKey(q.key); setEditValue(val); setShowDownstreamWarning(false); }}
                                className="text-[10px] text-[#C9C5BE] shrink-0 pt-0.5 active:text-[#9CA3AF]"
                              >
                                수정
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {showDownstreamWarning && (
                <div className="rounded-xl bg-[#FEF9C3] px-4 py-3 mb-4">
                  <p className="text-xs text-[#92400E] mb-2">
                    답변이 바뀌었으니, 이전에 만든 장면과 이미지도 다시 만들어보는 게 좋을 것 같아요.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/scene/${sectionId}`)}
                      className="text-xs font-semibold text-[#92400E]"
                    >
                      지금 다시 만들기
                    </button>
                    <button
                      onClick={() => setShowDownstreamWarning(false)}
                      className="text-xs text-[#9CA3AF]"
                    >
                      나중에
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white active:opacity-80"
              >
                원하는 삶을 그려보자 →
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full mt-3 py-2 text-xs text-[#C9C5BE] text-center active:opacity-70"
              >
                다른 섹션 먼저 할게
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 입력창 고정 바텀 패널 (질문 단계에서만) */}
      {currentQ && (
        <div className="shrink-0 border-t border-[#F5F5F3] bg-[#FAF9F7] px-4 pt-3 pb-4">
          {showHelp && (
            <div className="mb-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                이런 각도로 생각해봐
              </p>
              <div className="space-y-1.5">
                {helpQs.map((hq) => (
                  <p key={hq.id} className="text-xs text-[#6B7280] leading-relaxed">
                    ○ {hq.text}
                  </p>
                ))}
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-xs text-[#9CA3AF] mt-2.5 block"
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
          />
        </div>
      )}
    </div>
  );
}
