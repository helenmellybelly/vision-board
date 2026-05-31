# v2.2 대화형 비전보드 전면 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬롯 칸 채우기 방식을 lumi와의 채팅 대화로 전면 교체하고, 장면 대화·온보딩 개선·미래 하루 스토리를 추가해 완성물(이미지보드 + 통합 1장 + 글)을 완성한다.

**Architecture:** 현행 라우트 뼈대(onboarding→dashboard→section/[id]→review→scene/[id]→board→finish)는 유지하되, section/[id]와 scene/[id]를 채팅 UI로 완전 교체. Anthropic API를 session 대화형으로 확장해 슬롯 추출·장면 캐묻기·스토리 생성 3개 엔드포인트를 추가. localStorage에 채팅 메시지·추출된 슬롯·스토리를 저장.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Anthropic SDK (`@anthropic-ai/sdk`), localStorage

---

## 현행 코드 변경 요약

| 파일 | 처리 |
|------|------|
| `app/section/[id]/SlotQuestion.tsx` | 삭제 |
| `app/section/[id]/PhaseReview.tsx` | 삭제 |
| `app/section/[id]/DeferredCheck.tsx` | 삭제 |
| `app/section/[id]/SectionComplete.tsx` | 삭제 |
| `app/section/[id]/PhaseScene.tsx` | 삭제 |
| `app/section/[id]/PhaseImages.tsx` | 삭제 |
| `app/section/[id]/page.tsx` | 전면 재작성 |
| `app/scene/[id]/page.tsx` | 전면 재작성 |
| `app/onboarding/page.tsx` | 수정 (효과성 체감 + 완성 미리보기 + 첫 질문) |
| `app/finish/page.tsx` | 수정 (패턴→한 문장→스토리→통합 이미지) |
| `components/ProcessBar.tsx` | 수정 (4 STEP → 새 구조) |
| `lib/types.ts` | 수정 (ChatMessage, 새 필드) |
| `lib/storage.ts` | 수정 (새 저장 함수) |

새로 생성:
- `components/ChatBubble.tsx`
- `components/ChatInput.tsx`
- `app/api/chat/section/route.ts`
- `app/api/chat/scene/route.ts`
- `app/api/story/route.ts`

---

## Task 1: 타입 + 스토리지 — 채팅 기반 데이터 구조

**Files:**
- Modify: `vision-board-web/lib/types.ts`
- Modify: `vision-board-web/lib/storage.ts`

### 1-1 types.ts 업데이트

- [ ] `lib/types.ts`를 아래로 교체

```typescript
export type SectionId = 1 | 2 | 3 | 4 | 5 | 6;
export type SlotId = 1 | 2 | 3 | 4 | 5 | 6;
export type SectionStatus = 'not_started' | 'in_progress' | 'text_complete' | 'completed';

export interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

// 채팅에서 추출된 슬롯 (내부 저장용)
export interface ExtractedSlots {
  current?: string;   // ① 지금 나는
  keyword?: string;   // ② 방향 키워드
  want?: string;      // ③ 원하는 것
  feeling?: string;   // ⑤ 이뤄졌을 때 기분
}

export interface SubQuestion {
  id: number;
  text: string;
}

export interface Slot {
  id: SlotId;
  mainQuestion: string;
  placeholder: string;
  example: string;
  helpQuestions: SubQuestion[];
  phase: 1 | 3 | 4;
}

export interface Section {
  id: SectionId;
  title: string;
  subtitle: string;
  color: string;
  lightColor: string;
  slots: Slot[];
  imageHints: string[];
  imageHintIntro: string;
}

export interface SlotAnswer {
  text: string;
  isDeferred: boolean;
  helpAnswers?: string[];
}

export interface SectionData {
  id: SectionId;
  status: SectionStatus;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentSlotIndex: number;
  slots: Record<SlotId, SlotAnswer | undefined>;
  chatMessages?: ChatMessage[];          // 섹션 채팅 기록
  extractedSlots?: ExtractedSlots;      // 채팅에서 추출된 슬롯
  sceneMessages?: ChatMessage[];         // 장면 대화 기록
  images: (string | null)[];
  sceneText?: string;
  sceneTexts?: string[];
  completedAt?: number;
}

export interface BoardData {
  sections: Record<SectionId, SectionData>;
  onboardingDone: boolean;
  userName: string;
  startedAt: number;
  finishedAt?: number;
  onboardingStep?: number;
  oneSentence?: string;          // 마무리 한 문장
  futureDayStory?: string;       // 미래의 하루 스토리
}

export const PHASE1_SLOTS: SlotId[] = [1, 3, 5, 2];
```

### 1-2 storage.ts 업데이트

- [ ] `lib/storage.ts` 하단에 아래 함수들 추가 (기존 함수 유지)

