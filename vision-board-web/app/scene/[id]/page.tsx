'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSectionScene } from '@/lib/storage';
import { SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import { SLOT_KEY_LABELS } from '@/lib/slotLabels';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';

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

  const sceneStep = section.sceneStep;
  const keyword = slots.keyword || '';
  const cushionText = keyword
    ? `질문은 끝났어. 이제 '${keyword}' 상태가 이루어진 3년 뒤의 하루를 그려볼 거야. 이 하루가 비전보드의 핵심이 될 거야.`
    : '질문은 끝났어. 이제 지금까지 말해준 것들이 이루어진 3년 뒤의 하루를 그려볼 거야.';

  const sceneQuestion = keyword
    ? '그날 어디서 뭘 하고 있어? 느낌과 상황을 구체적으로 써봐.'
    : sceneStep.question;

  const slotEntries = (Object.keys(SLOT_KEY_LABELS) as Array<keyof ExtractedSlots>).filter(
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
            className="text-[#6E6962] text-title leading-none mr-1 active:opacity-60"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-body">{section.title.split(' — ')[0]} · 미래의 하루</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-caption text-[#6E6962] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">

        {/* 이전 답변 컨텍스트 카드 */}
        {slotEntries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-micro font-semibold text-[#6E6962] uppercase tracking-wide mb-2.5">
                네가 말해준 것들
              </p>
              <div className="space-y-1.5 pb-3">
                {slotEntries.map((key) => (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className="text-micro font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: key === 'keyword' ? section.color + '18' : '#F5F5F3',
                        color: key === 'keyword' ? section.color : '#9CA3AF',
                      }}
                    >
                      {SLOT_KEY_LABELS[key]}
                    </span>
                    <span
                      className="text-body leading-relaxed"
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

        {/* 입력창 — 예시는 InlineInput 내장 패널로 (v6.21 중복 구현 제거, /section과 동일 패턴) */}
        {!submitted && (
          <InlineInput
            onSubmit={handleSubmit}
            placeholder={sceneStep.placeholder || '구체적일수록 좋아. 장소, 행동, 감각까지.'}
            example={sceneStep.example}
            hint="여러 순간이어도 좋아. 느낌, 장소, 상황 모두 담아봐."
          />
        )}

        {/* 제출 후 — 3선택지 */}
        {submitted && (
          <>
            <ChatBubble role="user" content={sceneText} />

            <div className="mt-4 bg-[#F5F5F3] rounded-2xl p-4 mb-4">
              <p className="text-micro text-[#6E6962] font-semibold mb-2 uppercase tracking-wide">
                내가 그린 미래의 하루
              </p>
              <p className="text-body leading-relaxed">{sceneText}</p>
            </div>

            <div className="mt-4 mb-2">
              <button
                onClick={handleFindImages}
                className="w-full py-3.5 rounded-xl text-body font-semibold text-white active:opacity-80"
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
