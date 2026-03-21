import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { newId } from "@/lib/ids";
import { insertImage } from "@/lib/db";
import { save } from "@/lib/storage";
import { withRetry } from "@/lib/ai/retry";

const ANALYSIS_PROMPT = `You are a layout engineer. Analyse this reference advertisement and produce a precise technical specification of its VISUAL STRUCTURE only. Do NOT extract, quote, or reference any headline text, copy, slogans, or written content — those will be written fresh. Extract only layout, proportions, colors, and typography style. Be specific with measurements.

Return your analysis in this exact format:

BACKGROUND: [exact color or gradient, e.g. "#ffffff" or "warm cream #f5f0e8"]
LAYOUT_SPLIT: [how the canvas is divided with percentages, e.g. "product image fills top 65%, solid color panel fills bottom 35%"]
PRODUCT_POSITION: [where and how the product appears, e.g. "full-bleed in top 65%, centered" or "left half, full height"]
PANEL_COLOR: [solid panel/background color — the area that would sit behind text, e.g. "#000000" or "none"]
ACCENT_ELEMENTS: [any frames, borders, lines, shapes, color blocks — e.g. "thin white border inset 20px from edges", "gold horizontal line 2px at y=70%", or "none"]
OVERALL_TONE: [e.g. "high-contrast black and white", "warm editorial", "minimal clean"]`;

function buildSvgPrompt(layoutSpec: string, creativeDirection: string) {
  return `You are a production SVG engineer. Your task is to faithfully recreate the layout structure of the reference advertisement (first image), but place the product from the second image inside the product position.

LAYOUT SPECIFICATION (extracted from the reference):
${layoutSpec}
${creativeDirection}
YOUR TASK:
Recreate this exact layout as SVG. Place the product (second image, using the __PRODUCT_IMAGE__ placeholder) in the product position. Reproduce all structural and decorative elements — panels, borders, frames, shapes, color blocks — but include ZERO text of any kind.

IMPLEMENTATION RULES:
1. Background — use the EXACT color from the specification
2. Layout split — implement the EXACT proportions (convert percentages to pixels out of 1080×1920)
3. Colors — copy EXACT hex values from the specification
4. Accent elements — include any frames, borders, lines, shapes, or color panels from the specification
5. Do NOT add elements not in the specification
6. NO TEXT — do not add any headline, subtext, label, watermark, logo, or any text element whatsoever. Leave text areas as empty space.

DIMENSIONS: exactly 1080×1920 pixels (9:16 portrait)

PRODUCT PHOTO:
- Embed using EXACTLY this placeholder as the href: __PRODUCT_IMAGE__
- Position and size it according to PRODUCT_POSITION from the specification
- Example: <image href="__PRODUCT_IMAGE__" x="0" y="0" width="1080" height="1152" preserveAspectRatio="xMidYMid slice"/>

TEXT RULE: The SVG must contain zero <text> elements. No headlines, no subtext, no labels, no brand names, no decorative lettering. Nothing. The user will add their own text on top.

SVG TECHNICAL RULES:
- Root: <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
- Only standard SVG elements: rect, text, image, line, circle, path, defs, clipPath, linearGradient
- font-family: web-safe only ("Arial", "Helvetica Neue", "Georgia", "Times New Roman", serif, sans-serif)
- All styles inline — no external CSS, no JavaScript
- Fully self-contained valid SVG

Return ONLY raw SVG. Start with <svg and end with </svg>. No markdown fences. No explanation.`;
}

async function runWithClaude(imageA: string, imageB: string, creativeDirection: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  console.log("[ai-compose] Step 1 — analysing layout with Claude Sonnet...");
  const analysisRes = await withRetry(() => client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageA } },
      { type: "text", text: ANALYSIS_PROMPT },
    ]}],
  }), "ai-compose-analysis-claude");
  const layoutSpec = (analysisRes.content[0] as { type: "text"; text: string }).text;
  console.log("[ai-compose] Layout spec ready.");

  console.log("[ai-compose] Step 2 — generating SVG with Claude Sonnet...");
  const svgRes = await withRetry(() => client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageA } },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB } },
      { type: "text", text: buildSvgPrompt(layoutSpec, creativeDirection) },
    ]}],
  }), "ai-compose-svg-claude");
  return (svgRes.content[0] as { type: "text"; text: string }).text;
}

async function runWithGPT41(imageA: string, imageB: string, creativeDirection: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const client = new OpenAI({ apiKey });

  console.log("[ai-compose] Step 1 — analysing layout with GPT-4.1...");
  const analysisRes = await client.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 1200,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageA}`, detail: "high" } },
      { type: "text", text: ANALYSIS_PROMPT },
    ]}],
  });
  const layoutSpec = (analysisRes.choices[0].message.content ?? "").trim();
  console.log("[ai-compose] Layout spec ready.");

  console.log("[ai-compose] Step 2 — generating SVG with GPT-4.1...");
  const svgRes = await client.chat.completions.create({
    model: "gpt-4.1",
    max_tokens: 8000,
    messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageA}`, detail: "high" } },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageB}`, detail: "high" } },
      { type: "text", text: buildSvgPrompt(layoutSpec, creativeDirection) },
    ]}],
  });
  return (svgRes.choices[0].message.content ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { imageA, imageB, prompt = "", model = "claude" } = (await req.json()) as {
      imageA: string;
      imageB: string;
      prompt?: string;
      model?: "claude" | "gpt4";
    };

    if (!imageA || !imageB) {
      return NextResponse.json({ error: "imageA and imageB are required" }, { status: 400 });
    }

    const creativeDirection = prompt
      ? `\n\nCREATIVE DIRECTION (apply on top of the layout spec):\n${prompt}\n`
      : "";

    const rawSvg = model === "gpt4"
      ? await runWithGPT41(imageA, imageB, creativeDirection)
      : await runWithClaude(imageA, imageB, creativeDirection);

    // Clean up SVG
    let svg = rawSvg.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    if (!svg.startsWith("<svg")) {
      const idx = svg.indexOf("<svg");
      if (idx !== -1) svg = svg.slice(idx);
      else throw new Error(`${model === "gpt4" ? "GPT-4.1" : "Claude"} did not return valid SVG`);
    }

    // Replace placeholder with image B
    svg = svg.replace(/__PRODUCT_IMAGE__/g, `data:image/jpeg;base64,${imageB}`);

    // Render SVG → PNG
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1080 },
      font: {
        fontDirs: [path.join(process.cwd(), "fonts")],
        defaultFontFamily: "Inter",
        sansSerifFamily: "Inter",
        serifFamily: "Playfair Display",
        loadSystemFonts: false,
      },
    });
    const pngBuffer = Buffer.from(resvg.render().asPng());

    const id = newId("img");
    const filename = `${id}.png`;
    const url = await save("uploads", filename, pngBuffer);
    await insertImage({ id, filename, url, width: 1080, height: 1920 });

    console.log(`[ai-compose] Saved: ${url}`);
    return NextResponse.json({ ok: true, imageId: id, imageUrl: url });
  } catch (err) {
    console.error("[ai-compose]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
