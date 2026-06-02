import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

interface ImageGenerateRequest {
  sectionTitle: string;
  situationText: string;
  sceneText: string;
  story: string;
}

const PROMPT_SYSTEM = `You are a creative director converting Korean vision board descriptions into English DALL-E 3 image prompts.

Rules:
- Output exactly 3 prompts as a JSON array: ["prompt1", "prompt2", "prompt3"]
- Each prompt must be in English, 1-2 sentences
- Style: realistic, warm natural light, lifestyle photography, cinematic
- Each prompt should highlight a different moment or angle from the input
- No text overlay in images, no people's faces close-up
- Focus on atmosphere, setting, and lifestyle feel
- Output ONLY the JSON array, nothing else`;

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  let body: ImageGenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sectionTitle, situationText, sceneText, story } = body;

  // Step 1: Convert Korean situations to English DALL-E prompts via Groq
  const conversionPrompt = `Section: ${sectionTitle}
Situations the user wants to see: ${situationText}
Scene description: ${sceneText}
Story: ${story}

Generate 3 DALL-E image prompts in English capturing different moments from this vision.`;

  let prompts: string[];
  try {
    const groq = new Groq({ apiKey: groqKey });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
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

  // Step 2: Generate 3 images with DALL-E 3 in parallel (allSettled = partial success ok)
  const openai = new OpenAI({ apiKey: openaiKey });

  const settled = await Promise.allSettled(
    prompts.slice(0, 3).map(async (prompt, i) => {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
      });
      return {
        url: response.data?.[0]?.url ?? '',
        prompt,
        index: i,
      };
    })
  );

  const images = settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((img): img is { url: string; prompt: string; index: number } => img !== null && img.url !== '');

  if (images.length === 0) {
    console.error('All DALL-E generations failed');
    return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
  }

  return NextResponse.json({ images });
}
