'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSectionScene } from '@/lib/storage';
import { SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';

function getEunga(word: string): string {
  if (!word) return '이';
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return '이';
  return (code - 0xAC00) % 28 === 0 ? '가' : '이';
}

const SLOT_LABELS: Record<keyof ExtractedSlots, string> = {
  current: '지금',
  want: '원해',
  feeling: '더 들여다보기',
  keyword: '방향 키워드',
};

export default function ScenePage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [slots, setSlots] = useState<Partial<ExtractedSlots>>({});
  const [sceneText, setSceneText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const sec = b.sections[sectionId];
    if (sec.extractedSlots) setSlots(sec.extractedSlots);
    if (sec.sceneText) {
      setSceneText(sec.sceneText);
      setSubmitted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [submitted]);

  function handleSubmit(text: string) {
    setSceneText(text);
    setSubmitted(true);
    saveSectionScene(sectionId, text);
  }

  function handleFindImages() {
    saveSectionScene(sectionId, sceneText);
    router.push(`/moment/${sectionId}`);
  }

  if (!section || !board) return null;

  const sceneSlot = section.slots.find((s) => s.phase === 3);
  const examples = sceneSlot?.example ? sceneSlot.example.split(' / ') : [];
  const keyword = slots.keyword || '';
  const cushionText = keyword
    ? `이제 장면을 그려볼 거야. '${keyword}' 상태가 이루어진 3년 뒤의 하루야. 이 장면이 비전보드의 핵심이 될 거야.`
    : '이제 장면을 그려볼 거야. 지금까지 말해준 것들이 이루어진 3년 뒤의 하루야.';

  const sceneQuestion = keyword
    ? '그날 어디서 뭘 하고 있어? 느낌과 상황을 구체적으로 써봐.'
    : (sceneSlot?.mainQuestion ?? '그 장면을 구체적으로 써봐.');

  const slotEntries = (Object.keys(SLOT_LABELS) as Array<keyof ExtractedSlots>).filter(
    (k) => slots[k]
  );

  return (
    <div className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/section/${sectionId}`)}
            aria-label="대화 단계로 돌아가기"
            className="text-[#6E6962] text-lg leading-none mr-1 active:opacity-60"
          >
            ‹
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]} · 장면</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs text-[#6E6962] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">

        {/* 이전 답변 컨텍스트 카드 */}
        {slotEntries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold text-[#6E6962] uppercase tracking-wide mb-2.5">
                네가 말해준 것들
              </p>
              <div className="space-y-1.5 pb-3">
                {slotEntries.map((key) => (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: key === 'keyword' ? section.color + '18' : '#F5F5F3',
                        color: key === 'keyword' ? section.color : '#9CA3AF',
                      }}
                    >
                      {SLOT_LABELS[key]}
                    </span>
                    <span
                      className="text-sm leading-relaxed"
                      style={{ fontWeight: key === 'keyword' ? 600 : 400 }}
                    >
                      {slots[key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 쿠션 버블 */}
        <ChatBubble role="assistant" content={cushionText} />

        {/* 질문 버블 — keyword 기반 동적 생성 */}
        <ChatBubble role="assistant" content={sceneQuestion} />

        {/* 예시 답변 패널 */}
        {examples.length > 0 && !submitted && (
          <div className="mb-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold text-[#6E6962] uppercase tracking-wide mb-2">
              이런 식으로 써봐
            </p>
            <div className="space-y-1">
              {examples.map((ex, i) => (
                <p key={i} className="text-xs text-[#6B7280] leading-relaxed before:content-['○'] before:mr-1.5 before:text-[#C9C5BE]">
                  {ex.trim()}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* 입력창 */}
        {!submitted && sceneSlot && (
          <InlineInput
            onSubmit={handleSubmit}
            placeholder={sceneSlot.placeholder || '구체적일수록 좋아. 장소, 행동, 감각까지.'}
            hint="여러 장면이어도 좋아. 느낌, 장소, 상황 모두 담아봐."
          />
        )}

        {/* 제출 후 — 3선택지 */}
        {submitted && (
          <>
            <ChatBubble role="user" content={sceneText} />

            <div className="mt-4 bg-[#F5F5F3] rounded-2xl p-4 mb-4">
              <p className="text-[11px] text-[#6E6962] font-semibold mb-2 uppercase tracking-wide">
                완성된 장면
              </p>
              <p className="text-sm leading-relaxed">{sceneText}</p>
            </div>

            <div className="mt-4 mb-2">
              <button
                onClick={handleFindImages}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white active:opacity-80"
                style={{ backgroundColor: section?.color ?? '#1C1B19' }}
              >
                이 삶의 순간들 담으러 가기 →
              </button>
            </div>
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
