import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface SectionInput {
  title: string;
  keyword: string;
  bucketList: string;
  feeling: string;
  current: string;
}

interface RequestBody {
  userName: string;
  sections: SectionInput[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { userName, sections } = body;

  const sectionLines = sections
    .filter((s) => s.keyword || s.bucketList || s.feeling)
    .map((s) => {
      const parts = [];
      if (s.current) parts.push(`현재: ${s.current}`);
      if (s.keyword) parts.push(`키워드: ${s.keyword}`);
      if (s.bucketList) parts.push(`원하는 것: ${s.bucketList}`);
      if (s.feeling) parts.push(`이뤄졌을 때 느낌: ${s.feeling}`);
      return `[${s.title}]\n${parts.join(' / ')}`;
    })
    .join('\n\n');

  const prompt = `다음은 ${userName || '사용자'}이(가) 비전보드 작성 과정에서 6개 영역에 걸쳐 답한 내용이야.

${sectionLines}

이 사람의 전체적인 모습과 원하는 것을 따뜻하고 공감 어린 한국어로 2~3문장으로 요약해줘.
숫자나 리스트 없이 자연스러운 문장으로, 이 사람을 잘 아는 친구처럼 써줘.
"당신은" 대신 "너는"으로, 존댓말 없이 반말로 써줘.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = (message.content[0] as { type: string; text: string }).text;
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
