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
  lang: string,
  referenceBase64?: string,
  referenceMimeType?: string,
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


  const hasReference = !!referenceBase64;
  const refMime = `image/${referenceMimeType ?? "jpeg"}` as "image/jpeg" | "image/png" | "image/webp";

  // ── Reference path: two-step — analyse first, then generate ──
  // Step 1 asks Claude to describe the reference in precise visual terms.
  // Step 2 uses that description + the product image to generate the SVG.
  // This mirrors manually pasting into ChatGPT and analysing before generating.
  let referenceAnalysis = "";
  if (hasReference) {
    const analysisResponse = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64" as const, media_type: refMime, data: referenceBase64! },
          },
          {
            type: "text",
            text: `You are a layout engineer. Analyse this reference advertisement and produce a precise technical specification that can be used to recreate its structure in SVG code. Be extremely specific with numbers and measurements.

Return your analysis in this exact format:

BACKGROUND: [exact color or gradient, e.g. "#ffffff" or "black #000000" or "warm cream #f5f0e8"]
LAYOUT_SPLIT: [describe how the canvas is divided, with percentages, e.g. "product image fills top 65%, solid color panel fills bottom 35%" or "left half is dark panel, right half is product image"]
PRODUCT_POSITION: [where and how the product/subject appears, e.g. "full-bleed in top 65%, centered, slight bottom crop" or "left half, full height, edge-to-edge"]
PANEL_COLOR: [the solid panel/background color behind text, e.g. "#000000" or "#1a1a2e" or "white"]
HEADLINE_FONT: [serif OR sans-serif, weight: bold/regular, case: UPPERCASE/Title/lowercase, approximate size: large/medium/small]
HEADLINE_POSITION: [e.g. "centered horizontally, in the bottom panel, about 30% from top of panel" or "left-aligned, top-left corner, 5% from edges"]
HEADLINE_COLOR: [exact text color]
SUBTEXT: [YES/NO — if yes: describe font, size, position, color]
ACCENT_ELEMENTS: [any lines, borders, shapes, e.g. "thin white horizontal line above headline" or "none"]
OVERALL_TONE: [e.g. "high-contrast black and white", "warm editorial", "minimal white space"]`,
          },
        ],
      }],
    }), "referenceAnalysis");
    referenceAnalysis = (analysisResponse.content[0] as { type: "text"; text: string }).text;
  }

  const svgPromptText = hasReference
    ? `You are a production SVG engineer tasked with faithfully implementing a specific advertisement layout. This is NOT a creative exercise — you must implement the exact visual specification below.

SPECIFICATION (derived from the reference image above):
${referenceAnalysis}

YOUR TASK:
Implement the layout described in the SPECIFICATION above as SVG, substituting the product photo (second image above) for the reference product. The structure, proportions, colors, and typography style must match the specification precisely.

IMPLEMENTATION RULES:
1. Background color — use the EXACT color from the specification (not black unless specified)
2. Layout split — implement the EXACT proportions described (e.g. if spec says "top 60% image / bottom 40% panel", use y="0" height="1152" for image and y="1152" height="768" for panel)
3. Typography — match the font style (serif vs sans-serif), weight, case (uppercase/lowercase), and approximate size from the specification
4. Color palette — copy the EXACT hex values or color descriptions from the specification for backgrounds, text, and accents
5. Text placement — headline position and alignment must match (left/center/right, top/middle/bottom)
6. Graphic elements — include any lines, borders, shapes, or overlays mentioned in the specification
7. Do NOT add elements not in the specification. Do NOT substitute a dark background if the spec says white/light

DIMENSIONS: exactly 1080×1920 pixels (9:16 portrait)
LANGUAGE: Write all copy in ${langName} — match the headline length and tone from the specification

PRODUCT PHOTO (second image above):
- Embed using EXACTLY this placeholder as the href: __PRODUCT_IMAGE__
- Position and size it according to the layout proportions in the specification
- Example for full-bleed top half: <image href="__PRODUCT_IMAGE__" x="0" y="0" width="1080" height="960" preserveAspectRatio="xMidYMid slice"/>

TEXT ELEMENTS: include ONLY 1 headline + optionally 1 short subtext line. NO labels, NO page numbers, NO studio names, NO URLs, NO footnotes, NO watermarks, NO decorative small text. If it is not the headline or subtext, remove it.

SVG TECHNICAL RULES:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
- Use only standard SVG elements: rect, text, image, line, circle, path, defs, clipPath, linearGradient, pattern
- font-family must be web-safe: "Arial", "Helvetica Neue", "Georgia", "Times New Roman", or generic (serif, sans-serif)
- All styles inline — no external CSS, no JavaScript
- SVG must be fully self-contained and valid

Return ONLY raw SVG. Start with <svg and end with </svg>. No markdown fences. No explanation.`
    : `You are a world-class creative director. Design a stunning, surprising print advertisement as a complete SVG.

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
- LAYOUT — invent something completely original. Do not follow any preset pattern. Surprise yourself.
- TEXT ELEMENTS — include ONLY: 1 headline + optionally 1 short subtext line. NO labels, NO page numbers, NO studio names, NO URLs, NO footnotes, NO watermarks, NO brand names, NO decorative small text of any kind. If it is not the headline or subtext, it must not exist.

SVG TECHNICAL RULES:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
- Use only standard SVG elements: rect, text, image, line, circle, path, defs, linearGradient, etc.
- For text: use font-family with web-safe or generic families (serif, sans-serif, monospace)
- Embed all styles inline (no external CSS)
- The SVG must be fully self-contained and valid

Return ONLY the raw SVG code. Start with <svg and end with </svg>. No markdown fences. No explanation. No comments outside the SVG.`;

  const response = await withRetry(
    () =>
      client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              // Include reference image again in step 2 so Claude can see it visually
              // (same as ChatGPT where the reference stays visible throughout the conversation)
              ...(hasReference ? [{
                type: "image" as const,
                source: { type: "base64" as const, media_type: refMime, data: referenceBase64! },
              }] : []),
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: imageBase64 },
              },
              {
                type: "text",
                text: svgPromptText,
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
