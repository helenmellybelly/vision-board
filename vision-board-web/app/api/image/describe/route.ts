import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { IMAGE_DESCRIBE_CORE_RULES } from '@/lib/prompts';

interface ImageDescribeRequest {
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
}

const SYSTEM = `당신은 비전보드 이미지 묘사 전문가입니다.
사용자가 원하는 미래의 자신을 담은 이미지 장면을 한국어로 3가지 제안하세요.

${IMAGE_DESCRIBE_CORE_RULES}

추가 규칙:
- 컴퓨터/책상 장면은 3개 중 최대 1개
- 스타일 힌트 포함 가능: "따뜻한 오후 빛", "창문 너머 흐린 하늘", "낡은 나무 테이블"
- 예시: "햇살이 측면에서 비치는 넓은 스튜디오, 이젤 앞에 서서 붓을 잡은 나"
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
