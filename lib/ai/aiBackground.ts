import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL_VISION = "gpt-4.1";
const MODEL_IMAGE = "gpt-image-1";

// gpt-image-1 supported sizes mapped to our formats
const FORMAT_TO_SIZE: Record<Format, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
};

export type PersonaContext = {
  name: string;
  visualWorld: string;
  nailPreference: string;
  motivation: string;
};

/**
 * Two-step image generation:
 * 1. GPT-4.1 vision analyzes the nail product and writes a DALL-E scene prompt
 *    tailored to the persona's visual world.
 * 2. DALL-E 3 generates a new photorealistic lifestyle photo.
 * Returns a PNG Buffer ready to be saved.
 */
export async function generateAIBackground(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  format: Format,
  persona?: PersonaContext,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const imageSize = FORMAT_TO_SIZE[format];

  // ── Step 1: GPT-4.1 vision → scene prompt ────────────────────────────────
  const personaBlock = persona
    ? `Target persona: ${persona.name}
Visual world: ${persona.visualWorld}
Nail preference: ${persona.nailPreference}
Motivation: ${persona.motivation}`
    : `Target: luxury nail brand, aspirational woman, mid-20s to 40s`;

  const visionResponse = await client.chat.completions.create({
    model: MODEL_VISION,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "You are a beauty product photographer and creative director. " +
          "You write precise, visual DALL-E image generation prompts. " +
          "You output only the prompt text — no explanation, no preamble.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: `Study this nail product image carefully. Note the exact nail color, finish (matte/glossy/glitter/metallic), shape, and any nail art or pattern.

${personaBlock}

Write a single DALL-E image generation prompt (120–160 words) that:
- Shows a close-up of a woman's hand with nails that match exactly what you see in this image (same color, finish, shape, and any design details)
- Places the hand in a lifestyle scene that fits the persona's visual world — aspirational, editorial, high-end
- Describes the background, lighting, props, and mood in detail
- Uses photorealistic, high-quality beauty photography style
- Specifies the camera angle (e.g. close-up from above, side angle, dramatic low light)
- Does NOT include any text, logos, or watermarks in the scene

Output only the prompt.`,
          },
        ],
      },
    ],
  });

  const dallePrompt = (visionResponse.choices[0].message.content ?? "").trim();
  if (!dallePrompt) throw new Error("Vision step returned empty prompt");

  console.log(`[ai-style] DALL-E prompt: ${dallePrompt.slice(0, 120)}...`);

  // ── Step 2: gpt-image-1 → image ──────────────────────────────────────────
  const imageResponse = await client.images.generate({
    model: MODEL_IMAGE,
    prompt: dallePrompt,
    n: 1,
    size: imageSize,
    quality: "high",
  });

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return Buffer.from(b64, "base64");
}
