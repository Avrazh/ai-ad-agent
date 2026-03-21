import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { newId } from "@/lib/ids";
import { insertImage } from "@/lib/db";
import { save } from "@/lib/storage";
import { withRetry } from "@/lib/ai/retry";

const MODEL_CLAUDE = "claude-sonnet-4-6";
const MODEL_IMAGE = "gpt-image-1";

// Target size for edit API (must be same for image + mask)
const EDIT_W = 1024;
const EDIT_H = 1536;

export async function POST(req: NextRequest) {
  try {
    const { imageA, imageB, prompt = "" } = (await req.json()) as {
      imageA: string; // base64 — scene containing a display/screen
      imageB: string; // base64 — product to show on the display
      prompt?: string;
    };

    if (!imageA || !imageB) {
      return NextResponse.json({ error: "imageA and imageB are required" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

    const claude = new Anthropic({ apiKey: anthropicKey });
    const openai = new OpenAI({ apiKey: openaiKey });

    // ── Step 1: Resize image A to edit dimensions ──────────────────────────────
    // Claude detects on the resized version so coordinates map directly to mask
    const imageARaw = Buffer.from(imageA, "base64");
    const imageAResized = await sharp(imageARaw)
      .resize(EDIT_W, EDIT_H, { fit: "cover" })
      .png()
      .toBuffer();
    const imageAResizedB64 = imageAResized.toString("base64");

    // ── Step 2: Claude detects the display region in image A ───────────────────
    console.log("[ai-inpaint] Detecting display region in image A...");
    const detectionResponse = await withRetry(() => claude.messages.create({
      model: MODEL_CLAUDE,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: imageAResizedB64 },
          },
          {
            type: "text",
            text: `Find the rectangular display surface in this image — it could be a phone screen, TV, billboard, monitor, digital frame, poster, picture frame, canvas, shop window display, or any flat surface showing content.

Return ONLY a JSON object. Coordinates are normalized 0.0–1.0 relative to image width/height:
{
  "found": true,
  "type": "phone screen",
  "x": 0.0,
  "y": 0.0,
  "w": 0.0,
  "h": 0.0,
  "confidence": "high"
}

If no display is found: { "found": false }

No explanation, no markdown. Only the JSON object.`,
          },
        ],
      }],
    }), "ai-inpaint-detect");

    const detectionText = (detectionResponse.content[0] as { type: "text"; text: string }).text.trim();
    let detection: { found: boolean; type?: string; x?: number; y?: number; w?: number; h?: number; confidence?: string };
    try {
      // Strip any accidental markdown fences
      const cleaned = detectionText.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      detection = JSON.parse(cleaned);
    } catch {
      throw new Error(`Could not parse display detection: ${detectionText.slice(0, 200)}`);
    }

    if (!detection.found) {
      throw new Error("No display or screen found in image A. Try a scene that clearly contains a phone, TV, billboard, or picture frame.");
    }

    const { type = "display", x = 0, y = 0, w: dw = 0, h: dh = 0, confidence = "medium" } = detection;
    console.log(`[ai-inpaint] Detected "${type}" at (${x.toFixed(2)}, ${y.toFixed(2)}) ${dw.toFixed(2)}×${dh.toFixed(2)}, confidence: ${confidence}`);

    // ── Step 3: Build mask — transparent in display region, opaque elsewhere ──
    const maskX = Math.round(x * EDIT_W);
    const maskY = Math.round(y * EDIT_H);
    const maskW = Math.max(1, Math.round(dw * EDIT_W));
    const maskH = Math.max(1, Math.round(dh * EDIT_H));

    // Transparent rectangle = "edit here"; black opaque = "leave alone"
    const transparentRect = await sharp({
      create: { width: maskW, height: maskH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const maskBuffer = await sharp({
      create: { width: EDIT_W, height: EDIT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
    })
      .composite([{ input: transparentRect, left: maskX, top: maskY }])
      .png()
      .toBuffer();

    // ── Step 4: gpt-image-1 edit — pass both images, place product directly ──────
    // image[0] = scene (with mask), image[1] = product reference (used as-is)
    console.log("[ai-inpaint] Calling gpt-image-1 edit with both images...");
    const customDir = prompt ? ` ${prompt}` : "";
    const editPrompt = `Place the product from the second image onto the ${type} in the first image. Show the actual product exactly as it appears — same colors, shape, and design. Fit it naturally within the display area, matching perspective and lighting of the scene.${customDir}`;

    const imageBBuffer = Buffer.from(imageB, "base64");
    const imageAFile = await toFile(imageAResized, "image.png", { type: "image/png" });
    const imageBFile = await toFile(imageBBuffer, "product.jpeg", { type: "image/jpeg" });
    const maskFile = await toFile(maskBuffer, "mask.png", { type: "image/png" });

    const editResponse = await openai.images.edit({
      model: MODEL_IMAGE,
      image: [imageAFile, imageBFile],
      mask: maskFile,
      prompt: editPrompt,
      n: 1,
      size: `${EDIT_W}x${EDIT_H}` as "1024x1536",
    });

    const b64 = editResponse.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no image data");

    // ── Step 6: Resize to 1080×1920 and save ──────────────────────────────────
    const outW = 1080, outH = 1920;
    const resultBuffer = await sharp(Buffer.from(b64, "base64"))
      .resize(outW, outH, { fit: "cover" })
      .png()
      .toBuffer();

    const id = newId("img");
    const filename = `${id}.png`;
    const url = await save("uploads", filename, resultBuffer);
    await insertImage({ id, filename, url, width: outW, height: outH });

    console.log(`[ai-inpaint] Saved: ${url}`);
    return NextResponse.json({ ok: true, imageId: id, imageUrl: url });
  } catch (err) {
    console.error("[ai-inpaint]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
