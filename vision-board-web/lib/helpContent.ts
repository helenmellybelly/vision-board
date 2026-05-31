import { ExtractedSlots } from './types';

export type HelpStep = 1 | 2 | 3 | 4;

interface HelpContent {
  alternativeQuestions: string[];
  exampleAnswers: string[];
}

export const HELP_CONTENT: Record<HelpStep, HelpContent> = {
  1: {
    alternativeQuestions: [
      '요즘 이 부분 몇 점이야? (1~10점으로)',
      '오늘 하루 이 부분 어떠했어?',
    ],
    exampleAnswers: [
      '바쁘고 지침',
      '뭔가 막혀있는 느낌',
      '매일 비슷한 걸 반복하는 것 같아서 좀 지루해',
      '하고 싶은 게 많은데 시작을 못하고 있어',
    ],
  },
  2: {
    alternativeQuestions: [
      '이 부분이 어떻게 바뀌면 좋겠어?',
      '1년 후 이 영역 어떤 모습이면 좋을 것 같아?',
    ],
    exampleAnswers: [
      '여유롭게',
      '성장하는 느낌',
      '매일 내가 좋아하는 일을 할 수 있으면 좋겠어',
      '돈 걱정 없이 하고 싶은 거 하면서 사는 거',
    ],
  },
  3: {
    alternativeQuestions: [
      '그 미래가 이루어진다면 어떤 기분일 것 같아?',
      '그 모습을 상상할 때 몸에서 어떤 느낌이 와?',
    ],
    exampleAnswers: [
      '가볍고 설레는',
      '뭔가 단단한',
      '긴장이 풀리면서 드디어 제자리를 찾은 느낌',
      '아침에 눈 뜨는 게 기대되는 느낌',
    ],
  },
  4: {
    alternativeQuestions: [
      '이 섹션의 방향을 한두 단어로 표현하면?',
      '이 비전에서 가장 중요한 느낌 단어는?',
    ],
    exampleAnswers: [
      '자유',
      '성장',
      '자유롭고 풍족한',
      '단단하고 여유로운',
    ],
  },
};

export function getCurrentStep(slots: ExtractedSlots): HelpStep {
  if (!slots.current) return 1;
  if (!slots.want) return 2;
  if (!slots.feeling) return 3;
  return 4;
}
