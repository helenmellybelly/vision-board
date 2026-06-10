import { BoardData, SectionData, SectionId, SlotAnswer, SlotId, ChatMessage, ExtractedSlots } from './types';

const STORAGE_KEY = 'vision-board-data';

function createEmptySection(id: SectionId): SectionData {
  return {
    id,
    status: 'not_started',
    currentPhase: 1,
    currentSlotIndex: 0,
    slots: {} as Record<SlotId, SlotAnswer | undefined>,
    images: [null, null, null],
    uploadedImages: [null, null, null, null, null],
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
    userName: '',
    startedAt: Date.now(),
  };
}

export function loadBoard(): BoardData {
  if (typeof window === 'undefined') return createEmptyBoard();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyBoard();
    const parsed = JSON.parse(raw) as BoardData;
    if (parsed.userName === undefined) parsed.userName = '';
    return parsed;
  } catch {
    return createEmptyBoard();
  }
}

export function saveBoard(data: BoardData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function saveUserName(name: string): void {
  const board = loadBoard();
  board.userName = name;
  saveBoard(board);
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

export function saveSectionScene(sectionId: SectionId, text: string): void {
  const board = loadBoard();
  board.sections[sectionId].sceneText = text;
  saveBoard(board);
}

export function saveSectionSceneTexts(sectionId: SectionId, texts: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].sceneTexts = texts;
  saveBoard(board);
}

export function markSectionTextComplete(sectionId: SectionId): void {
  const board = loadBoard();
  board.sections[sectionId].status = 'text_complete';
  saveBoard(board);
}

export function markSectionComplete(sectionId: SectionId): void {
  const board = loadBoard();
  board.sections[sectionId].status = 'completed';
  board.sections[sectionId].completedAt = Date.now();
  saveBoard(board);
}

export function saveOnboardingStep(step: number): void {
  const board = loadBoard();
  board.onboardingStep = step;
  saveBoard(board);
}

export function markOnboardingDone(): void {
  const board = loadBoard();
  board.onboardingDone = true;
  board.onboardingStep = undefined;
  saveBoard(board);
}

export function markWelcomeSeen(): void {
  const board = loadBoard();
  board.welcomeSeen = true;
  saveBoard(board);
}

export function markBoardFinished(): void {
  const board = loadBoard();
  board.finishedAt = Date.now();
  saveBoard(board);
}

export function resetBoard(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ── 채팅 기반 신규 함수 ──

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
  if (board.sections[sectionId].status === 'not_started') {
    board.sections[sectionId].status = 'in_progress';
  }
  // 하위 호환: 기존 SlotAnswer 형식으로도 저장
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

export function saveBoardYear(year: string): void {
  const board = loadBoard();
  board.boardYear = year;
  saveBoard(board);
}

export function saveFutureDayStory(story: string): void {
  const board = loadBoard();
  board.futureDayStory = story;
  saveBoard(board);
}

export function saveSituationText(sectionId: SectionId, text: string): void {
  const board = loadBoard();
  board.sections[sectionId].situationText = text;
  saveBoard(board);
}

export function saveMiniStory(sectionId: SectionId, story: string): void {
  const board = loadBoard();
  board.sections[sectionId].miniStory = story;
  saveBoard(board);
}

export function saveGeneratedImages(sectionId: SectionId, urls: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].generatedImages = urls;
  saveBoard(board);
}

export function saveImageDescriptions(sectionId: SectionId, descriptions: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].imageDescriptions = descriptions;
  saveBoard(board);
}

export function saveUploadedImage(sectionId: SectionId, index: number, dataUrl: string | null): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  const current = sec.uploadedImages ?? [null, null, null, null, null];
  while (current.length < 5) current.push(null);
  current[index] = dataUrl;
  sec.uploadedImages = current;
  saveBoard(board);
}

export function saveUploadedImages(sectionId: SectionId, images: (string | null)[]): void {
  const board = loadBoard();
  board.sections[sectionId].uploadedImages = images;
  saveBoard(board);
}

// AI 이미지만 초기화 (업로드 이미지 유지)
export function resetAiImages(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.generatedImages = undefined;
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}

// C1: 수정 캐스케이드 리셋 함수들

export function resetImages(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.generatedImages = undefined;
  sec.imageDescriptions = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}

export function resetToDescriptions(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.imageDescriptions = undefined;
  sec.generatedImages = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}

export function resetToSituation(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.miniStory = undefined;
  sec.imageDescriptions = undefined;
  sec.generatedImages = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}

export function resetToScene(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.status = 'text_complete';
  sec.sceneText = undefined;
  sec.sceneTexts = undefined;
  sec.sceneMessages = undefined;
  sec.situationText = undefined;
  sec.miniStory = undefined;
  sec.imageDescriptions = undefined;
  sec.generatedImages = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  saveBoard(board);
}

export function resetToAnswers(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.status = 'in_progress';
  sec.sceneText = undefined;
  sec.sceneTexts = undefined;
  sec.sceneMessages = undefined;
  sec.situationText = undefined;
  sec.miniStory = undefined;
  sec.imageDescriptions = undefined;
  sec.generatedImages = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  saveBoard(board);
}
