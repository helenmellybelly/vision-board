import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ImageGenerateRequest {
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
}

const PROMPT_SYSTEM = `You are a vision board lifestyle image prompt expert.
Read the scene description below and generate 3 English image prompts — each capturing a different angle or moment of the same scene.

Rules:
- If people are present: lifestyle photography, candid moment, not posing, natural gesture
- If space-focused: interior/exterior photography, lived-in feel, personal space
- Common style for all: shot on 35mm film, warm natural light, soft shadows
- Remove AI-generated look: grain texture, slightly imperfect, documentary style
- Forbidden: illustration, painting, render, 3D, cartoon, stock photo look, overly perfect
- Each prompt: 50-70 words
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

  const { sectionTitle, situationText, sceneText, story } = body;

  // Extract bold text from mini-story (used as mood/atmosphere hint)
  const storyBold = (story.match(/\*\*([^*]+)\*\*/g) ?? [])
    .map((s) => s.replace(/\*\*/g, ''))
    .join(' / ');

  // Step 1: Generate 3 English lifestyle prompts from scene description
  const conversionPrompt = `Priority 1 (reflect directly in image): ${sceneText}
Priority 2 (mood/atmosphere hint): ${storyBold || situationText}
Priority 3 (space/ambience context only): ${sectionTitle}

Generate 3 prompts — each a different angle or moment of this scene.`;

  const openai = new OpenAI({ apiKey: openaiKey });

  let prompts: string[];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PROMPT_SYSTEM },
        { role: 'user', content: conversionPrompt },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '[]';
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        prompts = parsed.slice(0, 3).map(String);
      } else {
        throw new Error('Expected array of 3');
      }
    } catch {
      // Fallback: extract quoted strings from the raw response
      const quoted = raw.match(/"([^"]{10,})"/g);
      if (quoted && quoted.length >= 3) {
        prompts = quoted.slice(0, 3).map((s) => s.replace(/^"|"$/g, ''));
      } else {
        throw new Error('Could not parse prompts from response');
      }
    }

    if (!Array.isArray(prompts) || prompts.length < 3) {
      throw new Error('Invalid prompts format');
    }
  } catch (err) {
    console.error('Prompt generation error:', err);
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
  }

  // Step 2: Generate 3 images with gpt-image-1 in parallel (allSettled = partial success ok)
  const settled = await Promise.allSettled(
    prompts.slice(0, 3).map(async (prompt, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (openai.images.generate as any)({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        n: 1,
      });
      const item = response.data?.[0] ?? {};
      const imageUrl: string = item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
      return {
        url: imageUrl,
        prompt,
        index: i,
      };
    })
  );

  const images = settled
    .map((r) => {
      if (r.status === 'rejected') {
        const err = r.reason;
        console.error('DALL-E generation failed:', JSON.stringify({
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
    console.error('All DALL-E generations failed');
    return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
  }

  return NextResponse.json({ images });
}
