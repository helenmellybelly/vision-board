import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface StorySection {
  title: string;
  keyword?: string;
  want?: string;
  feeling?: string;
  sceneText?: string;
}

interface StoryRequest {
  userName: string;
  oneSentence: string;
  sections: StorySection[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: StoryRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { userName, oneSentence, sections } = body;

  const sectionLines = sections
    .filter((s) => s.keyword || s.want || s.sceneText)
    .map((s) => {
      const parts = [];
      if (s.keyword) parts.push(`방향: ${s.keyword}`);
      if (s.want) parts.push(`원하는 것: ${s.want}`);
      if (s.sceneText) parts.push(`장면: ${s.sceneText}`);
      return `[${s.title}] ${parts.join(' / ')}`;
    })
    .join('\n');

  const prompt = `${userName || '이 사람'}의 비전보드 재료야:

한 문장: "${oneSentence}"

섹션별 내용:
${sectionLines}

이 내용을 재료로, 이 삶이 이루어진 미래의 어느 하루를 아침부터 저녁까지 한 편의 글로 써줘.

조건:
- 위에 나온 키워드·장면이 글에 실제로 등장해야 해 (새 내용 심지 말 것)
- 6개 섹션(나·건강·관계·일·돈·공간)이 하나의 하루 안에서 자연스럽게 흐르도록 (섹션별로 쪼개지 않게)
- 1인칭 "나는"으로 시작
- 아침→점심→저녁 흐름
- 감각적이고 구체적으로. 2~3 문단, 300자 내외.
- 반말, 따뜻한 톤`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const story = result.response.text();
    return NextResponse.json({ story });
  } catch (err) {
    console.error('Story API error:', err);
    return NextResponse.json({ error: 'Failed to generate story' }, { status: 500 });
  }
}
