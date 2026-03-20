import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "gpt-4o";

// Random seeds injected into the prompt to prevent the model from defaulting
// to the same safe layout. Mood words and color directions are combined
// randomly to produce a unique creative starting point each call.
const MOODS = [
  "dramatic and cinematic", "soft and ethereal", "bold and graphic",
  "dark and moody", "clean and architectural", "warm and intimate",
  "cold and editorial", "maximalist and layered", "stark and minimal",
  "surreal and unexpected", "classic luxury", "raw and high-contrast",
];

const COLOR_DIRECTIONS = [
  "push the palette toward deep shadow tones",
  "lean into the warmest color visible in the product",
  "use a near-monochrome palette with one sharp accent",
  "contrast the product's dominant color against its opposite",
  "desaturate everything except the product itself",
  "build the palette from the background/negative space in the product photo",
  "make the lightest tone in the image the dominant background color",
  "use an unexpected complementary color the product doesn't contain",
];

/**
 * Calls GPT-4o (vision) with the product image and asks it to generate
 * a rich editorial background HTML composition — NO text, no UI elements.
 * A random style is injected to guarantee visual variety across calls.
 * The product image placeholder __PRODUCT_IMAGE__ must be replaced by the caller.
 */
export async function generateAIBackground(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  format: Format,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const { w, h } = FORMAT_DIMS[format];
  const client = new OpenAI({ apiKey });

  // Random seeds — prevent the model from defaulting to the same safe layout
  const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
  const colorDir = COLOR_DIRECTIONS[Math.floor(Math.random() * COLOR_DIRECTIONS.length)];

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: `You are a world-class art director creating a background composition for this product image.

CONTEXT:
This is a nail product — nail polish, gel, press-ons, or nail art. The background should feel like a premium beauty or nail brand editorial: tactile, close-up, feminine or bold depending on the mood, with a strong sense of texture and color.

STEP 1 — READ THE IMAGE:
Study the product carefully: its shape, where the visual weight sits, what's in focus, how much negative space surrounds it, whether it's better featured centered or offset, portrait or landscape in feel.
Consider nail-specific context: the product likely has a strong color story — let that drive everything.
Let those observations drive your layout decisions.

STEP 2 — APPLY THIS CREATIVE DIRECTION:
Mood: ${mood}
Color: ${colorDir}

Use the mood and color direction to set the atmosphere and palette, but let the image's own composition tell you where to place it and how to structure the canvas around it.

STEP 3 — BUILD IT:
Think beauty editorial — the kind of background you'd see in a Vogue beauty spread or a premium nail brand lookbook. Abstract shapes, soft gradients, bold color blocks, or textural overlays all work. Lean minimalist — fewer elements, more intentional negative space, nothing decorative that doesn't serve the composition. The result should feel like it was designed specifically for this nail product, not a generic template.

RULES:
- Include ZERO text, letters, words, numbers, labels, watermarks, or placeholder text
- Include ZERO buttons, icons, UI elements, price tags, logos, or branding
- Include ZERO html/css comments in your output
- The product image MUST appear — use EXACTLY this placeholder as its src: __PRODUCT_IMAGE__
- You may use __PRODUCT_IMAGE__ more than once if the composition calls for it

CANVAS:
- Width: ${w}px, Height: ${h}px
- <body> must be exactly ${w}px × ${h}px, overflow:hidden, margin:0, padding:0
- All elements position:absolute
- No external resources, no Google Fonts

Return ONLY the complete HTML. No markdown, no code fences, no explanation.
Start with <!DOCTYPE html> and end with </html>.`,
          },
        ],
      },
    ],
  });

  let html = (response.choices[0].message.content ?? "").trim();
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}
