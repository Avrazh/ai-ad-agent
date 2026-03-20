import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "gpt-4.1";

// Injected randomly so the model picks a fresh direction each call
const ART_DIRECTIONS = [
  "editorial",
  "lifestyle-inspired",
  "close-up macro",
  "off-center composition",
  "dynamic angle",
  "minimal studio",
  "dramatic lighting",
  "soft beauty",
  "bold commercial",
  "diagonal split",
  "color field",
  "geometric overlay",
  "duotone wash",
  "asymmetric strips",
];

/**
 * Calls GPT-4.1 (vision) with the product image and asks it to generate
 * a high-quality ecommerce ad composition for Switch Nails.
 * A random art direction is injected each call to guarantee visual variety.
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

  const direction = ART_DIRECTIONS[Math.floor(Math.random() * ART_DIRECTIONS.length)];

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "You are a senior art director for Switch Nails, a premium press-on nail brand. You create bold, high-end ad compositions that always keep the nail product as the clear hero. You respond with complete valid HTML only — no explanation, no markdown.",
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
            text: `Create a high-quality ecommerce ad image for this nail product.

The style must be visually distinct and not similar to common centered product ads.

For this render, use this art direction: **${direction}**

Vary composition, camera angle, lighting, spacing, and background so the result feels original and unexpected. Avoid a generic centered layout with a plain background.

Focus on the nail product — keep it clearly visible and the hero of the composition.

No text, no typography, no logos, no UI elements, no borders or frames around the product.

The result should look like a real high-end ad creative.

TECHNICAL REQUIREMENTS:
- Canvas: ${w}px × ${h}px
- <body> must be exactly ${w}px × ${h}px, overflow:hidden, margin:0, padding:0
- All elements position:absolute
- The product image MUST appear — use EXACTLY this src: __PRODUCT_IMAGE__
- No external resources, no Google Fonts, no @import

Return ONLY raw HTML starting with <!DOCTYPE html> and ending with </html>.`,
          },
        ],
      },
    ],
  });

  const raw = (response.choices[0].message.content ?? "").trim();

  // Detect refusals — prevents apology text from being rendered as a blank page
  if (!raw.toLowerCase().includes("<!doctype") && !raw.toLowerCase().includes("<html")) {
    throw new Error(`Model refused or returned non-HTML: ${raw.slice(0, 120)}`);
  }

  let html = raw.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}
