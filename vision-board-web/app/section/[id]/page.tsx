'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSlotAnswer, markSectionTextComplete } from '@/lib/storage';
import { BoardData, Section, SlotAnswer, SlotId, PHASE1_SLOTS } from '@/lib/types';
import SlotQuestion from './SlotQuestion';
import PhaseReview from './PhaseReview';
import DeferredCheck from './DeferredCheck';
import SectionComplete from './SectionComplete';

type Phase = 'slot' | 'review' | 'deferred' | 'complete';

export default function SectionPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as 1 | 2 | 3 | 4 | 5 | 6;

  const section = getSection(sectionId);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [phase, setPhase] = useState<Phase>('slot');
  const [slotIndex, setSlotIndex] = useState(0);

  const refreshBoard = useCallback(() => setBoard(loadBoard()), []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    // 이미 텍스트 완료면 완료 화면으로
    if (b.sections[sectionId]?.status === 'text_complete' || b.sections[sectionId]?.status === 'completed') {
      setPhase('complete');
    }
  }, [sectionId]);

  if (!section || !board) return null;

  const sectionData = board.sections[sectionId];

  function handleSlotSave(answer: SlotAnswer) {
    saveSlotAnswer(sectionId, PHASE1_SLOTS[slotIndex] as SlotId, answer);
    refreshBoard();
    if (slotIndex < PHASE1_SLOTS.length - 1) {
      setSlotIndex((i) => i + 1);
    } else {
      setPhase('review');
    }
  }

  function handleSlotSkip() {
    saveSlotAnswer(sectionId, PHASE1_SLOTS[slotIndex] as SlotId, { text: '', isDeferred: true });
    refreshBoard();
    if (slotIndex < PHASE1_SLOTS.length - 1) {
      setSlotIndex((i) => i + 1);
    } else {
      setPhase('review');
    }
  }

  function handleReviewDone() {
    setPhase('deferred');
  }

  function handleDeferredAnswer(slotIdx: number) {
    setSlotIndex(slotIdx);
    setPhase('slot');
  }

  function handleDeferAll() {
    markSectionTextComplete(sectionId);
    refreshBoard();
    setPhase('complete');
  }

  function handleComplete() {
    router.push('/dashboard');
  }

  const currentSlot = section.slots.find((s) => s.id === PHASE1_SLOTS[slotIndex]);

  return (
    <SectionShell section={section} onBack={() => router.push('/dashboard')}>
      {phase === 'slot' && currentSlot && (
        <SlotQuestion
          key={`slot-${slotIndex}`}
          section={section}
          slot={currentSlot}
          slotIndex={slotIndex}
          totalSlots={PHASE1_SLOTS.length}
          savedAnswer={sectionData.slots[PHASE1_SLOTS[slotIndex] as SlotId]}
          onSave={handleSlotSave}
          onSkip={handleSlotSkip}
          onBack={slotIndex > 0 ? () => setSlotIndex((i) => i - 1) : undefined}
        />
      )}
      {phase === 'review' && (
        <PhaseReview
          section={section}
          slots={sectionData.slots}
          onEdit={(slotIdx) => { setSlotIndex(slotIdx); setPhase('slot'); }}
          onNext={handleReviewDone}
          onBack={() => { setSlotIndex(PHASE1_SLOTS.length - 1); setPhase('slot'); }}
        />
      )}
      {phase === 'deferred' && (
        <DeferredCheck
          section={section}
          slots={sectionData.slots}
          onAnswerSlot={handleDeferredAnswer}
          onDeferAll={handleDeferAll}
        />
      )}
      {phase === 'complete' && (
        <SectionComplete section={section} onDone={handleComplete} />
      )}
    </SectionShell>
  );
}

function SectionShell({
  section,
  children,
  onBack,
}: {
  section: Section;
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <header className="flex items-center gap-3 px-6 pt-10 pb-4">
        <button onClick={onBack} className="p-2 -ml-2 text-[#6B7280] text-xl active:opacity-60">
          ‹
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title}</span>
        </div>
      </header>
      <div className="flex-1 px-6 pb-10">{children}</div>
    </div>
  );
}
