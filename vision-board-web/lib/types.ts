export type SectionId = 1 | 2 | 3 | 4 | 5 | 6;

export type SlotId = 1 | 2 | 3 | 4 | 5 | 6;

// not_started → in_progress → text_complete → completed
// text_complete = PHASE1+2 done (텍스트 답변 완료)
// completed = scene + images 까지 완료
export type SectionStatus = 'not_started' | 'in_progress' | 'text_complete' | 'completed';

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
  images: (string | null)[];
  sceneText?: string;
  completedAt?: number;
}

export interface BoardData {
  sections: Record<SectionId, SectionData>;
  onboardingDone: boolean;
  userName: string;
  startedAt: number;
  finishedAt?: number;
}

export const PHASE1_SLOTS: SlotId[] = [1, 2, 3, 5];
