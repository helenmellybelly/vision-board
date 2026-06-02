import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SectionStoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, extractedSlots, sceneText, situationText, additionalInput } = body;

  const situationPart = additionalInput
    ? `${situationText}\n추가로 담고 싶은 순간: ${additionalInput}`
    : situationText;

  const prompt = `모든 텍스트는 반드시 한국어로만. 영어 단어·로마자 절대 금지.

이 사람이 실제로 쓴 말들:
방향 키워드: "${extractedSlots.keyword || ''}"
원하는 것: "${extractedSlots.want || ''}"
이뤄졌을 때 기분: "${extractedSlots.feeling || ''}"
그려낸 장면: "${sceneText}"
보고 싶은 순간들: "${situationPart}"

규칙:
1. 위에 적힌 표현을 그대로 살려. 의역·격상 금지. "가벼운"이면 "가벼운"으로.
2. 하루 전체를 억지로 채우지 마. 가장 선명한 장면 1~2개를 깊게 써.
3. 1인칭 "나는"으로 자연스럽게 시작.
4. 2단락, 200~300자. 짧고 선명한 게 긴 것보다 낫다.
5. 핵심 감각이나 행동 1곳만 **볼드** 처리.
6. 반말. 따뜻하지만 과장 없이.
7. 금지: 인사말, 도입부, "활기찬" "생동감" 같은 진부한 표현, 아침→낮→저녁 3단 강제.`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
