'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSlotAnswer, markSectionTextComplete } from '@/lib/storage';
import { BoardData, Section, SlotAnswer, SlotId, PHASE1_SLOTS, SectionId } from '@/lib/types';
import SlotQuestion from './SlotQuestion';
import PhaseReview from './PhaseReview';
import DeferredCheck from './DeferredCheck';
import SectionComplete from './SectionComplete';
import ProcessBar from '@/components/ProcessBar';

type Phase = 'slot' | 'review' | 'deferred' | 'complete';
type SlotSource = 'flow' | 'edit';

export default function SectionPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;

  const section = getSection(sectionId);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [phase, setPhase] = useState<Phase>('slot');
  const [slotIndex, setSlotIndex] = useState(0);
  const [slotSource, setSlotSource] = useState<SlotSource>('flow');

  const refreshBoard = useCallback(() => setBoard(loadBoard()), []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    if (b.sections[sectionId]?.status === 'text_complete' || b.sections[sectionId]?.status === 'completed') {
      setPhase('review');
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
    const freshBoard = loadBoard();
    const allTextDone = ([1, 2, 3, 4, 5, 6] as SectionId[]).every(
      (id) => freshBoard.sections[id].status === 'text_complete' || freshBoard.sections[id].status === 'completed'
    );
    if (allTextDone) {
      router.push('/review');
      return;
    }
    const nextIncomplete = ([1, 2, 3, 4, 5, 6] as SectionId[]).find(
      (id) => id > sectionId && (freshBoard.sections[id].status === 'not_started' || freshBoard.sections[id].status === 'in_progress')
    );
    if (nextIncomplete) {
      router.push(`/section/${nextIncomplete}`);
    } else {
      router.push('/review');
    }
  }

  const currentSlot = section.slots.find((s) => s.id === PHASE1_SLOTS[slotIndex]);

  return (
    <SectionShell
      section={section}
      board={board}
      onDashboard={() => router.push('/dashboard')}
    >
      {phase === 'slot' && currentSlot && (
        <SlotQuestion
          key={`slot-${slotIndex}-${slotSource}`}
          section={section}
          slot={currentSlot}
          slotIndex={slotIndex}
          totalSlots={PHASE1_SLOTS.length}
          savedAnswer={sectionData.slots[PHASE1_SLOTS[slotIndex] as SlotId]}
          isEditing={slotSource === 'edit'}
          onSave={(answer) => { setSlotSource('flow'); handleSlotSave(answer); }}
          onSkip={handleSlotSkip}
          onBack={slotIndex > 0 ? () => { setSlotSource('flow'); setSlotIndex((i) => i - 1); } : undefined}
        />
      )}
      {phase === 'review' && (
        <PhaseReview
          section={section}
          slots={sectionData.slots}
          onEdit={(slotIdx) => { setSlotIndex(slotIdx); setSlotSource('edit'); setPhase('slot'); }}
          onNext={handleReviewDone}
          onBack={() => { setSlotIndex(PHASE1_SLOTS.length - 1); setSlotSource('flow'); setPhase('slot'); }}
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
        <SectionComplete
          section={section}
          sectionId={sectionId}
          board={board}
          onDone={handleComplete}
          onDashboard={() => router.push('/dashboard')}
        />
      )}
    </SectionShell>
  );
}

function SectionShell({
  section,
  board,
  onDashboard,
  children,
}: {
  section: Section;
  board: BoardData;
  onDashboard: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      {/* 전체 프로세스 바 */}
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-6 pt-2 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title}</span>
        </div>
        <button
          onClick={onDashboard}
          className="text-xs text-[#9CA3AF] active:opacity-60 py-1"
        >
          대시보드로
        </button>
      </header>
      <div className="flex-1 px-6 pb-10">{children}</div>
    </div>
  );
}
