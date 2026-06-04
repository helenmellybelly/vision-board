import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ImageGenerateRequest {
  descriptions: string[];   // 사용자 확인/편집한 한국어 묘사 3개
  sectionTitle?: string;    // 스타일 힌트용
  sceneText?: string;       // 스타일 힌트용
}

const TRANSLATE_SYSTEM = `You are a vision board image prompt expert.
Translate each Korean scene description into an English DALL-E image prompt.

Rules:
- If people are present: lifestyle photography, candid moment, natural gesture
- If space-focused: interior/exterior photography, lived-in feel, personal space
- Style for all: shot on 35mm film, warm natural light, soft shadows, grain texture, documentary style
- Forbidden: illustration, painting, render, 3D, cartoon, stock photo look, overly perfect
- Each prompt: 50-70 words

CRITICAL DIVERSITY REQUIREMENT:
The 3 scenes MUST use completely different visual compositions:
- Scene 1: wide establishing shot — full room, exterior, or open environment visible
- Scene 2: medium lifestyle shot — person in natural action, half-body or full-body framing
- Scene 3: intimate close-up — hands on object, surface texture detail, or tight crop
Even if the Korean descriptions seem similar in theme, force completely different distances, angles, and subject emphasis for each scene. NEVER show a desk/laptop in more than one scene.

- Output ONLY a JSON array of 3 strings: ["prompt1", "prompt2", "prompt3"]`;

export async function POST(req: NextRequest) {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured', code: 'MISSING_KEY' }, { status: 500 });
  }

  let body: ImageGenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { descriptions, sectionTitle, sceneText } = body;

  if (!Array.isArray(descriptions) || descriptions.length < 1) {
    return NextResponse.json({ error: 'descriptions array required' }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Step 1: Translate Korean descriptions to English DALL-E prompts (1:1)
  const translateInput = descriptions
    .slice(0, 3)
    .map((d, i) => `Scene ${i + 1}: ${d}`)
    .join('\n');

  const context = [sectionTitle, sceneText].filter(Boolean).join(' / ');
  const userPrompt = context
    ? `Context (style/mood hint): ${context}\n\n${translateInput}`
    : translateInput;

  let prompts: string[];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: TRANSLATE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      if (Array.isArray(parsed) && parsed.length >= descriptions.length) {
        prompts = parsed.slice(0, descriptions.length).map(String);
      } else {
        throw new Error('Expected array');
      }
    } catch {
      const quoted = raw.match(/"([^"]{10,})"/g);
      if (quoted && quoted.length >= 1) {
        prompts = quoted.slice(0, descriptions.length).map((s) => s.replace(/^"|"$/g, ''));
      } else {
        throw new Error('Could not parse prompts from response');
      }
    }
  } catch (err) {
    console.error('Prompt translation error:', err);
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
  }

  // Step 2: Generate images with gpt-image-1 in parallel
  const settled = await Promise.allSettled(
    prompts.map(async (prompt, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (openai.images.generate as any)({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        n: 1,
      });
      const item = response.data?.[0] ?? {};
      const imageUrl: string = item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      return { url: imageUrl, prompt, index: i };
    })
  );

  const images = settled
    .map((r) => {
      if (r.status === 'rejected') {
        const err = r.reason;
        console.error('Image generation failed:', JSON.stringify({
          status: err?.status,
          message: err?.message,
          code: err?.code,
          error: err?.error,
        }));
      }
      return r.status === 'fulfilled' ? r.value : null;
    })
    .filter((img): img is { url: string; prompt: string; index: number } => img !== null && img.url !== '');

  if (images.length === 0) {
    console.error('All image generations failed');
    return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
  }

  return NextResponse.json({ images });
}
