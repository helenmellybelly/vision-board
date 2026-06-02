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

  function handleAnswer(text: string) {
    if (!section || qIdx >= 4) return;
    setShowHelp(false);
    const key = section.phaseOneQuestions[qIdx].key;
    const newAnswers = { ...answers, [key]: text };
    setAnswers(newAnswers);
    saveExtractedSlots(sectionId, newAnswers);
    const nextIdx = qIdx + 1;
    if (nextIdx >= 4) {
      setPhase('review');
    }
    setQIdx(nextIdx);
    setBoard(loadBoard());
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

  // Derive message list from current state
  type MsgItem = { type: 'lumi' | 'user'; text: string };
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
    if (ans) msgs.push({ type: 'user', text: ans });
  }

  if (phase === 'questions' && qIdx < 4) {
    const q = section.phaseOneQuestions[qIdx];
    msgs.push({ type: 'lumi', text: q.cushionText });
    msgs.push({ type: 'lumi', text: q.questionText });
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs text-[#9CA3AF] py-1"
        >
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {msgs.map((msg, i) => (
          <ChatBubble
            key={i}
            role={msg.type === 'lumi' ? 'assistant' : 'user'}
            content={msg.text}
          />
        ))}

        {currentQ && (
          <>
            <InlineInput
              onSubmit={handleAnswer}
              placeholder={currentQ.placeholder}
              example={currentExample}
              hint={currentQ.key === 'want' ? '여러 개여도 좋아. 줄 바꿔서 써봐.' : undefined}
              onHelp={helpQs.length > 0 ? () => setShowHelp(true) : undefined}
            />
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
          </>
        )}

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
                    <div key={q.key} className="flex gap-3 px-4 py-2.5">
                      <p className="text-[11px] text-[#9CA3AF] w-20 shrink-0 pt-0.5 font-medium">
                        {q.label}
                      </p>
                      <p className="text-sm leading-relaxed flex-1 text-[#1C1B19]">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>
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
  );
}
