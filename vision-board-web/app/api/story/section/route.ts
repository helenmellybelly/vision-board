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

  const prompt = `모든 텍스트는 반드시 한국어로만. 영어 단어·로마자 혼용 절대 금지.

다음은 '${sectionTitle}' 영역에서 이 사람이 원하는 삶의 모습이야:

방향 키워드: ${extractedSlots.keyword || '(없음)'}
원하는 것: ${extractedSlots.want || '(없음)'}
이뤄졌을 때 기분: ${extractedSlots.feeling || '(없음)'}
장면: ${sceneText}
원하는 구체적 순간들: ${situationPart}

이 재료를 바탕으로, 이 삶이 이루어진 미래의 어느 하루를 생생하게 써줘.

조건:
- 재료에 나온 키워드·장면·순간들을 살리되, 감각적이고 구체적인 묘사로 확장해서 써
- 1인칭 "나는"으로 시작
- 아침 시작 → 낮/오후 → 저녁 마무리, 하루 전체 흐름이 느껴지도록
- 2~3단락, 350~450자
- 핵심 순간이나 감각 1~2곳을 **이렇게** 볼드 처리 (마크다운 ** 사용)
- 반말, 따뜻하고 생생한 톤
- 절대 금지: 인사말, 자기소개, "여기 써드릴게요" 같은 도입부`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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
