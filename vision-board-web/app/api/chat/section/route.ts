import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface SectionChatRequest {
  sectionId: number;
  sectionTitle: string;
  messages: { role: 'assistant' | 'user'; content: string }[];
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

interface SectionChatResponse {
  message: string;
  phase: 'chatting' | 'mirroring' | 'done';
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

const SYSTEM_PROMPT = `너는 lumi야. 사용자가 비전보드 한 섹션의 비전을 정리하도록 돕는 따뜻한 AI 친구야.

역할:
- 사용자와 자연스러운 카톡 톤의 대화를 한다. 짧고 따뜻하게.
- 내부적으로 4가지 정보를 대화 속에서 자연스럽게 끌어낸다:
  1. current: 지금 이 영역에서 어떤 상태인지
  2. keyword: 3년 뒤 원하는 방향/느낌 (한 단어 또는 짧은 표현)
  3. want: 이루고 싶은 것들 (버킷리스트)
  4. feeling: 그게 이뤄졌을 때 기분/상태

원칙:
- 한 번에 한 질문만. 짧게.
- 사용자 답에 1-2줄 공감 후 다음 질문으로 자연스럽게 이어간다.
- "①번 질문합니다" 같은 라벨 절대 노출 금지.
- 막히면 답을 주지 말고 "예를 들면..." 또는 "혹시 ~한 경험 있어?" 식으로 사다리 질문.
- 진단·평가·조언 금지. 거울처럼 반영만.
- 4가지가 다 모이면 사용자 단어 그대로 요약해서 "이런 거 맞아?" 확인 후 phase를 mirroring으로.
- 사용자가 "맞아" 또는 긍정 반응하면 phase를 done으로.

반드시 아래 JSON만 출력 (다른 텍스트 없이):
{
  "message": "lumi의 메시지 (사용자에게 보이는 텍스트)",
  "phase": "chatting" | "mirroring" | "done",
  "extractedSlots": {
    "current": "추출된 값 또는 null",
    "keyword": "추출된 값 또는 null",
    "want": "추출된 값 또는 null",
    "feeling": "추출된 값 또는 null"
  }
}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SectionChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, messages, extractedSlots } = body;

  const contextNote = `현재 섹션: ${sectionTitle}
지금까지 추출된 정보:
- current: ${extractedSlots.current || '(미추출)'}
- keyword: ${extractedSlots.keyword || '(미추출)'}
- want: ${extractedSlots.want || '(미추출)'}
- feeling: ${extractedSlots.feeling || '(미추출)'}`;

  const systemWithContext = `${SYSTEM_PROMPT}\n\n${contextNote}`;

  // 첫 메시지 요청 (빈 messages) 처리
  const apiMessages = messages.length === 0
    ? [{ role: 'user' as const, content: '(대화 시작)' }]
    : messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemWithContext,
      messages: apiMessages,
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();

    let parsed: SectionChatResponse;
    try {
      // JSON 블록 추출 (코드펜스 감싸진 경우 처리)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = {
        message: raw,
        phase: 'chatting',
        extractedSlots,
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Section chat error:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
