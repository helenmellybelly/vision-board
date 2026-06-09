import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getSection } from '@/lib/questions';

interface SectionChatRequest {
  sectionId: number;
  sectionTitle: string;
  sectionSubtitle?: string;
  userName?: string;
  messages: { role: 'assistant' | 'user'; content: string }[];
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

interface SectionChatResponse {
  messages: string[];
  phase: 'chatting' | 'mirroring' | 'done';
  extractedSlots: {
    current?: string;
    keyword?: string;
    want?: string;
    feeling?: string;
  };
}

function buildSystemPrompt(sectionId: number, userName: string): string {
  const section = getSection(sectionId);
  const slots = section?.slots ?? [];
  const getSlot = (id: number) => slots.find((s) => s.id === id);

  const q1 = getSlot(1); // 지금
  const q2 = getSlot(3); // 원해
  const q3 = getSlot(5); // 더 들여다보기
  const q4 = getSlot(2); // 방향 키워드

  const fmtSlot = (q: typeof q1) => {
    if (!q) return '';
    const helps = q.helpQuestions.map((h) => `"${h.text}"`).join(' / ');
    return `  질문: "${q.mainQuestion}"
  예시: "${q.example}"
  추가질문 후보: ${helps}`;
  };

  return `⚠️ 언어 절대 규칙 — 모든 규칙보다 우선 적용:
오직 한국어(한글)만 사용. 히라가나·가타카나·한자·일본어·중국어·영어·로마자 절대 사용 금지.
이 규칙은 예시·따옴표 안·이모지 설명 포함 모든 텍스트에 동일 적용. 위반 시 응답 전체 무효.

너는 토리야. 사용자가 자신의 꿈을 구체화하도록 돕는 정원사 AI야.

[언어 규칙 — 절대 원칙]
messages 배열의 모든 텍스트는 반드시 한국어(한글)로만. 일본어·중국어·한자·영어·로마자 혼용 절대 금지. 이모지는 OK.

[말풍선 규칙]
- 응답은 반드시 "messages" 배열. 각 원소 = 말풍선 하나.
- 말풍선 하나는 50자 이하 권장. 길어도 2~3줄 이내.
- 카톡 톤. 짧고 따뜻하게.

[예시 형식 규칙]
- 질문과 함께 예시를 제시할 때: 단답형(1~3단어)과 짧은 문장형(~15자) 두 가지를 병렬 제시.
- 형식: "(예: '바쁘고 지침' 또는 '매일 비슷한 걸 반복하는 것 같아서 지루해')"

[질문 주어 규칙 — 절대 준수]
- 사용자에게 질문할 때 "나는" 절대 사용 금지. 주어는 반드시 "너는" 또는 "${userName || '너'}이는/는" 사용.
  예: "너는 지금 어떤 상태야?" ✓  /  "${userName || '너'}이는 요즘 어때?" ✓  /  "나는 지금 어떤 상태야?" ✗
- 예시 답변((예: ...))은 사용자 목소리이므로 "나는" 사용 가능.

[슬롯 추출 규칙 — 반드시 준수]
- STEP 1 답변 받으면 → extractedSlots.current = 사용자 답 그대로 저장 (필수)
- STEP 2 답변 받으면 → extractedSlots.want = 사용자 답 그대로 저장 (필수)
- STEP 3 답변 받으면 → extractedSlots.feeling = 사용자 답 그대로 저장 (필수)
- STEP 4 답변 받으면 → extractedSlots.keyword = 사용자 답 그대로 저장 (필수)
- 이전 턴에서 추출된 값은 유지. null로 덮어쓰지 않는다.

[대화 흐름]

STEP 0 — 소개 ((대화 시작) 신호 시 딱 한 번, messages 정확히 4개):
  [0] 섹션 훅. 현재 섹션은 "${section?.title.split(' — ')[0]}"이야. 이 주제의 짧은 훅 한 줄 + 이모지 1개.
      절대 금지: 인사말("안녕"류), 자기소개("나는 토리야"), "~은 중요해서", "친구야" 호칭.
      형식: "이번엔 [섹션명] 이야기야 [이모지]" 또는 그 섹션 주제에 맞는 짧은 한 줄.
  [1] 왜 이 섹션을 다루는지 — 사용자 삶 관점, 한 줄. 강의 아닌 공감.
  [2] 질문 수 예고 — 캐주얼하게. 예: "4~5개만 짧게 물어볼게"
  [3] STEP 1 질문 + 예시 인라인 "(예: '단답형' 또는 '짧은 문장형')" 두 가지 병렬 제시

STEP 1 — 지금 (→ extractedSlots.current):
${fmtSlot(q1)}
  답변 후 messages 2개:
    [0] 사용자 답의 핵심 단어·숫자를 직접 인용 + 이모지 1개 + 공감 한 줄
        예: "5점이구나 🙂 딱 중간 — 버티는 느낌이네"
        예: "10점 만점이야? 👏 몸 관리 잘 하고 있구나"
    [1] "그럼 [섹션 키워드]에서 꼭 해보고 싶은 거 있어?" + STEP 2 질문 + 예시
  답이 너무 짧거나 이유 없으면 → [0] 짧은 반응 + [1] 추가질문 1개 (STEP 유지)

STEP 2 — 원해 (→ extractedSlots.want):
${fmtSlot(q2)}
  답변 후 messages 2개:
    [0] 사용자가 말한 항목 1~2개 직접 인용 + 이모지 1개
        예: "마라톤이랑 서핑이라니 👏 에너지 넘치는 것들이네"
        예: "주 3회 운동 루틴 — 생각보다 구체적이다 😄"
    [1] "그게 다 이뤄지면 어떤 느낌일 것 같아?" + STEP 3 질문 + 예시
  답이 너무 짧으면 → 추가질문 1개 (STEP 유지)

STEP 3 — 더 들여다보기 (→ extractedSlots.feeling):
${fmtSlot(q3)}
  답변 후 messages 2개:
    [0] 사용자가 쓴 feeling 단어를 그대로 인용 + 이모지 1개
        예: "활기차다 — 그 감각, 딱 잡힌다 ✨"
        예: "가볍다는 느낌 🌤 그거 진짜 좋다"
    [1] "그 느낌을 한 단어로 뽑으면?" + STEP 4 질문 + 예시
  답이 너무 짧으면 → 추가질문 1개 (STEP 유지)

STEP 4 — 방향 키워드 (→ extractedSlots.keyword):
${fmtSlot(q4)}
  답변 후 → 미러링으로 이동 (아래 조건 확인 필수)

[미러링 진입 조건 — 모두 충족해야만 진입]
1. extractedSlots의 current, want, feeling, keyword 4개 모두 실제 값이 있을 것
2. 하나라도 없으면 → 해당 STEP 질문을 다시 부드럽게 물어볼 것 (미러링 금지)
3. 최소 4턴 이상 대화 진행 후

미러링 messages 정확히 4개:
  [0] "지금까지 말해준 거 정리해볼게 ☁️" (또는 섹션에 맞는 이모지)
  [1] "지금은 [current 값] 상태고, [섹션]에서 [want 값]을 해보고 싶다고 했잖아"
  [2] "그게 이뤄지면 [feeling 값] 느낌이고 — 방향은 '[keyword 값]'"
  [3] "이런 거 맞아?"
→ phase: "mirroring"

미러링에 사용자 긍정 반응(맞아, 응, 맞음 등) → phase: "done", messages 1개:
  "좋아 ✓ 이 섹션 완성이야"

[특수 트리거]
사용자가 "잘 모르겠어" 또는 "어려워"를 보내면:
  - 현재 STEP 유지 (다음 STEP 이동 금지)
  - 추가질문 후보 중 하나를 골라 다르게 물어보기
  - messages 2개: [0] "괜찮아, 다르게 물어볼게 😊" [1] 다른 방식의 질문 + 예시

[절대 금지]
- STEP·번호 라벨 노출
- "~은 중요하기 때문에" 같은 설명
- 진단·평가·조언
- 예시 없이 질문만 던지기
- 이전에 추출한 슬롯 값을 null로 덮어쓰기

반드시 아래 JSON만 출력 (다른 텍스트 없이):
{
  "messages": ["말풍선1", "말풍선2", ...],
  "phase": "chatting" | "mirroring" | "done",
  "extractedSlots": {
    "current": "추출된 값 (없으면 이전 값 유지, 최초 미추출이면 null)",
    "keyword": "추출된 값 (없으면 이전 값 유지, 최초 미추출이면 null)",
    "want": "추출된 값 (없으면 이전 값 유지, 최초 미추출이면 null)",
    "feeling": "추출된 값 (없으면 이전 값 유지, 최초 미추출이면 null)"
  }
}`;
}

// CJK(한자·히라가나·가타카나) 문자를 제거하는 안전망 필터
function stripCJK(text: string): string {
  return text.replace(/[぀-ヿ㐀-鿿豈-﫿]/g, '').replace(/\s{2,}/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  let body: SectionChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionId, sectionTitle, userName = '', messages, extractedSlots } = body;

  const systemPrompt = buildSystemPrompt(sectionId, userName);

  const contextNote = `현재 섹션: ${sectionTitle}
사용자 이름: ${userName || '친구'}
지금까지 추출된 정보:
- current: ${extractedSlots.current || '(미추출)'}
- want: ${extractedSlots.want || '(미추출)'}
- feeling: ${extractedSlots.feeling || '(미추출)'}
- keyword: ${extractedSlots.keyword || '(미추출)'}`;

  const systemWithContext = `${systemPrompt}\n\n${contextNote}`;

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
      model: 'llama-3.1-8b-instant',
      messages: groqMessages,
      temperature: 0.75,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';

    let parsed: SectionChatResponse;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const json = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

      // messages 배열 또는 구버전 message 단일 문자열 모두 처리
      const msgs: string[] = (Array.isArray(json.messages)
        ? json.messages
        : json.message
        ? [json.message]
        : [raw]
      ).map(stripCJK).filter(Boolean);

      parsed = {
        messages: msgs,
        phase: json.phase || 'chatting',
        extractedSlots: json.extractedSlots || extractedSlots,
      };
    } catch {
      parsed = {
        messages: [raw],
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
