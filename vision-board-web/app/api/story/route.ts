import { NextRequest, NextResponse } from 'next/server';
import { freeChat, freeLlmConfigured } from '@/lib/llm';
import { formatDiaryDate, seasonOf } from '@/lib/targetDate';
import { rateLimited, tooManyRequests, clampStr } from '@/lib/apiGuard';
import { hasHonorific } from '@/lib/honorific';

interface StorySection {
  title: string;
  keyword?: string;
  want?: string;
  feeling?: string;
  sceneText?: string;
  /** v8.0 — 섹션 단계에서 이미 완성된 미래 일기. 있으면 최우선 재료 */
  miniStory?: string;
  situationText?: string;
}

interface StoryRequest {
  userName: string;
  oneSentence: string;
  /** 목표 날짜(ISO) — 섹션 일기와 같은 날짜, 계절감 힌트 (v8.0) */
  targetDate?: string;
  sections: StorySection[];
}

// v8.0 전면 개편 — 구 버전은 Groq Llama-8B 직접 호출 + 지시 1줄 + 300자 제한이라
// 존댓말 혼입·짜깁기·어색한 한국어가 났다. 섹션 일기 route의 검증된 스타일 가이드를
// "하루 통합판"으로 확장하고, 재료도 원본 답변 대신 완성된 섹션 일기 6편을 쓴다.
const SYSTEM_PROMPT = `당신은 사용자가 원하는 삶이 이미 이루어진 미래의 어느 날 밤,
그 사람이 하루 전체를 돌아보며 직접 쓴 일기를 대신 써주는 작가입니다.

재료로 이 사람이 삶의 영역별로 미리 써 둔 일기 조각들이 주어집니다.
당신의 일은 조각들을 이어 붙이는 게 아니라,
한 사람의 진짜 하루로 다시 짜는 것입니다.

[핵심 원칙]
- 조각을 순서대로 요약·나열하지 마세요. 시간대를 재배치하고, 겹치는 장면은 하나로 합치세요.
- 모든 조각을 다 담으려 하지 마세요. 하루에 자연스럽게 들어가는 장면만 고르되,
  서로 다른 영역의 장면이 최소 4개는 등장해야 합니다.
- 새로운 사건·인물·물건을 지어내지 마세요. 재료 속 고유명사·구체어는 그대로 살리세요.

[말투 — 절대 규칙]
- 처음부터 끝까지 1인칭 반말 일기체, "~다"로 끝나는 담백한 문장으로만 씁니다.
- 존댓말 어미(~요, ~습니다, ~세요 등)는 단 한 번도 쓰지 마세요.
- 가끔 혼잣말을 섞어 사람 냄새가 나게 ("~네", "~지 뭐", "...")

[하루의 흐름]
- 아침에 눈 뜨는 순간부터 밤에 이 일기를 쓰는 순간까지, 시간이 한 방향으로만 흐르게.
- 장면 4~6개. 중심 장면 1~2개는 길게, 나머지는 스치듯 짧게.
- 영역 이름(나/건강/관계/일/돈/공간)을 본문에 쓰지 말고, 영역 순서대로 배치하지도 마세요.
- 특별한 날이 아니라, 원하던 삶이 그냥 일상이 된 평범한 하루입니다.

[자연스러운 한국어]
- 한국 일상에서 실제로 쓰는 표현만 쓰세요. 번역투·어색한 행위 묘사 금지.
  ❌ "아이와 키스한다" → ✅ "아이 이마에 입을 맞췄다" / "아이를 꼭 안아줬다"
  ❌ "나의 하루를 시작한다" → ✅ "하루를 연다"
- 주어 "나는/나의"를 반복하지 마세요. 일기에서는 대부분 생략됩니다.

[구체성·감정]
- 장면마다 감각 디테일 1개 이상 (보이는 것, 들리는 것, 손에 닿는 것)
- 감정 단어를 나열하지 말고 행동과 감각으로 스며들게:
  ❌ "뿌듯함을 느꼈다" → ✅ "저장 버튼을 누르고 잠깐 화면을 바라봤다"
- "~라는 생각이 났다 / ~을 실감했다 / ~을 깨달았다" 금지

[형식]
- 길이: 600~800자, 3~5문단
- 볼드(**) 1곳만 — 하루 중 가장 생생한 순간
- 인사말·진부한 서두 금지 ("오늘은 참 ~한 하루였다" 류)
- 본문에 날짜·요일을 직접 쓰지 말 것 — 계절감만 배경에
- [한 문장]의 정서가 하루 전체의 톤이 되게 하되, 문장을 그대로 인용하지 말 것
- 마지막 문단은 잠들기 전 하루를 닫는 감각으로 — [한 문장]의 정서를 자기 말로 변주해 마무리`;

function buildUserPrompt(body: StoryRequest): string {
  const userName = clampStr(body.userName, 100);
  const oneSentence = clampStr(body.oneSentence, 500);
  const targetDate = clampStr(body.targetDate, 40);
  const sections = Array.isArray(body.sections) ? body.sections.slice(0, 6) : [];

  const pieces = sections
    .filter((s) => s && (s.miniStory || s.sceneText || s.keyword))
    .map((s) => {
      const title = clampStr(s.title, 100);
      const keyword = clampStr(s.keyword, 200);
      const head = `《${title}${keyword ? ` — 방향: ${keyword}` : ''}》`;
      // 완성된 섹션 일기가 최우선 재료 — 없으면 장면 메모로 폴백
      if (s.miniStory) return `${head}\n${clampStr(s.miniStory, 2000)}`;
      const parts = [];
      if (s.sceneText) parts.push(`장면 메모: ${clampStr(s.sceneText, 2000)}`);
      if (s.want) parts.push(`원하는 것: ${clampStr(s.want, 1000)}`);
      if (s.feeling) parts.push(`이뤄졌을 때의 기분: ${clampStr(s.feeling, 1000)}`);
      return `${head}\n${parts.join('\n')}`;
    })
    .join('\n\n');

  const dateLine = targetDate
    ? `[일기 날짜]\n${formatDiaryDate(targetDate)} (계절: ${seasonOf(targetDate)}) — 본문에 날짜를 쓰지 말고 계절감만 배경에\n\n`
    : '';

  return `${dateLine}[이 사람 — ${userName || '이름 미상'}이 한 문장으로 정리한 원하는 삶]
"${oneSentence}"

[영역별 일기 조각들]
${pieces}

위 조각들을 재료로, 이 삶이 이루어진 미래의 어느 하루를
그날 밤에 직접 쓴 일기 한 편으로 다시 써줘.
조각을 이어 붙이지 말고, 하나의 하루로 다시 짜줘.`;
}

export async function POST(req: NextRequest) {
  if (!freeLlmConfigured()) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: StoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userPrompt = buildUserPrompt(body);

  try {
    // 최종 일기도 섹션 일기와 같은 품질 경로 — flash 상위 모델 (v8.0)
    let story = await freeChat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.85,
      geminiModel: 'gemini-flash-latest',
    });

    // 품질 게이트 — 존댓말이 섞이면 1회만 다시 쓴다 (반말 일기체 계약)
    if (hasHonorific(story)) {
      story = await freeChat({
        system: SYSTEM_PROMPT,
        user: `${userPrompt}\n\n(주의: 직전 결과에 존댓말이 섞여 있었어. 처음부터 끝까지 반말 "~다"체로만 다시 써줘.)`,
        temperature: 0.7,
        geminiModel: 'gemini-flash-latest',
      });
    }

    return NextResponse.json({ story });
  } catch (err) {
    console.error('Story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
