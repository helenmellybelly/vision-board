import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ImageDescribeRequest {
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
}

const SYSTEM = `당신은 비전보드 이미지 묘사 전문가입니다.
아래 내용을 바탕으로 이미지로 만들 장면을 한국어로 3가지 제안하세요.

규칙:
- 각 묘사: 15-40자, 시각적으로 구체적 (공간·행동·상황이 눈에 그려져야 함)
- 감정·추상 표현 금지 (예: "행복한 모습", "풍요로운 느낌" ❌)
- 반드시 서로 다른 공간·행동·거리감으로 제안:
  - 장면1: 넓은 공간 전체를 담은 환경 중심 묘사 (방, 거리, 외부 공간 등)
  - 장면2: 사람의 행동이 보이는 미디엄 묘사 (상반신~전신, 자연스러운 동작)
  - 장면3: 사물·손·디테일 중심의 클로즈업 묘사 (물건, 손, 공간의 일부)
- 컴퓨터/책상 장면은 3개 중 최대 1개만 허용
- 예시(다양성): "통창이 있는 넓은 작업실 전경", "카페 테이블에서 노트에 필기하는 손", "지하철역 광고판에 걸린 내 브랜드 포스터"
- Output ONLY a JSON array: ["묘사1", "묘사2", "묘사3"]`;

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured', code: 'MISSING_KEY' }, { status: 500 });
  }

  let body: ImageDescribeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, situationText, sceneText, story } = body;

  const userPrompt = `섹션: ${sectionTitle}
장면: ${sceneText}
구체적 순간들: ${situationText}
하루 스토리 요약: ${story.slice(0, 300)}`;

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    let descriptions: string[];

    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        descriptions = parsed.slice(0, 3).map(String);
      } else {
        throw new Error('Expected array of 3');
      }
    } catch {
      const quoted = raw.match(/"([^"]{5,})"/g);
      if (quoted && quoted.length >= 3) {
        descriptions = quoted.slice(0, 3).map((s) => s.replace(/^"|"$/g, ''));
      } else {
        throw new Error('Could not parse descriptions');
      }
    }

    return NextResponse.json({ descriptions });
  } catch (err) {
    console.error('Image describe error:', err);
    return NextResponse.json({ error: 'Failed to generate descriptions' }, { status: 500 });
  }
}
