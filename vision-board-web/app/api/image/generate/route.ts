import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ImageGenerateRequest {
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
}

const PROMPT_SYSTEM = `You are a creative director converting Korean vision board descriptions into English DALL-E image prompts.

Rules:
- Output exactly 3 prompts as a JSON array: ["prompt1", "prompt2", "prompt3"]
- Each prompt must be in English, 1-2 sentences, under 900 characters total
- Style: realistic, warm natural light, lifestyle photography, cinematic
- Each prompt should highlight a different moment or angle from the input
- No text overlay in images, no people's faces close-up
- Focus on atmosphere, setting, and lifestyle feel
- Output ONLY the JSON array, nothing else`;

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

  // Step 1: Convert Korean situations to English DALL-E prompts
  const conversionPrompt = `Section: ${sectionTitle}
Situations the user wants to see: ${situationText}
Scene description: ${sceneText}
Story: ${story}

Generate 3 DALL-E image prompts in English capturing different moments from this vision.`;

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

  // Step 2: Generate 3 images with DALL-E 2 in parallel (allSettled = partial success ok)
  const settled = await Promise.allSettled(
    prompts.slice(0, 3).map(async (prompt, i) => {
      const response = await openai.images.generate({
        model: 'dall-e-2',
        prompt: prompt.slice(0, 900),
        size: '512x512',
        response_format: 'b64_json',
        n: 1,
      });
      const item = response.data?.[0] ?? {};
      const imageUrl: string = item.b64_json ? `data:image/png;base64,${item.b64_json}` : '';
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
