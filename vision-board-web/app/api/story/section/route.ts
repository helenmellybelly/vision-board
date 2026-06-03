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

  const momentPart = additionalInput
    ? `${situationText}\n${additionalInput}`
    : situationText;

  const prompt = `모든 텍스트는 반드시 한국어로만. 영어 단어·로마자 절대 금지.

【핵심 재료 — 장면에 직접 등장시킬 것】
그려낸 장면: "${sceneText}"
보고 싶은 순간들: "${momentPart}"

【배경 재료 — 톤·방향 설정에만 사용, 직접 인용 금지】
방향 키워드: "${extractedSlots.keyword || ''}"
원하는 것: "${extractedSlots.want || ''}"
이뤄졌을 때 기분: "${extractedSlots.feeling || ''}"

출력 규칙:
1. 핵심 재료의 표현을 그대로 살려. 의역·미화·과장 금지.
2. 아침 기상 → 하루 중 핵심 순간 2-3개 → 저녁 마무리 흐름으로 전개. 단 "아침에 일어났다/낮에 밥을 먹었다" 식 시간 나열 금지 — 소설처럼 장면이 전환되는 방식으로.
3. 구체적 감각 필수 포함:
   - 어디에 있는지 (공간·배경)
   - 무엇을 입고 있는지 (옷·분위기, 자연스럽게)
   - 무엇을 먹거나 마시는지
   - 누구와 함께인지 또는 혼자인지
   - 기분은 직접 서술 금지, 행동·감각으로만 표현
     ❌ "행복했다" → ✅ "커피잔을 두 손으로 감싸 쥐었다"
     ❌ "충만함을 느꼈다" → ✅ "메일을 닫고 창밖을 한참 바라봤다"
4. 1인칭 "나는"으로 시작.
5. 서술체 (소설·일기 톤). 반말(야, 해, 했어)·존댓말(요, 습니다) 절대 금지.
6. 길이: 350-500자.
7. 핵심 감각 또는 행동 1곳만 **볼드** 처리.
8. 금지 표현: 인사말, "설레는 하루가 시작됐다", "충만함", "행복했다", "오늘도" 류 진부한 서두.
9. 섹션 이름(나/건강/관계/일/돈/공간) 직접 언급 금지.`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
    });

    const story = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Section story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
