import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "gpt-4.1";

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
 * Calls Claude Sonnet with the product image and a randomly picked archetype.
 * Generates a complete HTML/CSS ad composition with the product image embedded.
 * The __PRODUCT_IMAGE__ placeholder must be replaced by the caller.
 */
export async function generateAIBackground(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  format: Format,
  persona?: PersonaContext,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const { w, h } = FORMAT_DIMS[format];
  const client = new OpenAI({ apiKey });

  const archetype = BACKGROUND_ARCHETYPES[Math.floor(Math.random() * BACKGROUND_ARCHETYPES.length)];

  const personaBlock = persona
    ? `Target persona: ${persona.name}
Visual world: ${persona.visualWorld}
Nail preference: ${persona.nailPreference}`
    : `Target: luxury nail brand, aspirational aesthetic`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "You are a senior art director for Switch Nails, a premium press-on nail brand. You create bold, high-end ad compositions. You respond with complete valid HTML only — no explanation, no markdown.",
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
            text: `Create a high-quality ecommerce ad composition as a complete HTML page.

${personaBlock}

ARCHETYPE — execute this visual style precisely:
"${archetype.name}": ${archetype.description}

Use a different composition than a centered product shot.

PRODUCT IMAGE:
- Must appear using EXACTLY this src: __PRODUCT_IMAGE__
- Keep the nail product clearly visible and the hero of the composition
- No borders, frames, or rectangular mats around the product image

STRICT RULES:
- No text, typography, logos, or UI elements
- No external resources, no @import, no Google Fonts
- No html/css comments

CANVAS:
- ${w}px × ${h}px
- <body> must be exactly ${w}px × ${h}px, overflow:hidden, margin:0, padding:0
- All elements position:absolute

Return ONLY raw HTML starting with <!DOCTYPE html> and ending with </html>.`,
          },
        ],
      },
    ],
  });

  const raw = (response.choices[0].message.content ?? "").trim();

  if (!raw.toLowerCase().includes("<!doctype") && !raw.toLowerCase().includes("<html")) {
    throw new Error(`Model returned non-HTML: ${raw.slice(0, 120)}`);
  }

  return raw.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
}
