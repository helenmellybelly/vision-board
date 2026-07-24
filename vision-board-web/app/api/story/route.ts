import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { rateLimited, tooManyRequests, clampStr } from '@/lib/apiGuard';

interface StorySection {
  title: string;
  keyword?: string;
  want?: string;
  feeling?: string;
  sceneText?: string;
  situationText?: string;
}

interface StoryRequest {
  userName: string;
  oneSentence: string;
  sections: StorySection[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: StoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userName = clampStr(body.userName, 100);
  const oneSentence = clampStr(body.oneSentence, 500);
  // sections가 배열이 아니어도 크래시하지 않게 방어(M7) + 개수·길이 상한
  const sections = Array.isArray(body.sections) ? body.sections.slice(0, 6) : [];

  const sectionLines = sections
    .filter((s) => s && (s.keyword || s.want || s.sceneText))
    .map((s) => {
      const parts = [];
      if (s.keyword) parts.push(`방향: ${clampStr(s.keyword, 200)}`);
      if (s.want) parts.push(`원하는 것: ${clampStr(s.want, 2000)}`);
      if (s.sceneText) parts.push(`장면: ${clampStr(s.sceneText, 4000)}`);
      if (s.situationText) parts.push(`원하는 순간들: ${clampStr(s.situationText, 4000)}`);
      return `[${clampStr(s.title, 100)}] ${parts.join(' / ')}`;
    })
    .join('\n');

  const prompt = `${userName || '이 사람'}의 비전보드 재료야:

한 문장: "${oneSentence}"

섹션별 내용:
${sectionLines}

이 내용을 재료로, 이 삶이 이루어진 미래의 어느 하루를 아침부터 저녁까지 한 편의 글로 써줘.

조건:
- 위에 나온 키워드·장면이 글에 실제로 등장해야 해 (새 내용 심지 말 것)
- 위 섹션들이 하나의 하루 안에서 자연스럽게 흐르도록 (섹션별로 쪼개지 않게)
- 1인칭 "나는"으로 시작
- 아침→점심→저녁 흐름
- 감각적이고 구체적으로. 2~3 문단, 300자 내외.
- 반말, 따뜻한 톤`;

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    });

    const story = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
