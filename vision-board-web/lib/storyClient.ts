import { BoardData, SectionId } from './types';
import { SECTIONS, getSection } from './questions';
import { getTargetDate } from './targetDate';

// 클라이언트 스토리 생성 공용 경로 (v8.5) — /finish 최초 생성과 /diary 인라인 다듬기가
// 같은 코드를 쓴다. 30s abort: 서버 품질 게이트가 최대 2회 생성(락스텝 — lib/storyGate).
// 저장(saveFutureDayStory/saveMiniStory)은 호출부 책임 — 스탬프 규약이 호출부마다 다르다.

/** 보드 층위 '미래의 하루 이야기' 생성. 실패·타임아웃·빈 응답이면 throw */
export async function generateBoardStory(board: BoardData, oneSentence?: string): Promise<string> {
  const sectionData = SECTIONS.map((s) => {
    const sec = board.sections[s.id];
    const slots = sec.extractedSlots || {};
    return {
      title: s.title.split(' — ')[0],
      keyword: slots.keyword,
      want: slots.want,
      feeling: slots.feeling,
      sceneText: sec.sceneText,
      // v8.0 — 섹션 일기가 최종 이야기의 최우선 재료 (없는 섹션은 서버가 장면 메모로 폴백)
      miniStory: sec.miniStory,
    };
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: board.userName,
        oneSentence: oneSentence ?? board.oneSentence ?? '',
        targetDate: getTargetDate(board),
        sections: sectionData,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const story = (data.story as string) ?? '';
    if (!story.trim()) throw new Error('Empty story');
    return story;
  } finally {
    clearTimeout(timer);
  }
}

/** 섹션 층위 '미래 일기' 생성 — /scene 페이로드 조립과 동일. 실패·타임아웃·빈 응답이면 throw.
 *  ⚠️ 재생성 2회 캡(diaryRegenCount)은 호출부가 /scene과 같은 카운터로 관리할 것 */
export async function generateSectionStory(
  board: BoardData,
  sectionId: SectionId
): Promise<string> {
  const section = getSection(sectionId);
  const sec = board.sections[sectionId];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('/api/story/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionTitle: section?.title.split(' — ')[0] ?? '',
        extractedSlots: sec.extractedSlots || {},
        sceneText: sec.sceneText ?? '',
        targetDate: getTargetDate(board),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const story = (data.story as string) ?? '';
    if (!story.trim()) throw new Error('Empty story');
    return story;
  } finally {
    clearTimeout(timer);
  }
}
