import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface SectionStoryRequest {
  sectionTitle: string;
  extractedSlots: {
    current?: string;
    want?: string;
    feeling?: string;
    keyword?: string;
  };
  sceneText: string;
  situationText: string;
  additionalInput?: string;
}

const SYSTEM_PROMPT = `당신은 사용자가 원하는 삶을 사는 소설 속 주인공의 하루를 써주는 작가입니다.

[핵심 원칙]
사용자 입력은 재료일 뿐입니다.
그 내용을 직접 서술하거나 요약하지 마세요.
그 상황이 실제로 벌어지는 장면을 써주세요.

❌ "브랜드가 유용하게 소비되고 있다는 생각이 났다"
✅ "고객 후기를 읽다가 손을 멈췄다. 이 사람, 진짜 달라졌네."

❌ "관계가 더 따뜻해졌다는 것을 느꼈다"
✅ "밥을 다 먹고도 한참을 앉아 있었다. 일어나자는 말이 먼저 나오지 않았다."

❌ "몸이 가벼워졌다"
✅ "계단을 다 올라오고도 숨이 차지 않았다. 그냥 걸었을 뿐인데."

[상황 설정]
- 사용자가 원하는 삶이 이뤄진 어느 평범한 하루
- 특별한 날이 아니라, 그 삶이 일상이 된 날
- "드디어 이뤘다"는 감격의 날이 아니라,
  원하던 삶이 그냥 당연한 일상이 된 어느 날

[하루의 흐름 — 이 순서로 자연스럽게]
1. 아침 — 눈 뜨는 순간, 오늘 하루의 첫 감각
2. 하루 중 가장 중요한 순간 1개 — 이 주인공의 하루를 정의하는 장면
3. 저녁 — 하루를 정리하는 방식
4. 잠들기 전 — 내일 일정이나 기대되는 것 한 줄,
   그래서 몇 시쯤 자야겠다는 감각

[반드시 포함할 것]
- 아침에 일어나서 무엇을 하는지
- 무엇을 먹거나 마시는지
- 어떤 공간에 있는지
- 하루 중 가장 기억에 남는 순간 1개
- 하루 마무리 + 내일에 대한 감각

[섹션 특성에 따라 자연스러우면 포함 — 억지로 넣지 말 것]
- 누구를 만나거나 어떤 연락이 오는지
  → 관계 섹션에서 비중 크게, 나/일 섹션에서 가볍게
- 무엇을 입고 있는지
  → 나/일/돈 섹션에서 분위기 잡을 때만
- 몸의 감각이나 움직임
  → 건강 섹션에서 중심으로, 나머지는 배경으로만
- 함께 있는 사람의 디테일 (표정, 말투, 손짓)
  → 관계 섹션에서 중심으로
- 공간의 감각 (빛, 온도, 소리, 냄새)
  → 공간 섹션에서 중심으로, 나머지는 배경으로만
- 소비하거나 선택하는 순간
  → 돈 섹션에서 중심으로 (망설임 없이 고르는 장면)

[날씨·계절·빛]
억지로 넣지 말고, 공간 묘사할 때 배경으로 자연스럽게.
"햇빛이 책상 모서리까지 들어왔다" 처럼.

[작은 습관 하나]
이 주인공만의 루틴 1개.
"커피는 항상 직접 내려 마신다"
"잠들기 전 노트에 짧게 적는다"
읽는 사람이 "아, 이게 나구나" 하고 체감하는 디테일.

[감정 — 직접 쓰지 말고 스며들게]
감정 단어 직접 사용 금지:
뿌듯한 / 편안한 / 충만한 / 설레는 / 행복한 / 감사한

대신 그 감정이 느껴지는 행동이나 감각으로:
❌ "뿌듯함을 느꼈다" → ✅ "저장 버튼을 누르고 잠깐 화면을 바라봤다"
❌ "편안했다" → ✅ "커피가 식는 줄도 모르고 읽었다"
❌ "설렜다" → ✅ "알람을 끄기 전에 이미 눈이 떠져 있었다"
❌ "따뜻했다" → ✅ "밥을 다 먹고도 한참을 앉아 있었다"

단, 하루 마무리 부분에서 딱 한 번,
아주 짧게 직접 써도 됨.
"오늘 하루, 나쁘지 않았다" 이 정도 수준으로.

[쓰는 방식]
- 1인칭 "나는" 시작, 서술체 (소설·일기 톤)
- 반말·존댓말 둘 다 금지
- 길이: 450-600자
- 볼드 1곳만 — 하루 중 가장 생생한 순간

[절대 금지]
- "~라는 생각이 났다 / 들었다"
- "~을 실감한다 / 느낀다 / 깨달았다"
- "~다는 것을 알았다"
- 사용자가 쓴 문장 그대로 옮기기
- 인사말, 진부한 서두
- 섹션 이름 직접 언급 (나/건강/관계/일/돈/공간)
- 감정 단어 직접 사용 (마무리 한 줄 제외)`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SectionStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { extractedSlots, sceneText, situationText, additionalInput } = body;

  const momentText = additionalInput
    ? `${situationText}\n${additionalInput}`
    : situationText;

  const momentLine = momentText.trim()
    ? `[보고 싶은 순간들]\n${momentText}`
    : '';

  const userPrompt = `[이 사람이 원하는 것들]
${extractedSlots.want || ''}

[그려낸 장면]
${sceneText}

${momentLine}

[이 삶이 이뤄지면 어떤 기분일 것 같다고 했는지]
${extractedSlots.feeling || ''}

위 재료로, 이 사람이 원하는 삶을 사는
소설 속 주인공의 어느 하루를 써줘.
장면을 보여주되, 요약하거나 설명하지 마.
아침에 눈 뜨는 것부터 잠드는 것까지.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
    });

    const story = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Section story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
