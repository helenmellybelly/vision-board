import { NextRequest, NextResponse } from 'next/server';
import { freeChat, freeLlmConfigured } from '@/lib/llm';
import { formatDiaryDate, seasonOf } from '@/lib/targetDate';
import { rateLimited, tooManyRequests, clampStr } from '@/lib/apiGuard';

interface SectionStoryRequest {
  sectionTitle: string;
  extractedSlots: {
    current?: string;
    want?: string;
    feeling?: string;
    keyword?: string;
  };
  sceneText: string;
  /** 목표 날짜(ISO) — 일기 헤더와 같은 날짜, 계절감 힌트로 사용 (v7.0-r3) */
  targetDate?: string;
  /** @deprecated v7.0-r2 — /scene 통합으로 별도 순간 입력 삭제. 레거시 클라이언트 호환용 */
  situationText?: string;
  additionalInput?: string;
}

// v7.0-r3: '소설 속 주인공의 하루' → '그날 밤 직접 쓴 일기'로 전면 개편.
// v7.3: 고정 아침~취침 아크·필수 체크리스트 제거 → 사용자 장면 중심 + 구체성 규칙 (형식적/어색하다는 피드백)
// 유지하는 품질 규칙: 장면 중심(요약 금지) ❌/✅ 예시, 감정단어 나열 금지,
// **볼드 1곳** (renderStory·image/describe의 storyBold 파이프라인 호환)
const SYSTEM_PROMPT = `당신은 사용자가 원하는 삶이 이미 이루어진 미래의 어느 날 밤,
그 사람이 하루를 돌아보며 직접 쓴 일기를 대신 써주는 작가입니다.

[핵심 원칙]
사용자 입력은 재료일 뿐입니다.
그 내용을 직접 서술하거나 요약하지 마세요.
그 상황이 실제로 벌어진 장면을 그날의 일기로 기록하세요.

❌ "브랜드가 유용하게 소비되고 있다는 생각이 났다"
✅ "고객 후기를 읽다가 손을 멈췄다. 이 사람, 진짜 달라졌네."

❌ "관계가 더 따뜻해졌다는 것을 느꼈다"
✅ "밥을 다 먹고도 한참을 앉아 있었다. 일어나자는 말이 먼저 안 나왔다."

❌ "몸이 가벼워졌다"
✅ "계단을 다 올라오고도 숨이 안 찼다. 그냥 걸었을 뿐인데."

[상황 설정]
- 원하는 삶이 이뤄진 어느 평범한 하루의 밤, 자기 전에 쓰는 일기
- 특별한 날이 아니라, 그 삶이 그냥 일상이 된 날
- "드디어 이뤘다"는 감격의 날이 아니라, 원하던 삶이 당연해진 어느 날
- 날짜는 일기장 헤더에 따로 표시되므로 본문에 날짜·요일을 쓰지 말 것

[하루의 흐름]
사용자가 그려낸 장면을 하루의 중심에 두고, 그 앞뒤로 시간이 흐르게 쓰세요.
시간 순서가 느껴지면 충분합니다. 아침·점심·저녁·밤을 전부 채우려 하지 마세요.
장면 2~4개. 중심 장면 하나는 길게, 나머지는 스치듯 짧게.

[구체성 — 이 일기가 진짜처럼 느껴지는 이유]
- 사용자가 쓴 고유한 단어(장소·사람·물건·활동 이름)를 최소 2개, 그대로 살려서 등장시킬 것
- 장면마다 감각 디테일 1개 이상 (보이는 것, 들리는 것, 손에 닿는 것)
- 일반 명사보다 구체적으로: "카페" 말고 "2층 창가 자리", "운동" 말고 "스쿼트 마지막 세트"

[섹션 특성에 따라 자연스러우면 포함 — 억지로 넣지 말 것]
- 누구를 만나거나 어떤 연락이 왔는지
  → 관계 섹션에서 비중 크게, 나/일 섹션에서 가볍게
- 무엇을 입고 있었는지
  → 나/일/돈 섹션에서 분위기 잡을 때만
- 몸의 감각이나 움직임
  → 건강 섹션에서 중심으로, 나머지는 배경으로만
- 함께 있던 사람의 디테일 (표정, 말투, 손짓)
  → 관계 섹션에서 중심으로
- 공간의 감각 (빛, 온도, 소리, 냄새)
  → 공간 섹션에서 중심으로, 나머지는 배경으로만
- 소비하거나 선택한 순간
  → 돈 섹션에서 중심으로 (망설임 없이 고르는 장면)

[날씨·계절·빛]
[일기 날짜]의 계절감이 공간 묘사의 배경에 자연스럽게 배어나게.
"햇빛이 책상 모서리까지 들어왔다" 처럼. 억지로 넣지 말 것.

[작은 습관 하나]
이 사람만의 루틴 1개.
"커피는 항상 직접 내려 마신다"
"잠들기 전 노트에 짧게 적는다"
읽는 사람이 "아, 이게 나구나" 하고 체감하는 디테일.

[감정 — 나열하지 말고 스며들게]
감정 단어를 나열하지 말 것:
뿌듯한 / 편안한 / 충만한 / 설레는 / 행복한 / 감사한

기본은 그 감정이 느껴지는 행동이나 감각으로:
❌ "뿌듯함을 느꼈다" → ✅ "저장 버튼을 누르고 잠깐 화면을 바라봤다"
❌ "편안했다" → ✅ "커피가 식는 줄도 모르고 읽었다"
❌ "설렜다" → ✅ "알람을 끄기 전에 이미 눈이 떠져 있었다"
❌ "따뜻했다" → ✅ "밥을 다 먹고도 한참을 앉아 있었다"

단, 일기답게 솔직한 감정 한두 마디는 자연스러우면 허용.
"오늘 하루, 나쁘지 않았다" 이 정도의 담백한 수준으로 — 마지막 줄이 아니어도 됨.

[쓰는 방식 — 일기체]
- 1인칭 일기. "~다"로 끝나는 담백한 문장을 기본으로,
  가끔 혼잣말을 섞어 사람 냄새가 나게 ("~네", "~지 뭐", "...")
- 문장은 짧게. 생각나는 대로 툭툭 적은 느낌
- 그날 들은 말이나 내가 한 말을 따옴표 대사로 1번 정도 넣어도 좋음
- [방향 키워드]가 하루 전체의 톤이 되게 — 단어를 그대로 쓰지 말고 분위기로
- 길이: 450-650자
- 볼드 1곳만 — 하루 중 가장 생생한 순간

[절대 금지]
- "~라는 생각이 났다 / 들었다"
- "~을 실감한다 / 느낀다 / 깨달았다"
- "~다는 것을 알았다"
- 사용자의 문장을 통째로 복사하기 (단, 사용자가 쓴 고유명사·구체어는 그대로 쓸 것)
- 인사말, 진부한 서두 ("오늘은 참 ~한 하루였다" 류)
- 본문에 날짜·요일 직접 언급
- 섹션 이름 직접 언급 (나/건강/관계/일/돈/공간)
- 감정 단어 나열`;

