import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// 무료 티어 LLM 공용 헬퍼 (v7.4 — LLM 비용 0원화)
// 1차 Gemini flash 무료 티어 → 한도 초과·오류 시 2차 Groq(llama-3.1-8b-instant, 무료).
// 프롬프트는 호출부(각 라우트)가 소유하고, 여기는 provider 전환만 담당한다.
// 무료 한도(RPM·RPD)는 변동이 잦으므로 apiGuard의 IP 레이트리밋을 1차 방어선으로 유지할 것.

export interface FreeChatOptions {
  system: string;
  user: string;
  temperature?: number;
  /** true면 JSON 출력을 강제한다 (Gemini responseMimeType / Groq json_object) */
  json?: boolean;
  /** 기본 gemini-flash-lite-latest — 일기처럼 품질이 중요한 곳만 gemini-flash-latest로 올린다.
   *  고정 버전명(예: gemini-2.5-*)은 "no longer available to new users" 404로 부패한 전례가 있어
   *  최신 안정판 자동 추적 별칭을 쓴다 (v7.4에서 실측 확인) */
  geminiModel?: string;
  groqModel?: string;
}

function geminiKey(): string | undefined {
  // 로컬·Vercel 관례 호환 — 어느 이름이든 등록돼 있으면 사용
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

/** Gemini든 Groq든 하나라도 키가 있으면 동작 가능 */
export function freeLlmConfigured(): boolean {
  return !!(geminiKey() ?? process.env.GROQ_API_KEY);
}

async function chatGemini(opts: FreeChatOptions): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error('gemini-key-missing');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.geminiModel ?? 'gemini-flash-lite-latest',
    systemInstruction: opts.system,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const result = await model.generateContent(opts.user);
  const text = result.response.text().trim();
  if (!text) throw new Error('gemini-empty');
  return text;
}

async function chatGroq(opts: FreeChatOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('groq-key-missing');
  const groq = new Groq({ apiKey: key });
  const completion = await groq.chat.completions.create({
    model: opts.groqModel ?? 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.7,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('groq-empty');
  return text;
}

/** 무료 체인 호출 — Gemini 실패 시 Groq. 둘 다 실패하면 마지막 오류를 던진다(호출부 기존 처리 유지) */
export async function freeChat(opts: FreeChatOptions): Promise<string> {
  try {
    return await chatGemini(opts);
  } catch (geminiErr) {
    try {
      return await chatGroq(opts);
    } catch (groqErr) {
      console.error('freeChat: gemini failed →', geminiErr, '/ groq failed →', groqErr);
      throw groqErr;
    }
  }
}
