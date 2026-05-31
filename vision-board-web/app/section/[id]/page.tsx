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
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import ChatInput from '@/components/ChatInput';

type ChatPhase = 'chatting' | 'mirroring' | 'done' | 'confirmed';

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
  const bottomRef = useRef<HTMLDivElement>(null);

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
      fetchLumiMessage([], {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  async function fetchLumiMessage(currentMessages: ChatMessage[], currentSlots: ExtractedSlots) {
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
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveSectionChat(sectionId, newMessages);
    await fetchLumiMessage(newMessages, extractedSlots);
  }

  function handleConfirm() {
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

  if (!section || !board) return null;

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

        {/* 질문 어려울 때 도움 버튼 */}
        {phase === 'chatting' && !isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <div className="flex justify-start mt-1 mb-2 ml-10">
            <button
              onClick={() => handleUserMessage('잘 모르겠어 😅')}
              className="px-3 py-1.5 rounded-full text-xs text-[#9CA3AF] bg-[#F5F5F3] border border-[#E5E3DF] active:opacity-70"
            >
              잘 모르겠어 😅
            </button>
          </div>
        )}

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

        {/* 완료 버튼 */}
        {phase === 'done' && !isLoading && (
          <button
            onClick={handleConfirm}
            className="w-full mt-3 py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white active:opacity-80"
          >
            다음 섹션으로 →
          </button>
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

      {phase === 'chatting' && (
        <ChatInput onSend={handleUserMessage} disabled={isLoading} />
      )}
    </div>
  );
}