export async function POST(req: NextRequest) {
  // v7.4 LLM 무료화 — gpt-4o-mini → Gemini flash(1차)·Groq(2차). 프롬프트는 불변
  if (!freeLlmConfigured()) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: SectionStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 입력 길이 상한 — 프롬프트 토큰 비용 증폭 차단. extractedSlots가 없어도 안전.
  const rawSlots = body.extractedSlots ?? {};
  const extractedSlots = {
    current: clampStr(rawSlots.current, 2000),
    want: clampStr(rawSlots.want, 2000),
    feeling: clampStr(rawSlots.feeling, 2000),
    keyword: clampStr(rawSlots.keyword, 200),
  };
  const sceneText = clampStr(body.sceneText, 4000);
  const targetDate = clampStr(body.targetDate, 40);
  const situationText = clampStr(body.situationText, 4000);
  const additionalInput = clampStr(body.additionalInput, 4000);

  // v7.0-r2: 순간 별도 입력이 사라짐 — 목록이 없으면 하루 서술에서 AI가 직접 골라 배치
  const momentText = [situationText, additionalInput]
    .filter((t): t is string => !!t?.trim())
    .join('\n');

  const momentLine = momentText.trim()
    ? `[보고 싶은 순간들]\n${momentText}`
    : `[보고 싶은 순간들]\n별도 목록 없음 — [그려낸 장면] 안에서 인상적인 순간들을 스스로 골라 하루의 흐름에 배치할 것.`;

  const dateLine = targetDate
    ? `[일기 날짜]\n${formatDiaryDate(targetDate)} (계절: ${seasonOf(targetDate)}) — 본문에 날짜를 쓰지 말고 계절감만 배경에`
    : '';

  const keywordLine = extractedSlots.keyword
    ? `[방향 키워드 — 하루 전체의 톤]\n${extractedSlots.keyword}`
    : '';

  const userPrompt = `${dateLine}

${keywordLine}

[이 사람이 원하는 것들]
${extractedSlots.want || ''}

[그려낸 장면]
${sceneText}

${momentLine}

[이 삶이 이뤄지면 어떤 기분일 것 같다고 했는지]
${extractedSlots.feeling || ''}

위 재료로, 이 사람이 원하는 삶을 사는 미래의 그날 밤에
직접 쓴 일기를 써줘.
장면을 보여주되, 요약하거나 설명하지 마.
[그려낸 장면]이 하루의 중심이 되게.`;

  try {
    // 일기는 결과물 품질이 핵심 — flash 상위 모델 사용 (나머지 유틸 라우트는 flash-lite)
    const story = await freeChat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.9,
      geminiModel: 'gemini-flash-latest',
    });
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Section story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
