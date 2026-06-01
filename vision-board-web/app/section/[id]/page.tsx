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

function getEun(name: string): string {
  if (!name) return '은';
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return '은';
  return (code - 0xAC00) % 28 === 0 ? '는' : '은';
}

function fillTemplate(template: string, answers: Partial<ExtractedSlots>, name: string): string {
  const eun = getEun(name);
  return template
    .replace(/\{name\}/g, name || '너')
    .replace(/\{eun\}/g, eun)
    .replace(/\{current\}/g, answers.current || '—')
    .replace(/\{want\}/g, answers.want || '—')
    .replace(/\{feeling\}/g, answers.feeling || '—')
    .replace(/\{keyword\}/g, answers.keyword || '—');
}

export default function SectionChatPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Partial<ExtractedSlots>>({});
  const [phase, setPhase] = useState<Phase>('questions');
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

  // Derive message list from current state
  type MsgItem = { type: 'lumi' | 'user'; text: string };
  const msgs: MsgItem[] = [
    { type: 'lumi', text: section.introText },
    { type: 'lumi', text: section.whyText },
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

  const currentQ = phase === 'questions' && qIdx < 4 ? section.phaseOneQuestions[qIdx] : null;
  const reviewText = fillTemplate(section.reviewTemplate, answers, board.userName);

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
          <InlineInput
            onSubmit={handleAnswer}
            placeholder={currentQ.placeholder}
          />
        )}

        {phase === 'review' && (
          <div className="mt-4 mb-2">
            <div className="bg-[#F5F5F3] rounded-2xl p-5 mb-4">
              <p className="text-[11px] text-[#9CA3AF] font-semibold mb-3 uppercase tracking-wide">
                지금까지 말해준 것들
              </p>
              <p className="text-sm leading-relaxed text-[#1C1B19]">{reviewText}</p>
            </div>
            <button
              onClick={handleComplete}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white active:opacity-80"
            >
              원하는 삶을 그려보자 →
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full mt-2 py-3 rounded-xl text-sm text-[#6B7280] border border-[#E5E3DF] active:opacity-70"
            >
              다른 섹션 먼저 하기
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