```typescript
export function saveSectionChat(sectionId: SectionId, messages: ChatMessage[]): void {
  const board = loadBoard();
  board.sections[sectionId].chatMessages = messages;
  if (board.sections[sectionId].status === 'not_started' && messages.length > 1) {
    board.sections[sectionId].status = 'in_progress';
  }
  saveBoard(board);
}

export function saveExtractedSlots(sectionId: SectionId, slots: ExtractedSlots): void {
  const board = loadBoard();
  board.sections[sectionId].extractedSlots = slots;
  // 하위 호환: 기존 �otAnswer 형식으로도 저장
  if (slots.current) board.sections[sectionId].slots[1] = { text: slots.current, isDeferred: false };
  if (slots.keyword) board.sections[sectionId].slots[2] = { text: slots.keyword, isDeferred: false };
  if (slots.want) board.sections[sectionId].slots[3] = { text: slots.want, isDeferred: false };
  if (slots.feeling) board.sections[sectionId].slots[5] = { text: slots.feeling, isDeferred: false };
  saveBoard(board);
}

export function saveSceneChat(sectionId: SectionId, messages: ChatMessage[]): void {
  const board = loadBoard();
  board.sections[sectionId].sceneMessages = messages;
  saveBoard(board);
}

export function saveOneSentence(sentence: string): void {
  const board = loadBoard();
  board.oneSentence = sentence;
  saveBoard(board);
}

export function saveFutureDayStory(story: string): void {
  const board = loadBoard();
  board.futureDayStory = story;
  saveBoard(board);
}
```

storage.ts 상단 import에 `ChatMessage, ExtractedSlots` 추가:
```typescript
import { BoardData, SectionData, SectionId, SlotAnswer, SlotId, ChatMessage, ExtractedSlots } from './types';
```

### 1-3 빌드 확인

- [ ] `cd vision-board-web && npm run build` 실행 후 TypeScript 에러 없음 확인

---

## Task 2: 섹션 채팅 API — `/api/chat/section`

**Files:**
- Create: `vision-board-web/app/api/chat/section/route.ts`

lumi가 4개 슬롯(현재/키워드/원하는것/기분)을 자연스러운 대화로 끌어내고, 모두 채워지면 미러링 후 완료한다. 응답은 JSON (`message`, `phase`, `extractedSlots`).

