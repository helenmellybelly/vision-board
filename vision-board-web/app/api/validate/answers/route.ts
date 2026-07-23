import { NextRequest, NextResponse } from 'next/server';
import { freeChat, freeLlmConfigured } from '@/lib/llm';
import { rateLimited, tooManyRequests, clampStr } from '@/lib/apiGuard';

// 섹션 답변 의미 검증 (v6.19) — 규칙 검증을 통과한 답변이 실제로 뜻이 통하는지 판별.
// 실패(500)는 클라이언트가 fail-open으로 처리한다 — 인프라 문제로 진행을 막지 않는다.

interface ValidateItem {
  key: string;
  question: string;
  answer: string;
}

interface ValidateRequest {
  sectionTitle: string;
  items: ValidateItem[];
}

const SYSTEM_PROMPT = `당신은 비전보드 서비스의 답변 검사기입니다.
사용자가 질문에 쓴 답변이 "이해 불가능하거나 무의미한지"만 판별합니다.

[핵심 원칙 — 관대하게]
짧아도 뜻이 통하면 valid입니다. 문장이 아니어도, 맞춤법이 틀려도 valid입니다.
답변의 품질·깊이·성의는 평가하지 않습니다.

valid 예시: "여유로운", "8점", "마라톤 완주", "돈 걱정 없이 살기", "그냥 편하게"
invalid 예시: "ㅁㄴㅇㄹㅁㄴㅇㄹ", "asdkjhakjsdh", "ㅋ", "바나나 우주 ㅋㅋ 의자", "111ㅋㅋㅋ"

invalid 기준 (이것만):
- 무작위 문자 나열, 키보드 연타
- 자모만 나열된 입력
- 질문과 어떤 해석으로도 연결할 수 없는 의미 없는 단어 나열

[출력 — 정확한 JSON만]
{"results":{"<key>":{"valid":true},"<key>":{"valid":false,"reason":"<짧은 반말 한 문장>"}}}

reason은 사용자에게 그대로 보여줍니다. 따뜻한 반말 한 문장으로:
예: "이 답변은 내가 이해하기 어려워. 편하게 다시 써줄래?"
판단하거나 꾸짖는 톤 금지.`;

export async function POST(req: NextRequest) {
  // v7.4 LLM 무료화 — gpt-4o-mini → Gemini flash-lite(1차)·Groq(2차). 실패는 기존대로 fail-open
  if (!freeLlmConfigured()) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: ValidateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 개수·길이 상한 — 무제한 items[] 증폭 차단
  const items = body.items.slice(0, 8);
  const userPrompt = `[섹션] ${clampStr(body.sectionTitle, 100)}

${items
  .map((item) => `[${clampStr(item?.key, 40)}]\n질문: ${clampStr(item?.question, 500)}\n답변: ${clampStr(item?.answer, 2000)}`)
  .join('\n\n')}

각 답변이 이해 가능한지 판별해서 JSON으로 답해줘.`;

  try {
    const raw = await freeChat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0,
      json: true,
    });
    const parsed = JSON.parse(raw) as { results?: Record<string, { valid: boolean; reason?: string }> };
    if (!parsed.results) {
      return NextResponse.json({ error: 'Malformed model output' }, { status: 500 });
    }
    return NextResponse.json({ results: parsed.results });
  } catch (err) {
    console.error('Validate answers API error:', err);
    return NextResponse.json({ error: 'Failed to validate answers' }, { status: 500 });
  }
}
