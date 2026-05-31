'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import {
  loadBoard,
  saveSectionChat,
  saveExtractedSlots,
  markSectionTextComplete,
} from '@/lib/storage';
import { ChatMessage, SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import { getCurrentStep } from '@/lib/helpContent';
import { STEP_PLACEHOLDERS } from '@/lib/placeholders';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';

type ChatPhase = 'chatting' | 'mirroring' | 'done' | 'confirmed';

const MAX_HELP_PER_STEP = 2;

export default function SectionChatPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [extractedSlots, setExtractedSlots] = useState<ExtractedSlots>({});
  const [phase, setPhase] = useState<ChatPhase>('chatting');
  const [isLoading, setIsLoading] = useState(false);
  const [helpClickCount, setHelpClickCount] = useState(0);
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef<number>(0);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];
    if (sec.chatMessages && sec.chatMessages.length > 0) {
      setMessages(sec.chatMessages);
      if (sec.extractedSlots) setExtractedSlots(sec.extractedSlots);
      if (sec.status === 'text_complete' || sec.status === 'completed') {
        setPhase('confirmed');
      }
    } else {
      fetchLumiMessage([], {}, b.userName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // 스텝이 바뀌면 도움 카운트 리셋
  useEffect(() => {
    const step = getCurrentStep(extractedSlots);
    if (step !== prevStepRef.current) {
      prevStepRef.current = step;
      setHelpClickCount(0);
      setShowHelpPanel(false);
    }
  }, [extractedSlots]);

  async function fetchLumiMessage(currentMessages: ChatMessage[], currentSlots: ExtractedSlots, userName?: string) {
    if (!section) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          sectionTitle: section.title,
          sectionSubtitle: section.subtitle,
          userName: userName ?? board?.userName ?? '',
          messages: currentMessages,
          extractedSlots: currentSlots,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      // messages[] 배열 또는 구버전 message 단일 문자열 호환
      const rawMsgs: string[] = Array.isArray(data.messages)
        ? data.messages
        : data.message
        ? [data.message]
        : [];

      setIsLoading(false);

      // 말풍선을 300ms 간격으로 순서대로 추가
      let accumulated = [...currentMessages];
      for (let i = 0; i < rawMsgs.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 300));
        const msg: ChatMessage = { role: 'assistant', content: rawMsgs[i] };
        accumulated = [...accumulated, msg];
        setMessages([...accumulated]);
      }

      const newSlots = data.extractedSlots || currentSlots;
      setExtractedSlots(newSlots);
      setPhase(data.phase || 'chatting');

      saveSectionChat(sectionId, accumulated);
      if (data.extractedSlots) saveExtractedSlots(sectionId, data.extractedSlots);
      setBoard(loadBoard());
    } catch {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: '잠깐, 연결이 좀 느린 것 같아. 다시 시도해볼게.',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUserMessage(text: string) {
    setShowHelpPanel(false);
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveSectionChat(sectionId, newMessages);
    await fetchLumiMessage(newMessages, extractedSlots);
  }

  function handleHelpButtonClick() {
    setHelpClickCount((c) => c + 1);
    setShowHelpPanel(true);
  }

  function handleNextSection() {
    markSectionTextComplete(sectionId);
    setPhase('confirmed');
    const freshBoard = loadBoard();
    const allTextDone = ([1, 2, 3, 4, 5, 6] as SectionId[]).every(
      (id) => freshBoard.sections[id].status === 'text_complete' || freshBoard.sections[id].status === 'completed'
    );
    if (allTextDone) {
      router.push('/review');
      return;
    }
    const next = ([1, 2, 3, 4, 5, 6] as SectionId[]).find(
      (id) =>
        id > sectionId &&
        (freshBoard.sections[id].status === 'not_started' || freshBoard.sections[id].status === 'in_progress')
    );
    router.push(next ? `/section/${next}` : '/dashboard');
  }

  function handleGoToScene() {
    markSectionTextComplete(sectionId);
    router.push(`/scene/${sectionId}`);
  }

  if (!section || !board) return null;

  const currentStep = getCurrentStep(extractedSlots);
  const STEP_TO_SLOT_ID: Record<1|2|3|4, number> = { 1: 1, 2: 3, 3: 5, 4: 2 };
  const currentSlot = section.slots.find(s => s.id === STEP_TO_SLOT_ID[currentStep]);
  const helpContent = {
    alternativeQuestions: currentSlot?.helpQuestions.map(h => h.text) ?? [],
    exampleAnswers: currentSlot?.example ? currentSlot.example.split(' / ') : [],
  };
  const showHelpButton =
    phase === 'chatting' &&
    !isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    helpClickCount < MAX_HELP_PER_STEP;

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
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <ChatBubble role="assistant" content="" isLoading />}

        {/* 미러링 확인 버튼 */}
        {phase === 'mirroring' && !isLoading && (
          <div className="flex gap-2 mt-3 mb-1">
            <button
              onClick={() => handleUserMessage('맞아, 딱 내 얘기야!')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white active:opacity-80"
            >
              맞아, 딱 내 얘기야!
            </button>
            <button
              onClick={() => handleUserMessage('조금 달라, 다시 말해볼게')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E3DF] text-[#6B7280] active:opacity-80"
            >
              조금 달라
            </button>
          </div>
        )}

        {/* 인라인 입력창 */}
        {phase === 'chatting' && !isLoading && (
          <InlineInput
            onSubmit={handleUserMessage}
            placeholder={STEP_PLACEHOLDERS[currentStep]}
            disabled={isLoading}
            onHelp={handleHelpButtonClick}
            showHelp={showHelpButton}
          />
        )}

        {/* 도움 패널 (InlineInput 아래) */}
        {showHelpPanel && (
          <div className="mb-3 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">이런 방식으로 물어볼게</p>
              {helpContent.alternativeQuestions.map((q, i) => (
                <p key={i} className="text-xs text-[#6B7280] leading-relaxed mb-1 before:content-['○'] before:mr-1.5 before:text-[#C9C5BE]">
                  {q}
                </p>
              ))}
            </div>
            <div className="px-4 pt-2 pb-4">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">이런 식으로 써봐도 돼</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {helpContent.exampleAnswers.map((ex, i) => (
                  <p key={i} className="text-xs text-[#6B7280]">{ex}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 완료 버튼 */}
        {phase === 'done' && !isLoading && (
          <div className="mt-4 mb-2 space-y-3">
            <p className="text-xs text-center text-[#9CA3AF]">{sectionId}/6 섹션 완료 ✓</p>
            <div>
              <button
                onClick={handleGoToScene}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white active:opacity-80"
              >
                장면 바로 그려가기
              </button>
              <p className="text-xs text-center text-[#9CA3AF] mt-1.5">
                방금 쓴 내용으로 비전 장면을 바로 써볼 수 있어
              </p>
            </div>
            <div>
              <button
                onClick={handleNextSection}
                className="w-full py-3 rounded-xl text-sm text-[#6B7280] border border-[#E5E3DF] active:opacity-70"
              >
                다른 섹션 질문 시작하기
              </button>
              <p className="text-xs text-center text-[#9CA3AF] mt-1.5">
                나머지 섹션 먼저 쓰고 장면은 나중에 한꺼번에
              </p>
            </div>
          </div>
        )}

        {/* 이미 완료된 섹션 */}
        {phase === 'confirmed' && (
          <div className="mt-3 p-4 bg-[#F5F5F3] rounded-xl text-center">
            <p className="text-sm text-[#6B7280]">이 섹션은 완료됐어. ✓</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 text-sm font-semibold text-[#1C1B19]"
            >
              대시보드로 돌아가기
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

    </div>
  );
}
