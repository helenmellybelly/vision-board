import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface DescribeOneRequest {
  sceneIndex: 0 | 1 | 2;
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
  existingDescriptions: string[];
}

const SYSTEM = `당신은 비전보드 이미지 묘사 전문가입니다.
특정 장면 번호(1, 2, 3 중 하나)에 해당하는 이미지 묘사 하나만 새롭게 제안하세요.

핵심 원칙:
- 주어는 항상 "그 순간의 나" — "한 사람"이 아니라 사용자 자신이 그 장면 안에 있어야 함
- 평범한 일상이 아닌 의미 있는 피크 모먼트를 포착
- 감정·추상 표현 금지 (예: "행복한", "여유로운 느낌" ❌) — 몸의 상태·표정·행동으로만 표현
- 감각 디테일 필수: 빛의 방향과 질, 공간의 온도감, 사물의 질감 중 1가지 이상 포함
- 묘사: 20-50자

구도 규칙:
- 장면1: 와이드샷 — 공간 전체가 보이는 환경 중심, 나는 그 안에 작게 위치
- 장면2: 미디엄샷 — 상반신~전신, 자연스러운 동작이 보임
- 장면3: 클로즈업 — 손·사물·공간의 특정 디테일 중심

기존 다른 장면들과 겹치지 않게 새로운 각도·소재·구도를 사용하세요.
Output ONLY a single string (no JSON array, no quotes, just the description text).`;

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured', code: 'MISSING_KEY' }, { status: 500 });
  }

  let body: DescribeOneRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sceneIndex, sectionTitle, situationText, sceneText, story, existingDescriptions } = body;
  const sceneNum = sceneIndex + 1;

  const otherDescs = existingDescriptions
    .map((d, i) => i !== sceneIndex && d ? `장면${i + 1}: ${d}` : null)
    .filter(Boolean)
    .join('\n');

  const userPrompt = `섹션: ${sectionTitle}
장면: ${sceneText}
구체적 순간들: ${situationText}
하루 스토리 요약: ${story.slice(0, 300)}

요청: 장면${sceneNum} 묘사를 새롭게 제안해주세요.
${otherDescs ? `\n기존 다른 장면 묘사 (겹치지 않도록):\n${otherDescs}` : ''}`;

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
    });

    const description = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!description) {
      return NextResponse.json({ error: 'Empty response' }, { status: 500 });
    }

    return NextResponse.json({ description });
  } catch (err) {
    console.error('Describe-one error:', err);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
