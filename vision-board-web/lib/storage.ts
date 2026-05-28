import { BoardData, SectionData, SectionId, SlotAnswer, SlotId } from './types';

const STORAGE_KEY = 'vision-board-data';

function createEmptySection(id: SectionId): SectionData {
  return {
    id,
    status: 'not_started',
    currentPhase: 1,
    currentSlotIndex: 0,
    slots: {} as Record<SlotId, SlotAnswer | undefined>,
    images: [null, null, null],
  };
}

function createEmptyBoard(): BoardData {
  return {
    sections: {
      1: createEmptySection(1),
      2: createEmptySection(2),
      3: createEmptySection(3),
      4: createEmptySection(4),
      5: createEmptySection(5),
      6: createEmptySection(6),
    },
    onboardingDone: false,
    startedAt: Date.now(),
  };
}

export function loadBoard(): BoardData {
  if (typeof window === 'undefined') return createEmptyBoard();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyBoard();
    return JSON.parse(raw) as BoardData;
  } catch {
    return createEmptyBoard();
  }
}

export function saveBoard(data: BoardData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function saveSlotAnswer(
  sectionId: SectionId,
  slotId: SlotId,
  answer: SlotAnswer
): void {
  const board = loadBoard();
  board.sections[sectionId].slots[slotId] = answer;
  if (board.sections[sectionId].status === 'not_started') {
    board.sections[sectionId].status = 'in_progress';
  }
  saveBoard(board);
}

export function saveSectionImage(
  sectionId: SectionId,
  index: number,
  dataUrl: string | null
): void {
  const board = loadBoard();
  board.sections[sectionId].images[index] = dataUrl;
  saveBoard(board);
}

export function markSectionComplete(sectionId: SectionId): void {
  const board = loadBoard();
  board.sections[sectionId].status = 'completed';
  board.sections[sectionId].completedAt = Date.now();
  saveBoard(board);
}

export function markOnboardingDone(): void {
  const board = loadBoard();
  board.onboardingDone = true;
  saveBoard(board);
}

export function markBoardFinished(): void {
  const board = loadBoard();
  board.finishedAt = Date.now();
  saveBoard(board);
}

export function getCompletedCount(): number {
  const board = loadBoard();
  return Object.values(board.sections).filter((s) => s.status === 'completed').length;
}

export function resetBoard(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
