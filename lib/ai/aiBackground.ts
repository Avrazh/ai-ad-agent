import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/lib/ai/retry";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL = "claude-sonnet-4-6";

/**
 * Calls Claude Sonnet (vision) with the product image and asks it to generate
 * a rich editorial background HTML composition — NO text, no UI elements.
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
          text: `You are a world-class art director for luxury product advertising. Create a rich editorial background composition for this product image.

CRITICAL RULES — VIOLATING THESE WILL BREAK THE AD:
- Include ZERO text, letters, words, numbers, labels, watermarks, or placeholder text
- Include ZERO buttons, icons, UI elements, price tags, logos, or branding
- Include ZERO html/css comments
- The product image MUST appear in the composition
- Use EXACTLY this placeholder as the image src: __PRODUCT_IMAGE__

CANVAS REQUIREMENTS:
- Width: ${w}px, Height: ${h}px
- The <body> must be exactly ${w}px × ${h}px with overflow:hidden and no margin/padding
- All elements must be positioned absolutely within the body
- No scrollbars, no external resources

COMPOSITION STYLE (pick the one that best suits the product):
- Full-bleed product photo with a sophisticated gradient or color wash overlay
- Split composition: solid geometric color panel (40–55% of canvas) + product photo panel
- Editorial "frame": product photo with geometric border elements (lines, shapes, color blocks) around it
- Layered depth: product on a rich tinted/gradient background with subtle geometric accents

AESTHETIC:
- Luxury editorial — think Vogue, Harper's Bazaar, LVMH campaigns
- Sophisticated color palette — max 3 colors, chosen from tones visible in the product image
- Clean geometric shapes — rectangles, lines, subtle gradients
- The product should be the clear visual hero

Return ONLY the complete HTML. No markdown, no code fences, no explanation.
Start with <!DOCTYPE html> and end with </html>.`,
        },
      ],
    }],
  }), "generateAIBackground");

  let html = (response.content[0] as { type: "text"; text: string }).text.trim();
  // Strip markdown code fences if Claude wraps the response
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}
