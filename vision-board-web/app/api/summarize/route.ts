import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { rateLimited, tooManyRequests, clampStr } from '@/lib/apiGuard';

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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userName = clampStr(body.userName, 100);
  // sections가 배열이 아니어도 크래시하지 않게 방어(M7) + 개수·길이 상한
  const sections = Array.isArray(body.sections) ? body.sections.slice(0, 6) : [];

  const sectionLines = sections
    .filter((s) => s && (s.keyword || s.bucketList || s.feeling))
    .map((s) => {
      const parts = [];
      if (s.current) parts.push(`현재: ${clampStr(s.current, 2000)}`);
      if (s.keyword) parts.push(`키워드: ${clampStr(s.keyword, 200)}`);
      if (s.bucketList) parts.push(`원하는 것: ${clampStr(s.bucketList, 2000)}`);
      if (s.feeling) parts.push(`이뤄졌을 때 느낌: ${clampStr(s.feeling, 2000)}`);
      return `[${clampStr(s.title, 100)}]\n${parts.join(' / ')}`;
    })
    .join('\n\n');

  const prompt = `다음은 ${userName || '사용자'}이(가) 비전보드 작성 과정에서 6개 영역에 걸쳐 답한 내용이야.

${sectionLines}

이 사람의 전체적인 모습과 원하는 것을 따뜻하고 공감 어린 한국어로 2~3문장으로 요약해줘.
숫자나 리스트 없이 자연스러운 문장으로, 이 사람을 잘 아는 친구처럼 써줘.
"당신은" 대신 "너는"으로, 존댓말 없이 반말로 써줘.`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Summarize API error:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
