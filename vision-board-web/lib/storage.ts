import { BoardData, CollageLayout, CollageTemplate, SectionData, SectionId, SlotAnswer, SlotId, ChatMessage, ExtractedSlots } from './types';

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
    migrateCollage(parsed);
    return parsed;
  } catch {
    return createEmptyBoard();
  }
}

// v6.15 마이그레이션: '내 배치' 탭 제거 — custom 템플릿 선택값과 그 배치를 polaroid로 이관 (1회, 멱등)
function migrateCollage(board: BoardData): void {
  let dirty = false;
  if ((board.collageTemplate as string) === 'custom') {
    board.collageTemplate = 'polaroid';
    dirty = true;
  }
  if (board.collageLayout && !board.collageLayouts) {
    board.collageLayouts = { polaroid: board.collageLayout };
    board.collageLayout = undefined;
    dirty = true;
  }

  // v6.19: 기존 배치에 제작 당시 비율 스탬프 — v6.18 배치는 보드 4:5 / 폰 1170×2532 / PC 1920×1080 고정이었다
  const stampAspect = (
    layouts: Partial<Record<CollageTemplate, CollageLayout>> | undefined,
    aspect: number
  ) => {
    if (!layouts) return;
    for (const layout of Object.values(layouts)) {
      if (layout && layout.aspect === undefined) {
        layout.aspect = aspect;
        dirty = true;
      }
    }
  };
  stampAspect(board.collageLayouts, 4 / 5);
  stampAspect(board.collageDeviceLayouts?.phone, 1170 / 2532);
  stampAspect(board.collageDeviceLayouts?.desktop, 1920 / 1080);
  // 기기 배치가 있는데 사이즈 미선택이면 v6.18 캐논 캔버스와 비율이 일치하는 기본 프리셋으로 — 기존 배치 무손실
  if (!board.collageDevicePresets && board.collageDeviceLayouts) {
    board.collageDevicePresets = { phone: 'phone', desktop: 'pc-fhd' };
    dirty = true;
  }

  if (dirty) saveBoard(board);
}

// 저장 성공 여부 반환 — base64 이미지 누적으로 localStorage 5MB 한도(QuotaExceededError)에 닿을 수 있다 (v6.17)
export function trySaveBoard(data: BoardData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function saveBoard(data: BoardData): void {
  trySaveBoard(data);
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

export function saveCollageTemplate(template: CollageTemplate): void {
  const board = loadBoard();
  board.collageTemplate = template;
  saveBoard(board);
}

export function saveCollageLayout(template: CollageTemplate, layout: CollageLayout): void {
  const board = loadBoard();
  board.collageLayouts = { ...board.collageLayouts, [template]: layout };
  saveBoard(board);
}

// 기기 타깃별(폰/PC) 배치 — 보드(collageLayouts)와 분리 저장 (v6.18)
export function saveCollageDeviceLayout(
  target: 'phone' | 'desktop',
  template: CollageTemplate,
  layout: CollageLayout
): void {
  const board = loadBoard();
  board.collageDeviceLayouts = {
    ...board.collageDeviceLayouts,
    [target]: { ...board.collageDeviceLayouts?.[target], [template]: layout },
  };
  saveBoard(board);
}

// 기기별 선택 사이즈(WALLPAPER_PRESETS id) 저장 (v6.19)
export function saveCollageDevicePreset(target: 'phone' | 'desktop', presetId: string): void {
  const board = loadBoard();
  board.collageDevicePresets = { ...board.collageDevicePresets, [target]: presetId };
  saveBoard(board);
}

// 비율이 다른 사이즈로 변경 시 — 해당 기기의 모든 템플릿 배치를 비우고 새 비율로 리시드 (v6.19)
export function clearCollageDeviceLayouts(target: 'phone' | 'desktop'): void {
  const board = loadBoard();
  if (board.collageDeviceLayouts?.[target]) {
    delete board.collageDeviceLayouts[target];
    saveBoard(board);
  }
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

export function saveImageKeywords(sectionId: SectionId, keywords: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].imageKeywords = keywords;
  saveBoard(board);
}

// 성공 여부 반환 — false면 저장 공간 부족 (호출부에서 무시해도 무방)
export function saveUploadedImage(sectionId: SectionId, index: number, dataUrl: string | null): boolean {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  const current = sec.uploadedImages ?? [null, null, null, null, null];
  while (current.length < 5) current.push(null);
  current[index] = dataUrl;
  sec.uploadedImages = current;
  return trySaveBoard(board);
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
  sec.imageKeywords = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}
