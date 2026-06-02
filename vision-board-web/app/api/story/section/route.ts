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
    ? `${situationText}\n추가로: ${additionalInput}`
    : situationText;

  const prompt = `모든 텍스트는 반드시 한국어로만. 영어 단어·로마자 혼용 절대 금지.

다음은 '${sectionTitle}' 영역에서 이 사람이 원하는 삶의 모습이야:

방향 키워드: ${extractedSlots.keyword || '(없음)'}
원하는 것: ${extractedSlots.want || '(없음)'}
이뤄졌을 때 기분: ${extractedSlots.feeling || '(없음)'}
장면: ${sceneText}
원하는 구체적 순간들: ${situationPart}

이 재료만으로, 이 삶이 이루어진 어느 하루의 장면을 써줘.

조건:
- 새로운 내용을 추가하지 말고, 위에 나온 것들만 재료로 써
- 1인칭 "나는"으로 시작
- 아침 또는 하루 중 한 순간부터 시작해서 자연스럽게 흘러가도록
- 감각적이고 구체적으로. 1~2 문단, 200~250자
- 반말, 따뜻한 톤
- 절대 금지: 인사말, 자기소개, "여기 써드릴게요" 같은 도입부`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
    });

    const story = completion.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Section story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
