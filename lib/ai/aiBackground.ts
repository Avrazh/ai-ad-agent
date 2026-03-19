import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/ai/retry";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

// Each entry is a distinct visual style. One is picked randomly per call to
// guarantee variety and remove Claude's tendency to default to the same safe layout.
const STYLE_DIRECTIVES = [
  `BOLD COLOR SPLIT: Left 45% is a solid deep color block (no image), right 55% is the product photo full-height edge-to-edge. The color block must be picked from a dominant tone in the product. No gradients on the color block — flat and bold.`,
  `FULL-BLEED VIGNETTE: Product photo fills the entire canvas. Apply a very heavy dark vignette using radial-gradient (rgba(0,0,0,0) center → rgba(0,0,0,0.75) edges). The product is bright in the center, darkness frames it dramatically.`,
  `MAGAZINE STRIP: Product photo in the upper 58% of canvas (full-width, object-fit:cover). A thick solid color panel (from a tone in the product) fills the bottom 42%. A single thin horizontal line (2px, contrasting color) separates them.`,
  `FLOATING PRODUCT: Solid flat-color background (pick a muted complementary tone). Product image centered and slightly smaller than canvas (85% width), with a subtle drop-shadow (box-shadow: 0 40px 80px rgba(0,0,0,0.4)). Wide color margins visible on all sides.`,
  `DIAGONAL COLOR WASH: Product full-bleed. Two overlapping diagonal gradient layers: first goes from top-left (brand color, 0.4 opacity) to transparent; second goes from bottom-right (complementary dark, 0.5 opacity) to transparent. Creates a cinematic dual-tone atmosphere.`,
  `EDITORIAL INSET: Wide border (80–100px) all around in a deep solid color. Inside the border: the product photo fills the remaining area. A thin inner border line (1px, lighter tone) traces the product area 8px inward from the color border.`,
  `HORIZONTAL BANDS: Canvas divided into 3 horizontal bands. Top band: 20% height, solid accent color. Middle band: 60% height, product photo (object-fit:cover, full-width). Bottom band: 20% height, same or complementary solid color. Clean and graphic.`,
  `DUOTONE OVERLAY: Product photo full-bleed. Two color layers stacked on top using mix-blend-mode — a "multiply" layer in a rich dark tone and a "screen" layer in a bright accent tone, both at partial opacity. Effect: dreamy editorial duotone wash.`,
  `CENTERED FRAME: Product photo full-bleed at lower opacity (0.35). On top: a centered solid-color rectangle (60% width, 75% height) as the "frame" background, with product image also shown inside it at full opacity using the same src and clip. Creates a framed-photo-on-photo effect.`,
  `SIDE STRIPE: Product photo fills right 70% of canvas. Left 30%: bold solid vertical stripe in a color extracted from the product. A second thinner stripe (8% width) sits between them in a contrasting accent color.`,
];

/**
 * Calls Claude Sonnet (vision) with the product image and asks it to generate
 * a rich editorial background HTML composition — NO text, no UI elements.
 * A random style is injected to guarantee visual variety across calls.
 * The product image placeholder __PRODUCT_IMAGE__ must be replaced by the caller.
 */
export async function generateAIBackground(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  format: Format,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const { w, h } = FORMAT_DIMS[format];
  const client = new Anthropic({ apiKey });

  // Pick a random style to force variety
  const style = STYLE_DIRECTIVES[Math.floor(Math.random() * STYLE_DIRECTIVES.length)];

  const response = await withRetry(() => client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mimeType, data: imageBase64 },
        },
        {
          type: "text",
          text: `You are a world-class art director. Implement EXACTLY this layout style for the product image above:

MANDATORY STYLE — implement this precisely, do not substitute:
${style}

CRITICAL RULES:
- Include ZERO text, letters, words, numbers, labels, watermarks, or placeholder text
- Include ZERO buttons, icons, UI elements, price tags, logos, or branding
- Include ZERO html/css comments in your output
- Use EXACTLY this placeholder as the image src: __PRODUCT_IMAGE__
- You may use it multiple times if the style requires it

CANVAS:
- Width: ${w}px, Height: ${h}px
- <body> must be exactly ${w}px × ${h}px, overflow:hidden, margin:0, padding:0
- All elements position:absolute
- No external resources

COLOR PALETTE: Extract 2–3 colors directly from the product image. Be specific (e.g. dusty rose #c9a0a0, deep charcoal #1c1c1c).

Return ONLY the complete HTML. No markdown, no code fences, no explanation.
Start with <!DOCTYPE html> and end with </html>.`,
        },
      ],
    }],
  }), "generateAIBackground");

  let html = (response.content[0] as { type: "text"; text: string }).text.trim();
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}
