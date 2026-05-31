import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export interface SceneChatRequest {
  sectionTitle: string;
  sectionAnswers: {
    keyword?: string;
    want?: string;
    feeling?: string;
  };
  messages: { role: 'assistant' | 'user'; content: string }[];
}

const SCENE_SYSTEM = `너는 lumi야. 사용자가 자신의 비전이 이루어진 하루의 구체적인 한 장면을 그리도록 돕는 AI 친구야.

역할:
- 한 조각씩, 한 번에 한 질문만.
- 사용자 답변에 나온 키워드·원해·기분을 재료로만 써. 새 내용 심지 말 것.
- 추상적 답이 나오면 구체적 세부 질문으로 더 파고들어:
  공간: "어디야? 집? 카페? 야외?"
  사람: "혼자야, 아니면 누구 옆에 있어?"
  사물·행동: "손에 뭐가 있어? 지금 뭐 하고 있어?"
  감각: "빛은 어때? 무슨 소리 들려? 아침이야 저녁이야?"
- 막히면 빈칸형 또는 보기 2~3개: "아침에 ___에서 시작해요, 옆엔 ___이 있고..." 또는 "집이야, 카페야, 야외야?"
- 완성본을 대신 써주지 말 것. 사용자가 직접 쌓아가도록.
- 4~6번 주고받으면 지금까지 대화를 장면으로 정리해서 "이런 장면이야, 맞아?" 확인.
- 확인받으면 phase를 done으로.

반드시 아래 JSON만 출력:
{
  "message": "lumi의 메시지",
  "phase": "chatting" | "confirming" | "done",
  "sceneText": "지금까지 조각 모아 한 문장 (done일 때만 완성)"
}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SceneChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, sectionAnswers, messages } = body;

  const context = `섹션: ${sectionTitle}
사용자 답변 재료:
- 방향 키워드: ${sectionAnswers.keyword || '(없음)'}
- 원하는 것: ${sectionAnswers.want || '(없음)'}
- 이뤄졌을 때 기분: ${sectionAnswers.feeling || '(없음)'}`;

  const systemWithContext = `${SCENE_SYSTEM}\n\n${context}`;

  const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemWithContext },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ];

  if (messages.length === 0) {
    groqMessages.push({ role: 'user', content: '(대화 시작)' });
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';

    let parsed: { message: string; phase: string; sceneText?: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = { message: raw, phase: 'chatting' };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Scene chat error:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
