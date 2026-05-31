'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSceneChat, saveSectionScene, markSectionComplete } from '@/lib/storage';
import { ChatMessage, SectionId, BoardData } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import ChatInput from '@/components/ChatInput';

export default function SceneChatPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenePhase, setScenePhase] = useState<'chatting' | 'confirming' | 'done'>('chatting');
  const [sceneText, setSceneText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];
    if (sec.sceneMessages && sec.sceneMessages.length > 0) {
      setMessages(sec.sceneMessages);
      if (sec.sceneText) {
        setSceneText(sec.sceneText);
        setScenePhase('done');
      }
    } else {
      fetchLumiMessage([], b);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

  async function fetchLumiMessage(currentMessages: ChatMessage[], currentBoard: BoardData) {
    if (!section) return;
    setIsLoading(true);
    const sec = currentBoard.sections[sectionId];
    const slots = sec.extractedSlots || {};

    try {
      const res = await fetch('/api/chat/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section.title,
          sectionAnswers: {
            keyword: slots.keyword || sec.slots[2]?.text,
            want: slots.want || sec.slots[3]?.text,
            feeling: slots.feeling || sec.slots[5]?.text,
          },
          messages: currentMessages,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const lumiMsg: ChatMessage = { role: 'assistant', content: data.message };
      const newMessages = [...currentMessages, lumiMsg];
      setMessages(newMessages);
      setScenePhase(data.phase || 'chatting');
      if (data.sceneText) setSceneText(data.sceneText);

      saveSceneChat(sectionId, newMessages);
      if (data.sceneText) saveSectionScene(sectionId, data.sceneText);
      setBoard(loadBoard());
    } catch {
      const errMsg: ChatMessage = { role: 'assistant', content: '잠깐, 다시 시도해볼게.' };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUserMessage(text: string) {
    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveSceneChat(sectionId, newMessages);
    if (board) await fetchLumiMessage(newMessages, board);
  }

  function handleSceneDone() {
    markSectionComplete(sectionId);
    const freshBoard = loadBoard();
    const allCompleted = ([1, 2, 3, 4, 5, 6] as SectionId[]).every(
      (id) => freshBoard.sections[id].status === 'completed'
    );
    router.push(allCompleted ? '/board' : '/dashboard');
  }

  if (!section || !board) return null;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]} · 장면</span>
        </div>
        <button onClick={() => router.push('/review')} className="text-xs text-[#9CA3AF] py-1">
          목록으로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <ChatBubble role="assistant" content="" isLoading />}

        {scenePhase === 'confirming' && !isLoading && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleUserMessage('맞아, 딱 이 장면이야!')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
            >
              맞아, 이 장면이야!
            </button>
            <button
              onClick={() => handleUserMessage('좀 더 추가하고 싶어')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E3DF] text-[#6B7280]"
            >
              더 추가할게
            </button>
          </div>
        )}

        {scenePhase === 'done' && !isLoading && (
          <div className="mt-3 space-y-3">
            {sceneText && (
              <div className="bg-[#F5F5F3] rounded-xl p-4">
                <p className="text-xs text-[#9CA3AF] mb-1.5">완성된 장면</p>
                <p className="text-sm leading-relaxed">{sceneText}</p>
              </div>
            )}
            <button
              onClick={handleSceneDone}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
            >
              {board && ([1,2,3,4,5,6] as SectionId[]).filter(id => id !== sectionId).every(id => board.sections[id].status === 'completed')
                ? '비전보드 완성하기 →'
                : '대시보드로 돌아가기'}
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {scenePhase === 'chatting' && (
        <ChatInput onSend={handleUserMessage} disabled={isLoading} />
      )}
    </div>
  );
}