- [ ] `app/api/chat/section/route.ts` 생성

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export interface SectionChatRequest {
  sectionId: number;
  sectionTitle: string;
  messages: { role: 'assistant' | 'user'; content: string }[];
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

export interface SectionChatResponse {
  message: string;
  phase: 'chatting' | 'mirroring' | 'done';
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

const SYSTEM_PROMPT = `너는 lumi야. 사용자가 비전보드 한 섹션의 비전을 정리하도록 돕는 따뜻한 AI 친구야.

역할:
- 사용자와 자연스러운 카톡 톤의 대화를 한다. 짧고 따뜻하게.
- 내부적으로 4가지 정보를 대화 속에서 자연스럽게 끌어낸다:
  1. current: 지금 이 영역에서 어떤 상태인지
  2. keyword: 3년 뒤 원하는 방향/느낌 (한 단어 또는 짧은 표현)
  3. want: 이루고 싶은 것들 (버킷리스트)
  4. feeling: 그게 이뤄졌을 때 기분/상태

원칙:
- 한 번에 한 질문만. 짧게.
- 사용자 답에 1-2줄 공감 후 다음 질문으로 자연스럽게 이어간다.
- "①번 질문합니다" 같은 라벨 절대 노출 금지.
- 막히면 답을 주지 말고 "예를 들면..." 또는 "혹시 ~한 경험 있어?" 식으로 사다리 질문.
- 진단·평가·조언 금지. 거울처럼 반영만.
- 4가지가 다 모이면 사용자 단어 그대로 요약해서 "이런 거 맞아?" 확인 후 phase를 mirroring으로.
- 사용자가 "맞아" 또는 긍정 반응하면 phase를 done으로.

반드시 아래 JSON만 출력 (다른 텍스트 없이):
{
  "message": "lumi의 메시지 (사용자에게 보이는 텍스트)",
  "phase": "chatting" | "mirroring" | "done",
  "extractedSlots": {
    "current": "추출된 값 또는 null",
    "keyword": "추출된 값 또는 null",
    "want": "추출된 값 또는 null",
    "feeling": "추출된 값 또는 null"
  }
}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SectionChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, messages, extractedSlots } = body;

  const contextNote = `현재 섹션: ${sectionTitle}
지금까지 추출된 정보:
- current: ${extractedSlots.current || '(미추출)'}
- keyword: ${extractedSlots.keyword || '(미추출)'}
- want: ${extractedSlots.want || '(미추출)'}
- feeling: ${extractedSlots.feeling || '(미추출)'}`;

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${contextNote}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemWithContext,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();

    // JSON 파싱 시도
    let parsed: SectionChatResponse;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // JSON 파싱 실패 시 fallback
      parsed = {
        message: raw,
        phase: 'chatting',
        extractedSlots,
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Section chat error:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
```

- [ ] `npm run build` 에러 없음 확인

---

## Task 3: 채팅 UI 공용 컴포넌트

**Files:**
- Create: `vision-board-web/components/ChatBubble.tsx`
- Create: `vision-board-web/components/ChatInput.tsx`

### 3-1 ChatBubble

- [ ] `components/ChatBubble.tsx` 생성

```tsx
interface Props {
  role: 'assistant' | 'user';
  content: string;
  isLoading?: boolean;
}

export default function ChatBubble({ role, content, isLoading }: Props) {
  const isLumi = role === 'assistant';

  return (
    <div className={`flex ${isLumi ? 'justify-start' : 'justify-end'} mb-3`}>
      {isLumi && (
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center mr-2 flex-shrink-0 mt-0.5"
          style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
        >
          <span className="text-white text-xs">✦</span>
        </div>
      )}
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
        style={{
          backgroundColor: isLumi ? '#F5F5F3' : '#1C1B19',
          color: isLumi ? '#1C1B19' : '#FFFFFF',
          borderBottomLeftRadius: isLumi ? 4 : undefined,
          borderBottomRightRadius: !isLumi ? 4 : undefined,
        }}
      >
        {isLoading ? (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
```

### 3-2 ChatInput

- [ ] `components/ChatInput.tsx` 생성

```tsx
import { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = '여기에 써봐...' }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-[#E5E3DF] bg-white">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none text-sm leading-relaxed bg-[#F5F5F3] rounded-xl px-3 py-2.5 outline-none max-h-32 overflow-y-auto"
        style={{ color: '#1C1B19' }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
        style={{
          backgroundColor: text.trim() && !disabled ? '#1C1B19' : '#E5E3DF',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M12 5l7 7-7 7" stroke={text.trim() && !disabled ? '#fff' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
```

- [ ] `npm run build` 에러 없음 확인

---

## Task 4: 섹션 페이지 → 채팅 UI

현재 SlotQuestion/PhaseReview/DeferredCheck/SectionComplete/PhaseScene/PhaseImages 컴포넌트로 구성된 section 페이지를 채팅 UI로 전면 교체.

**Files:**
- Rewrite: `vision-board-web/app/section/[id]/page.tsx`
- Delete after: `SlotQuestion.tsx`, `PhaseReview.tsx`, `DeferredCheck.tsx`, `SectionComplete.tsx`, `PhaseScene.tsx`, `PhaseImages.tsx`

- [ ] `app/section/[id]/page.tsx` 전면 재작성

```tsx
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
import { ChatMessage, SectionId, ExtractedSlots } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import ChatInput from '@/components/ChatInput';
import { BoardData } from '@/lib/types';

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
      // 첫 진입: lumi 첫 메시지 가져오기
      fetchLumiMessage([], {});
    }
  }, [sectionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
          messages: currentMessages,
          extractedSlots: currentSlots,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const lumiMsg: ChatMessage = { role: 'assistant', content: data.message };
      const newMessages = [...currentMessages, lumiMsg];
      setMessages(newMessages);
      setExtractedSlots(data.extractedSlots || currentSlots);
      setPhase(data.phase || 'chatting');

      saveSectionChat(sectionId, newMessages);
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
    setBoard(loadBoard());

    // 다음 미완료 섹션 또는 review로
    const freshBoard = loadBoard();
    const allTextDone = ([1, 2, 3, 4, 5, 6] as SectionId[]).every(
      (id) => freshBoard.sections[id].status === 'text_complete' || freshBoard.sections[id].status === 'completed'
    );
    if (allTextDone) {
      router.push('/review');
    } else {
      const next = ([1, 2, 3, 4, 5, 6] as SectionId[]).find(
        (id) => id > sectionId && (freshBoard.sections[id].status === 'not_started' || freshBoard.sections[id].status === 'in_progress')
      );
      router.push(next ? `/section/${next}` : '/dashboard');
    }
  }

  if (!section || !board) return null;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <ProcessBar board={board} />

      {/* 섹션 헤더 */}
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

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {isLoading && <ChatBubble role="assistant" content="" isLoading />}

        {/* 확인 버튼 — mirroring 단계 */}
        {phase === 'mirroring' && !isLoading && (
          <div className="flex gap-2 mt-3 mb-1">
            <button
              onClick={() => handleUserMessage('맞아, 딱 그거야!')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
            >
              맞아, 딱 그거야!
            </button>
            <button
              onClick={() => handleUserMessage('조금 달라, 다시 말해볼게')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E3DF] text-[#6B7280]"
            >
              조금 달라
            </button>
          </div>
        )}

        {/* 완료 버튼 — done 단계 */}
        {(phase === 'done') && !isLoading && (
          <button
            onClick={handleConfirm}
            className="w-full mt-3 py-3.5 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
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

      {/* 입력창 */}
      {phase === 'chatting' && (
        <ChatInput onSend={handleUserMessage} disabled={isLoading} />
      )}
    </div>
  );
}
```

- [ ] 기존 section 서브 컴포넌트 파일 6개 삭제:
  - `app/section/[id]/SlotQuestion.tsx`
  - `app/section/[id]/PhaseReview.tsx`
  - `app/section/[id]/DeferredCheck.tsx`
  - `app/section/[id]/SectionComplete.tsx`
  - `app/section/[id]/PhaseScene.tsx`
  - `app/section/[id]/PhaseImages.tsx`

- [ ] `npm run build` 에러 없음 확인

- [ ] 수동 확인: `/section/1` 진입 시 lumi 첫 메시지가 채팅 버블로 표시됨 (ANTHROPIC_API_KEY 설정 필요 — `.env.local`에 `ANTHROPIC_API_KEY=sk-...` 추가)

---

## Task 5: ProcessBar → 새 STEP 구조

PRD v2.2의 4 STEP (STEP 0 온보딩, STEP 1 섹션, STEP 2 장면+이미지, STEP 3 마무리)로 업데이트.

**Files:**
- Modify: `vision-board-web/components/ProcessBar.tsx`

- [ ] `components/ProcessBar.tsx` 전면 교체

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { BoardData } from '@/lib/types';

interface Props {
  board: BoardData;
}

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string; short: string; route: string }[] = [
  { id: 1, label: '섹션 대화', short: '대화', route: '/dashboard' },
  { id: 2, label: '장면 그리기', short: '장면', route: '/review' },
  { id: 3, label: '이미지', short: '이미지', route: '/board' },
  { id: 4, label: '마무리', short: '마무리', route: '/finish' },
];

function getStepInfo(board: BoardData): { currentStep: StepId; subLabel: string } {
  const sections = Object.values(board.sections);
  const textDone = sections.filter((s) => s.status === 'text_complete' || s.status === 'completed').length;
  const sceneDone = sections.filter((s) => s.sceneText && s.sceneText.trim() !== '').length;
  const imgDone = sections.filter((s) => s.status === 'completed').length;

  if (textDone < 6) return { currentStep: 1, subLabel: `${textDone}/6` };
  if (sceneDone < 6) return { currentStep: 2, subLabel: `${sceneDone}/6` };
  if (imgDone < 6) return { currentStep: 3, subLabel: `${imgDone}/6` };
  return { currentStep: 4, subLabel: '완성' };
}

export default function ProcessBar({ board }: Props) {
  const router = useRouter();
  const { currentStep, subLabel } = getStepInfo(board);

  return (
    <div className="w-full px-4 pt-3 pb-2">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const isDone = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isFuture = step.id > currentStep;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => !isFuture && router.push(step.route)}
                disabled={isFuture}
                className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-opacity active:opacity-60"
                style={{ cursor: isFuture ? 'default' : 'pointer' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    backgroundColor: isDone || isCurrent ? '#1C1B19' : 'transparent',
                    border: isFuture ? '1.5px dashed #D1D5DB' : 'none',
                    color: isDone || isCurrent ? '#fff' : '#9CA3AF',
                  }}
                >
                  {isDone ? '✓' : step.id}
                </div>
                <span
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: isCurrent ? '#1C1B19' : isDone ? '#6B7280' : '#C4C2BE' }}
                >
                  {step.short}
                </span>
                {isCurrent && (
                  <span className="text-[9px] text-[#9CA3AF] leading-tight">{subLabel}</span>
                )}
              </button>
              {!isLast && (
                <div
                  className="flex-1 h-px mx-1.5"
                  style={{ backgroundColor: step.id < currentStep ? '#1C1B19' : '#E5E3DF' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] `npm run build` 에러 없음 확인

---

## Task 6: 온보딩 개선 — 완성 미리보기 + 효과성 체감 + 첫 질문

PRD: 현행 5단계 유지 + 효과성 체감 + 완성 비전보드 샘플 미리보기 + 가벼운 첫 질문.

**Files:**
- Modify: `vision-board-web/app/onboarding/page.tsx`

- [ ] `app/onboarding/page.tsx` 읽고 Step 타입을 `1 | 2 | 3 | 4 | 5 | 6 | 7`로 확장하고 아래 두 스텝 삽입

기존 5단계(인사→이름→소개→상태공감→초대) 사이에 step 3과 step 4 사이에 두 스텝 추가:
- **Step 3.5 = 새 step 4**: 효과성 체감 ("막연한 바람 vs 생생한 장면")
- **Step 4.5 = 새 step 5**: 완성 비전보드 미리보기 (6색 그리드 샘플)

기존 step 3→4→5 를 step 3→4→5→6→7 로 재번호.

- [ ] `app/onboarding/page.tsx` 전체 교체

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone, saveUserName, saveOnboardingStep, loadBoard } from '@/lib/storage';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const SECTION_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];
const SECTION_NAMES = ['나', '건강', '관계', '일', '돈', '공간'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingStep && board.onboardingStep > 1) {
      setStep(board.onboardingStep as Step);
    }
    if (board.userName) {
      setSavedName(board.userName);
      setNameInput(board.userName);
    }
  }, []);

  const name = savedName || '너';

  function goToStep(s: Step) {
    setStep(s);
    saveOnboardingStep(s);
  }

  function handleNameSubmit() {
    const n = nameInput.trim();
    setSavedName(n);
    saveUserName(n);
    goToStep(3);
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/dashboard');
  }

  const totalSteps = 7;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      {/* 진행 바 */}
      <div className="flex gap-1.5 mb-10">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{ backgroundColor: s <= step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col animate-fadeIn" key={step}>

        {/* STEP 1: 인사 + lumi 소개 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            <div className="space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)', boxShadow: '0 8px 24px rgba(28,27,25,0.18)' }}
              >
                <span className="text-white text-2xl">✦</span>
              </div>
              <div>
                <p className="text-sm text-[#9CA3AF] mb-1">나는 lumi야.</p>
                <h1 className="text-2xl font-bold leading-snug">
                  원하는 삶을<br />같이 그려보자.
                </h1>
              </div>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              막연하게 느끼는 것들도 이야기하다 보면 선명해져. 오늘 그 시작을 해보자.
            </p>
            <button
              onClick={() => goToStep(2)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              좋아, 시작해보자
            </button>
          </div>
        )}

        {/* STEP 2: 이름 */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">먼저,</p>
              <h2 className="text-2xl font-bold">뭐라고 불러줄까?</h2>
            </div>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && handleNameSubmit()}
              placeholder="이름 또는 닉네임"
              className="w-full text-lg border-b-2 border-[#E5E3DF] pb-2 outline-none bg-transparent focus:border-[#1C1B19] transition-colors"
              autoFocus
            />
            <button
              onClick={handleNameSubmit}
              disabled={!nameInput.trim()}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#1C1B19' }}
            >
              이걸로 할게
            </button>
          </div>
        )}

        {/* STEP 3: 비전보드 소개 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">{name}아,</p>
              <h2 className="text-2xl font-bold leading-snug">
                비전보드가 뭔지<br />알아?
              </h2>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              원하는 삶을 이미지와 글로 구체적으로 그려놓은 것. 막연하게 "잘 살고 싶다"는 마음이 또렷한 방향이 되는 거야.
            </p>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              나, 건강, 관계, 일, 돈, 공간 — 6가지 영역을 lumi랑 같이 채우다 보면 네가 진짜 원하는 게 뭔지 보이기 시작해.
            </p>
            <button
              onClick={() => goToStep(4)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              계속
            </button>
          </div>
        )}

        {/* STEP 4: 효과성 체감 — 막연 vs 생생 */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">이게 왜 다른지 보여줄게.</p>
              <h2 className="text-2xl font-bold leading-snug">막연함과 선명함의 차이</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-[#F5F5F3] rounded-2xl p-4">
                <p className="text-xs text-[#9CA3AF] mb-1.5">막연한 바람</p>
                <p className="text-sm text-[#6B7280]">"언젠가 건강하게 살고 싶다."</p>
              </div>
              <div className="bg-white border border-[#1C1B19]/10 rounded-2xl p-4">
                <p className="text-xs text-[#1C1B19] font-semibold mb-1.5">생생한 장면</p>
                <p className="text-sm leading-relaxed">
                  "{name}아, 새벽 6시에 러닝 끝내고 샤워 후 커피 한 잔. 몸이 가볍고 하루가 내 것인 느낌."
                </p>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              두 번째처럼 또렷해지면, 뇌는 그쪽으로 자연히 움직이기 시작해. 그게 비전보드의 힘이야.
            </p>
            <button
              onClick={() => goToStep(5)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              오, 그렇구나
            </button>
          </div>
        )}

        {/* STEP 5: 완성 비전보드 미리보기 */}
        {step === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">다 하면 이게 {name}의 것이 돼.</p>
              <h2 className="text-2xl font-bold leading-snug">완성된 비전보드</h2>
            </div>
            {/* 샘플 보드 — 6섹션 색 그리드 */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
              {SECTION_COLORS.map((color, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
                  style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold" style={{ color }}>{SECTION_NAMES[i]}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#F5F5F3] rounded-xl p-3 text-center">
              <p className="text-xs text-[#6B7280]">섹션별 이미지 보드 + 통합 1장 + <span className="font-semibold">미래의 하루 이야기(글)</span></p>
            </div>
            <button
              onClick={() => goToStep(6)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              나도 만들고 싶어
            </button>
          </div>
        )}

        {/* STEP 6: 상태 공감 */}
        {step === 6 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold leading-snug">
                {name}아, 요즘<br />어때?
              </h2>
            </div>
            <div className="space-y-2.5">
              {[
                { label: '솔직히 막연해. 뭘 원하는지 모르겠어.', value: 'foggy' },
                { label: '원하는 건 있는데 어떻게 해야 할지 모르겠어.', value: 'know' },
                { label: '방향은 있어. 좀 더 선명하게 만들고 싶어.', value: 'vivid' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => goToStep(7)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-[#E5E3DF] text-sm leading-relaxed active:opacity-70 transition-opacity"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: 가벼운 첫 질문 + 초대 */}
        {step === 7 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">좋아.</p>
              <h2 className="text-2xl font-bold leading-snug">
                그럼 같이<br />그려보자.
              </h2>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              6가지 영역을 lumi랑 대화하면서 채워. 칸 채우기가 아니라 진짜 대화야. 어디서부터 해도 괜찮고, 언제든 이어서 해도 돼.
            </p>
            <div className="bg-[#F5F5F3] rounded-2xl p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">lumi의 첫 질문</p>
              <p className="text-sm leading-relaxed">"{name}아, 요즘 하루 중 제일 에너지 빠지는 순간이 언제야?"</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              시작할게 →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] `npm run build` 에러 없음 확인
- [ ] 수동 확인: 온보딩 7단계 전체 흐름, step 4(효과성), step 5(미리보기) 화면 표시

---

## Task 7: 장면 대화 API — `/api/chat/scene`

**Files:**
- Create: `vision-board-web/app/api/chat/scene/route.ts`

lumi가 공간/사람/사물/감각 질문으로 추상→구체 장면을 끌어낸다.

- [ ] `app/api/chat/scene/route.ts` 생성

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export interface SceneChatRequest {
  sectionTitle: string;
  sectionAnswers: {
    keyword?: string;
    want?: string;
    feeling?: string;
  };
  messages: { role: 'assistant' | 'user'; content: string }[];
}

const SCENE_SYSTEM = `너는 lumi야. 사용자가 자신의 비전이 이루어진 하루의 구체적인 한 장면을 그리도록 돕는 AI 친구야.

역할:
- 한 조각씩, 한 번에 한 질문만.
- 사용자 답변에 나온 키워드·원해·기분을 재료로만 써. 새 내용 심지 말 것.
- 추상적 답이 나오면 구체적 세부 질문으로 더 파고들어:
  공간: "어디야? 집? 카페? 야외?"
  사람: "혼자야, 아니면 누구 옆에 있어?"
  사물·행동: "손에 뭐가 있어? 지금 뭐 하고 있어?"
  감각: "빛은 어때? 무슨 소리 들려? 아침이야 저녁이야?"
- 막히면 빈칸형 또는 보기 2~3개: "아침에 ___에서 시작해요, 옆엔 ___이 있고..." 또는 "집이야, 카페야, 야외야?"
- 완성본을 대신 써주지 말 것. 사용자가 직접 쌓아가도록.
- 4~6번 주고받으면 지금까지 대화를 장면으로 정리해서 "이런 장면이야, 맞아?" 확인.
- 확인받으면 phase를 done으로.

반드시 아래 JSON만 출력:
{
  "message": "lumi의 메시지",
  "phase": "chatting" | "confirming" | "done",
  "sceneText": "지금까지 조각 모아 한 문장 (done일 때만 완성)"
}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SceneChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, sectionAnswers, messages } = body;

  const context = `섹션: ${sectionTitle}
사용자 답변 재료:
- 방향 키워드: ${sectionAnswers.keyword || '(없음)'}
- 원하는 것: ${sectionAnswers.want || '(없음)'}
- 이뤄졌을 때 기분: ${sectionAnswers.feeling || '(없음)'}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      system: `${SCENE_SYSTEM}\n\n${context}`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();

    let parsed: { message: string; phase: string; sceneText?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw, phase: 'chatting' };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Scene chat error:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
```

- [ ] `npm run build` 에러 없음 확인

---

## Task 8: 장면 페이지 → 대화형 캐묻기

**Files:**
- Rewrite: `vision-board-web/app/scene/[id]/page.tsx`

현행 scene/[id] 페이지는 텍스트 입력 + 이미지 선택 방식. 새 방식: lumi가 구체적으로 캐묻는 채팅 → 장면 완성 → 이미지로 넘어감.

- [ ] `app/scene/[id]/page.tsx` 전면 재작성

```tsx
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
  }, [sectionId]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

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
    // 다음 미완료 scene 또는 board
    const freshBoard = loadBoard();
    const nextIncomplete = ([1, 2, 3, 4, 5, 6] as SectionId[]).find(
      (id) => freshBoard.sections[id].status !== 'completed' && freshBoard.sections[id].status === 'text_complete'
    );
    if (nextIncomplete) {
      router.push(`/scene/${nextIncomplete}`);
    } else {
      router.push('/board');
    }
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
              이미지 찾으러 가기 →
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
```

- [ ] `npm run build` 에러 없음 확인
- [ ] 수동 확인: `/scene/1` 진입 시 lumi의 첫 장면 질문("어디야? 아침이야?") 표시됨

---

## Task 9: 스토리 API — `/api/story`

**Files:**
- Create: `vision-board-web/app/api/story/route.ts`

6섹션 답·키워드·한 문장을 재료로 "미래의 하루 이야기(글)" 생성. 사용자 키워드가 실제로 등장하고, 6섹션이 하나의 하루로 통합됨.

- [ ] `app/api/story/route.ts` 생성

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface StorySection {
  title: string;
  keyword?: string;
  want?: string;
  feeling?: string;
  sceneText?: string;
}

interface StoryRequest {
  userName: string;
  oneSentence: string;
  sections: StorySection[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: StoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { userName, oneSentence, sections } = body;

  const sectionLines = sections
    .filter((s) => s.keyword || s.want || s.sceneText)
    .map((s) => {
      const parts = [];
      if (s.keyword) parts.push(`방향: ${s.keyword}`);
      if (s.want) parts.push(`원하는 것: ${s.want}`);
      if (s.sceneText) parts.push(`장면: ${s.sceneText}`);
      return `[${s.title}] ${parts.join(' / ')}`;
    })
    .join('\n');

  const prompt = `${userName || '이 사람'}의 비전보드 재료야:

한 문장: "${oneSentence}"

섹션별 내용:
${sectionLines}

이 내용을 재료로, 이 삶이 이루어진 미래의 어느 하루를 아침부터 저녁까지 한 편의 글로 써줘.

조건:
- 위에 나온 키워드·장면이 글에 실제로 등장해야 해 (새 내용 심지 말 것)
- 6개 섹션(나·건강·관계·일·돈·공간)이 하나의 하루 안에서 자연스럽게 흐르도록 (섹션별로 쪼개지 않게)
- 1인칭 "나는"으로 시작
- 아침→점심→저녁 흐름
- 감각적이고 구체적으로. 2~3 문단, 300자 내외.
- 반말, 따뜻한 톤`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const story = (response.content[0] as { type: string; text: string }).text;
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
```

- [ ] `npm run build` 에러 없음 확인

---

## Task 10: 마무리 페이지 — 패턴 → 한 문장 → 스토리 → 통합 이미지

현행 finish 페이지(키워드 배지 + 보드 보기)를 PRD v2.2 클라이맥스 흐름으로 교체.

**Files:**
- Rewrite: `vision-board-web/app/finish/page.tsx`

- [ ] `app/finish/page.tsx` 전면 재작성

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, markBoardFinished, saveOneSentence, saveFutureDayStory } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';

type FinishPhase = 'pattern' | 'sentence' | 'story-loading' | 'story' | 'complete';

export default function FinishPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [phase, setPhase] = useState<FinishPhase>('pattern');
  const [sentenceInput, setSentenceInput] = useState('');
  const [story, setStory] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    if (!b.finishedAt) markBoardFinished();
    if (b.oneSentence) setSentenceInput(b.oneSentence);
    if (b.futureDayStory) {
      setStory(b.futureDayStory);
      setPhase('story');
    }
  }, []);

  async function generateStory(sentence: string, currentBoard: BoardData) {
    setPhase('story-loading');
    setStoryLoading(true);

    const sectionData = SECTIONS.map((s) => {
      const sec = currentBoard.sections[s.id];
      const slots = sec.extractedSlots || {};
      return {
        title: s.title.split(' — ')[0],
        keyword: slots.keyword || sec.slots[2]?.text,
        want: slots.want || sec.slots[3]?.text,
        feeling: slots.feeling || sec.slots[5]?.text,
        sceneText: sec.sceneText,
      };
    });

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: currentBoard.userName,
          oneSentence: sentence,
          sections: sectionData,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setStory(data.story);
      saveFutureDayStory(data.story);
      setPhase('story');
    } catch {
      setStory('글 생성에 실패했어. 다시 시도해볼게.');
      setPhase('story');
    } finally {
      setStoryLoading(false);
    }
  }

  function handleSentenceConfirm() {
    const s = sentenceInput.trim();
    if (!s) return;
    saveOneSentence(s);
    if (board) generateStory(s, board);
  }

  if (!board) return null;

  const keywords = SECTIONS.map((s) => {
    const sec = board.sections[s.id];
    const kw = sec.extractedSlots?.keyword || sec.slots[2]?.text;
    return { section: s, kw: kw && !sec.slots[2]?.isDeferred ? kw : null };
  }).filter((x) => x.kw);

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10 animate-fadeIn">

      {/* 패턴 비추기 */}
      {phase === 'pattern' && (
        <div className="flex-1 flex flex-col justify-center space-y-8">
          <div className="text-center space-y-2">
            <p className="text-4xl">✦</p>
            <h1 className="text-2xl font-bold">
              {board.userName ? `${board.userName}, ` : ''}다 됐어.
            </h1>
            <p className="text-[#6B7280]">6가지 영역에서 네가 원하는 실을 봐.</p>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {keywords.map(({ section, kw }) => (
                <span
                  key={section.id}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: section.lightColor, color: section.color }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm text-[#6B7280] text-center leading-relaxed">
            이 단어들 사이에 공통된 실이 있어.<br />그걸 하나의 문장으로 담아볼게.
          </p>

          <button
            onClick={() => setPhase('sentence')}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white"
            style={{ backgroundColor: '#1C1B19' }}
          >
            한 문장 써보기 →
          </button>
        </div>
      )}

      {/* 한 문장 */}
      {phase === 'sentence' && (
        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div>
            <p className="text-sm text-[#9CA3AF] mb-2">네 비전을 한 문장으로.</p>
            <h2 className="text-2xl font-bold leading-snug">
              3년 뒤 나는<br />어떤 사람으로 살고 있어?
            </h2>
          </div>
          <div className="bg-[#F5F5F3] rounded-xl p-3 text-xs text-[#9CA3AF]">
            힌트: {keywords.slice(0, 3).map(x => x.kw).join(', ')} 같은 단어를 담아봐
          </div>
          <textarea
            value={sentenceInput}
            onChange={(e) => setSentenceInput(e.target.value)}
            placeholder="예: 여유롭게 내 페이스로, 소중한 사람들과 웃으며 사는 사람."
            className="w-full bg-white border border-[#E5E3DF] rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:border-[#1C1B19] transition-colors resize-none"
            rows={3}
          />
          <button
            onClick={handleSentenceConfirm}
            disabled={!sentenceInput.trim()}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#1C1B19' }}
          >
            이 문장으로 할게 →
          </button>
        </div>
      )}

      {/* 스토리 로딩 */}
      {phase === 'story-loading' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
            style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}>
            <span className="text-white text-2xl">✦</span>
          </div>
          <p className="text-[#6B7280] text-sm">네 하루를 쓰고 있어...</p>
        </div>
      )}

      {/* 스토리 + 완성 */}
      {phase === 'story' && (
        <div className="flex-1 flex flex-col space-y-6">
          <div className="text-center space-y-1 pt-4">
            <p className="text-sm text-[#9CA3AF]">미래의 하루 이야기</p>
            <h2 className="text-xl font-bold">그 삶이 이루어진 날</h2>
          </div>

          <div className="bg-[#F5F5F3] rounded-2xl p-5 flex-1">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{story}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => board && generateStory(sentenceInput, board)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E3DF] text-[#6B7280]"
            >
              다시 써줘
            </button>
            <button
              onClick={() => setPhase('complete')}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
            >
              비전보드 완성 →
            </button>
          </div>
        </div>
      )}

      {/* 완성물 */}
      {phase === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
          <div className="space-y-3">
            <p className="text-5xl">✦</p>
            <h1 className="text-2xl font-bold">완성됐어.</h1>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              이미지보드 + 미래의 하루 이야기.<br />원하는 삶을 이미지로도 보고 글로도 읽는 거야.
            </p>
          </div>
          <div className="w-full space-y-2.5">
            <button
              onClick={() => router.push('/board')}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              비전보드 보기
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-sm font-semibold"
            >
              대시보드로
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] `npm run build` 에러 없음 확인
- [ ] 수동 확인: `/finish` 4단계 흐름 (패턴→한 문장→스토리 로딩→스토리 읽기→완성)

---

## 최종 검증 체크리스트

- [ ] `.env.local`에 `ANTHROPIC_API_KEY` 설정 후 `npm run dev`
- [ ] 온보딩 7단계 전체 진행
- [ ] 섹션 1('나') 채팅 → lumi와 대화 → 4가지 슬롯 완성 → 미러링 → 완료
- [ ] 대시보드에서 섹션 2로 점프 → 동일 흐름
- [ ] 6섹션 모두 완료 후 리뷰(/review) 진입
- [ ] 섹션 1 장면 대화 → lumi가 공간/사람/감각 캐물음 → 장면 완성
- [ ] /finish 에서 패턴→한 문장→스토리 생성→읽기→다시 써줘→비전보드 완성

---

## 주의사항

- 현행 `/review`, `/board`, `/scene/page.tsx` (단수)는 이 플랜에서 수정하지 않음. 필요 시 별도 플랜.
- `ANTHROPIC_API_KEY` 없으면 채팅 API가 500 에러 → 반드시 `.env.local` 설정 후 테스트.
- 기존 localStorage 데이터와의 하위 호환: `extractedSlots` 없어도 `slots[2]`, `slots[3]`, `slots[5]`에서 fallback 조회.
