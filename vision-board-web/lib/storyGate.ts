import { freeChat } from './llm';
import { storyQualityIssues, hasForeignScript, stripForeignScript } from './honorific';

export interface GatedStoryOptions {
  system: string;
  user: string;
  temperature: number;
  geminiModel?: string;
  groqModel?: string;
  /** 재생성 지시의 문체 줄 — 기본은 미래 일기체. summarize처럼 다른 문체의 산출물은 반드시 오버라이드 */
  retryStyleLine?: string;
}

const DEFAULT_RETRY_STYLE = '처음부터 끝까지 반말 "~다"체로, 금지 표현 없이 다시 써줘.';

/** LLM 생성 + 품질 게이트 공용 경로 (v8.5) — /api/story·/api/story/section의 중복 블록 통합.
 *  1차 생성 → 이슈 검출 시 사유를 명시해 1회만 재생성(temp 0.7) → 재생성 결과를 다시 검증한다.
 *  재생성 후에도 외국 문자가 남으면 stripForeignScript로 기계 제거 — LLM 호출은 최대 2회
 *  (클라이언트 AbortController 30s 예산과 락스텝: app/finish·app/scene). 존댓말·클리셰 잔존은
 *  기계 제거가 불가능해 현행대로 통과시킨다. */
export async function generateGatedStory(opts: GatedStoryOptions): Promise<string> {
  const { retryStyleLine, ...chat } = opts;
  let story = await freeChat(chat);

  const issues = storyQualityIssues(story);
  if (issues.length > 0) {
    story = await freeChat({
      ...chat,
      user: `${chat.user}\n\n(주의: 직전 결과에 ${issues.join('·')} 표현이 섞여 있었어. ${retryStyleLine ?? DEFAULT_RETRY_STYLE})`,
      temperature: 0.7,
    });
    if (hasForeignScript(story)) {
      story = stripForeignScript(story);
    }
  }
  return story;
}
