import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "gpt-4.1";

// Each layout archetype forces a completely different structural approach.
// One is picked at random so consecutive renders look nothing alike.
const LAYOUT_ARCHETYPES = [
  {
    name: "diagonal split",
    instruction: "Slice the canvas diagonally. One triangle is a bold solid color, the other shows the product. The diagonal cut is the dominant visual element — sharp and decisive, not rounded.",
  },
  {
    name: "bleed crop",
    instruction: "The product is cropped hard against one or two edges of the canvas — no breathing room, no centering. The product bleeds off the frame. Fill the remaining space with a single saturated color or gradient that picks up the product's palette.",
  },
  {
    name: "color field",
    instruction: "Place the product small and off-center against a vast, single-color field. The color should feel intentional and art-directed — not a neutral. The emptiness IS the design.",
  },
  {
    name: "geometric overlay",
    instruction: "Lay bold geometric shapes (rectangles, circles, triangles) partially over and behind the product. Shapes should overlap the product — not just frame it. Use 2-3 colors maximum, high contrast.",
  },
  {
    name: "duotone wash",
    instruction: "Entire composition uses exactly two colors. Apply a duotone effect using CSS mix-blend-mode or overlapping color divs with opacity. The product sits within this two-color world.",
  },
  {
    name: "asymmetric strips",
    instruction: "Divide the canvas into 3-5 horizontal or vertical strips of varying widths. Alternate between colors, with the product spanning across multiple strips. Think risograph print or bauhaus poster.",
  },
  {
    name: "full-bleed background with floating product",
    instruction: "A single dramatic full-canvas color or gradient with NO border, NO frame, NO padding around the product. The product appears to float freely — no containing shape, no shadow box, no rectangular mat.",
  },
  {
    name: "color block with product cutout",
    instruction: "A bold color block covers roughly 60% of the canvas. The product sits at the boundary between the color block and the remaining space, creating tension. The product is NOT centered and NOT framed.",
  },
  {
    name: "layered planes",
    instruction: "Stack 3-4 semi-transparent color planes at different positions and sizes. The product sits in front of all of them. Each plane should be a distinct shape and opacity — creates depth without realism.",
  },
  {
    name: "corner anchor",
    instruction: "Product is locked hard into one corner. The rest of the canvas is empty except for a large abstract shape (arc, bar, or block) that draws the eye toward the product from the opposite corner.",
  },
];

const COLOR_DIRECTIONS = [
  "push the palette toward deep shadow tones — near black, charcoal, and one rich accent",
  "lean into the warmest color visible in the product and amplify it to near-neon",
  "near-monochrome: one color family only, varying lightness dramatically",
  "complement: find the product's dominant color and use its opposite on the color wheel",
  "desaturate the background completely — make it near-grey — so the product color pops in isolation",
  "extract the lightest tone from the product and use it as the dominant background",
  "use an unexpected color the product does NOT contain — bold and surprising",
  "high contrast: pure black and one bright color, nothing else",
];

/**
 * Calls GPT-4.1 (vision) with the product image and asks it to generate
 * a rich editorial background HTML composition — NO text, no UI elements.
 * A random layout archetype + color direction is injected each call to
 * guarantee structural variety. The product image placeholder __PRODUCT_IMAGE__
 * must be replaced by the caller.
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

  const archetype = LAYOUT_ARCHETYPES[Math.floor(Math.random() * LAYOUT_ARCHETYPES.length)];
  const colorDir = COLOR_DIRECTIONS[Math.floor(Math.random() * COLOR_DIRECTIONS.length)];

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "You are a senior art director at a luxury beauty brand. You produce HTML/CSS ad compositions for product photography. Your work is bold, structural, and unexpected — never generic. You respond with complete valid HTML only.",
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
            text: `Create an HTML ad composition for this product photo. Study the image first — note the product's shape, color, and where the visual weight sits.

LAYOUT STRUCTURE — you MUST use this exact approach:
"${archetype.name}": ${archetype.instruction}

COLOR DIRECTION:
${colorDir}

STRICT RULES — any violation makes the output unusable:
- ZERO text, words, letters, numbers, watermarks, or labels of any kind
- ZERO buttons, icons, UI chrome, price tags, logos, or branding
- ZERO borders, frames, rectangular mats, or padding effects around the product — the layout archetype above replaces all of that
- ZERO html/css comments
- Product image MUST appear using EXACTLY this src placeholder: __PRODUCT_IMAGE__
- Do NOT center the product symmetrically unless the archetype explicitly requires it

CANVAS:
- ${w}px × ${h}px, overflow:hidden, margin:0, padding:0 on <body>
- All elements position:absolute
- No external resources, no @import, no Google Fonts

Return ONLY the raw HTML starting with <!DOCTYPE html> and ending with </html>. No explanation, no markdown fences.`,
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
