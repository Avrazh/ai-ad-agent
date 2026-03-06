import Anthropic from "@anthropic-ai/sdk";
import { read } from "@/lib/storage";
import { withRetry } from "@/lib/ai/retry";

const MODEL = "claude-sonnet-4-6";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
};

export async function generateSurpriseSVG(
  imageUrl: string,
  lang: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const imageBuffer = await read("uploads", imageUrl);
  const imageBase64 = imageBuffer.toString("base64");
  const mimeType: "image/jpeg" | "image/png" | "image/webp" =
    imageUrl.match(/\.png$/i)
      ? "image/png"
      : imageUrl.match(/\.webp$/i)
      ? "image/webp"
      : "image/jpeg";

  const langName = LANG_NAMES[lang] ?? "English";
  const client = new Anthropic({ apiKey });

  const response = await withRetry(
    () =>
      client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              {
                type: "text",
                text: `You are a world-class creative director. Design a stunning, surprising print advertisement as a complete SVG.

DIMENSIONS: exactly 1080×1920 pixels (9:16 portrait)
LANGUAGE: Write all text in ${langName}

REQUIREMENTS:
- Include the product photo using EXACTLY this placeholder as the href attribute value: __PRODUCT_IMAGE__
  Example: <image href="__PRODUCT_IMAGE__" x="0" y="0" width="1080" height="960" preserveAspectRatio="xMidYMid slice"/>
- The headline must be BOLD and SURPRISING — something that makes the viewer stop and think "how did we not think of that?" Be provocative, poetic, paradoxical, or emotionally striking. Maximum 6 words. NO generic advertising copy.
- Design philosophy: MINIMALIST. Lots of negative space. Let the product and one headline breathe. Resist the urge to fill space.
- Use typography as the primary design element — one dominant text element, large scale, high contrast
- Maximum 2 colors total (not counting the product photo) — prefer black, white, or one accent
- Be specific to what you actually see in this product image — do not write generic copy
- The overall design must feel editorial, refined, and unexpected — like a luxury brand campaign

LAYOUT VARIETY — pick ONE of these approaches (do NOT default to "photo top, text bottom bar"):
A) Full-bleed photo with ONE massive headline word overlaid directly on the image at an unexpected position (top-left, center, diagonal)
B) Split: left half solid color with large vertical text, right half product photo
C) Product photo small and centered on a large solid background, headline above or below with extreme whitespace
D) Headline fills the top 60% in enormous type, product photo sits in the bottom 40%
E) Inverted: dark full-bleed background, product photo cropped as a shape, single white headline
Choose whichever feels most surprising for THIS specific product. Never use a bottom text bar layout.

SVG TECHNICAL RULES:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
- Use only standard SVG elements: rect, text, image, line, circle, path, defs, linearGradient, etc.
- For text: use font-family with web-safe or generic families (serif, sans-serif, monospace)
- Embed all styles inline (no external CSS)
- The SVG must be fully self-contained and valid

Return ONLY the raw SVG code. Start with <svg and end with </svg>. No markdown fences. No explanation. No comments outside the SVG.`,
              },
            ],
          },
        ],
      }),
    "surpriseRender"
  );

  let svg = (response.content[0] as { type: "text"; text: string }).text.trim();

  // Strip markdown fences if Claude wraps them
  svg = svg.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  // Ensure it starts with <svg
  if (!svg.startsWith("<svg")) {
    const idx = svg.indexOf("<svg");
    if (idx !== -1) svg = svg.slice(idx);
    else throw new Error("Claude did not return valid SVG");
  }

  return svg;
}
