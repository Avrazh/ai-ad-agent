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

const BACKGROUND_ARCHETYPES = [
  {
    name: "marble luxury",
    description: "Cold white marble surface with soft grey veining and subtle reflections, clean editorial luxury, high-end beauty product photography backdrop",
  },
  {
    name: "golden hour outdoor",
    description: "Warm golden hour sunlight, blurred lush garden background, soft bokeh of green leaves and flowers, dreamy lifestyle beauty atmosphere",
  },
  {
    name: "dark moody studio",
    description: "Deep charcoal or near-black background, dramatic single-source side lighting casting strong shadows, high contrast editorial beauty feel",
  },
  {
    name: "pastel flat lay",
    description: "Soft pastel surface (pink, cream, or lavender), scattered dried petals or ribbon as small props, overhead flat lay angle, soft diffused light",
  },
  {
    name: "urban editorial",
    description: "Cool grey concrete or stone texture, subtle industrial graphic feel, clean hard lines, cold tones — street fashion energy",
  },
  {
    name: "silk and fabric",
    description: "Draped silk or satin fabric with rich soft folds, luxurious tactile quality, warm or jewel-toned backdrop, sensuous and editorial",
  },
  {
    name: "minimalist white",
    description: "Pure white or off-white background, single crisp soft shadow, clean commercial product photography, very minimal and airy",
  },
  {
    name: "neon night",
    description: "Very dark background washed with colored neon light (pink, purple, or electric blue glow), high energy nightlife aesthetic, soft bokeh light effects",
  },
  {
    name: "wood and nature",
    description: "Warm wood grain surface, dried flowers or eucalyptus sprigs, organic earthy textures, soft diffused natural light, calm and grounded",
  },
  {
    name: "glassy reflection",
    description: "Glossy glass or mirror surface with sharp reflections and soft depth, sleek and minimal, high-end product shot aesthetic",
  },
];

export type PersonaContext = {
  name: string;
  visualWorld: string;
  nailPreference: string;
  motivation: string;
};

/**
 * Two-step background generation:
 * 1. GPT-4.1 vision reads the nail product colors/mood + a randomly picked
 *    archetype, then writes a background-only scene prompt.
 * 2. gpt-image-1 generates the photorealistic background (no hands, no product).
 * The product image is composited on top by the client canvas.
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

  const archetype = BACKGROUND_ARCHETYPES[Math.floor(Math.random() * BACKGROUND_ARCHETYPES.length)];

  const personaBlock = persona
    ? `Target persona: ${persona.name}
Visual world: ${persona.visualWorld}
Nail preference: ${persona.nailPreference}`
    : `Target: luxury nail brand, aspirational aesthetic`;

  // ── Step 1: GPT-4.1 vision → background scene prompt ─────────────────────
  const visionResponse = await client.chat.completions.create({
    model: MODEL_VISION,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You are a beauty art director. You write short, precise image generation prompts for photorealistic backgrounds. Output only the prompt — no explanation.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "low" },
          },
          {
            type: "text",
            text: `Look at this nail product. Note its dominant colors and overall mood.

${personaBlock}

Background archetype to use: "${archetype.name}" — ${archetype.description}

Write a 60–80 word image generation prompt for a photorealistic background scene that:
- Executes the archetype above precisely
- Uses colors that complement the nail product palette
- Contains absolutely NO hands, NO nails, NO people, NO product — pure background only
- Ends with this exact sentence: "Use a different composition than a centered product shot."

Output only the prompt.`,
          },
        ],
      },
    ],
  });

  const bgPrompt = (visionResponse.choices[0].message.content ?? "").trim();
  if (!bgPrompt) throw new Error("Vision step returned empty prompt");

  console.log(`[ai-style] Archetype: "${archetype.name}" | Prompt: ${bgPrompt.slice(0, 100)}...`);

  // ── Step 2: gpt-image-1 → background image ───────────────────────────────
  const imageResponse = await client.images.generate({
    model: MODEL_IMAGE,
    prompt: bgPrompt,
    n: 1,
    size: imageSize,
    quality: "high",
  });

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return Buffer.from(b64, "base64");
}
