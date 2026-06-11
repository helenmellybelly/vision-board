export type SectionId = 1 | 2 | 3 | 4 | 5 | 6;

export type SlotId = 1 | 2 | 3 | 4 | 5 | 6;

// not_started → in_progress → text_complete → completed
// text_complete = 채팅 대화 완료
// completed = scene + images 까지 완료
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

export interface SectionQuestion {
  key: keyof ExtractedSlots;
  label: string;
  cushionText: string;
  questionText: string;
  placeholder: string;
}

export interface Section {
  id: SectionId;
  title: string;
  shortTitle?: string;
  subtitle: string;
  color: string;
  lightColor: string;
  slots: Slot[];
  imageHints: string[];
  imageHintIntro: string;
  introText: string;
  whyText: string;
  phaseOneQuestions: SectionQuestion[];
  reviewTemplate: string;
  situationChips?: string[];
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
  situationText?: string;
  miniStory?: string;
  generatedImages?: string[];
  imageDescriptions?: string[];          // AI 제안 한국어 묘사 3개 (사용자 편집 가능)
  uploadedImages?: (string | null)[];   // 사용자 직접 업로드 이미지 (최대 3개 — 보드·콜라주와 동일)
}

// 콜라주(한눈에 보기) 템플릿 — custom = 사용자가 직접 배치한 보드
export type CollageTemplate = 'polaroid' | 'mosaic' | 'minimal' | 'custom';

// 커스텀 배치 항목 — 0..1 정규화 좌표 (4:5 보드 기준). 키는 `${sectionId}-${slotIdx}`
export interface CollageLayoutItem {
  x: number; // 좌상단 x (컨테이너 폭 대비)
  y: number; // 좌상단 y (컨테이너 높이 대비)
  w: number; // 폭 (컨테이너 폭 대비, 정사각 사진)
  z: number; // 쌓임 순서 (클수록 앞)
}

export interface CollageLayout {
  items: Record<string, CollageLayoutItem>;
}

export interface BoardData {
  sections: Record<SectionId, SectionData>;
  onboardingDone: boolean;
  userName: string;
  startedAt: number;
  finishedAt?: number;
  onboardingStep?: number;
  welcomeSeen?: boolean;
  oneSentence?: string;
  futureDayStory?: string;
  boardYear?: string;                    // 비전보드 콜라주 중앙 연도
  collageTemplate?: CollageTemplate;     // 한눈에 보기 템플릿 선택값
  collageLayout?: CollageLayout;         // 커스텀 배치 (custom 템플릿)
}

export const PHASE1_SLOTS: SlotId[] = [1, 3, 5, 2];
