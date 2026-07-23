import { NextRequest, NextResponse } from 'next/server';
import { freeChat, freeLlmConfigured } from '@/lib/llm';
import { rateLimited, tooManyRequests, clampStr, clampStrArray } from '@/lib/apiGuard';

interface KeywordsRequest {
  sectionTitle: string;
  descriptions: string[];
}

// 장면 묘사(한국어) → Unsplash 영어 검색어 — 영어가 검색 품질이 좋다 (v6.17과 동일 전제)
const SYSTEM = `You convert Korean vision-board scene descriptions into Unsplash search queries.

Rules:
- For each scene, output ONE English search query of 2-4 words
- Focus on the concrete subject, place, and mood of the scene (e.g. "sunlit art studio", "morning trail running")
- No person names, no abstract emotion words, no quotes
- The 3 queries must differ from each other so the photos don't overlap
- Output ONLY a JSON array of 3 strings: ["query1", "query2", "query3"]`;

export async function POST(req: NextRequest) {
  // v7.4 LLM 무료화 — gpt-4o-mini → Gemini flash-lite(1차)·Groq(2차)
  if (!freeLlmConfigured()) {
    return NextResponse.json({ error: 'LLM key not configured', code: 'MISSING_KEY' }, { status: 500 });
  }
  if (rateLimited(req)) return tooManyRequests();

  let body: KeywordsRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const sectionTitle = clampStr(body.sectionTitle, 100);
  const descriptions = clampStrArray(body.descriptions, 3, 500);
  if (descriptions.filter(Boolean).length === 0) {
    return NextResponse.json({ error: 'descriptions required' }, { status: 400 });
  }

  const userPrompt = `섹션: ${sectionTitle}
장면 묘사:
${descriptions.map((d, i) => `장면${i + 1}: ${d}`).join('\n')}`;

  try {
    const raw = await freeChat({
      system: SYSTEM,
      user: userPrompt,
      temperature: 0.4,
    });
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return NextResponse.json({ error: 'Expected array of 3 keywords' }, { status: 500 });
    }

    return NextResponse.json({ keywords: parsed.slice(0, 3).map(String) });
  } catch (err) {
    console.error('Image keywords error:', err);
    return NextResponse.json({ error: 'Failed to generate keywords' }, { status: 500 });
  }
}
