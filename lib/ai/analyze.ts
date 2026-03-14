import type { SafeZones } from "@/lib/types";
import { read as readStorage } from "@/lib/storage";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";

const HARDCODED_FALLBACK: Omit<SafeZones, "imageId"> = {
  avoidRegions: [{ x: 0.2, y: 0.25, w: 0.6, h: 0.5 }],
  zones: [
    { id: "A", rect: { x: 0.04, y: 0.03, w: 0.5,  h: 0.15 } },
    { id: "B", rect: { x: 0.04, y: 0.78, w: 0.92, h: 0.19 } },
    { id: "C", rect: { x: 0.6,  y: 0.05, w: 0.36, h: 0.25 } },
  ],
};

/**
 * Analyzes an image with Claude Haiku vision to find:
 *   - avoidRegions: normalized rects where the main subject is (no text here)
 *   - zones A/B/C: safe text placement areas
 *
 * Falls back to hardcoded zones if the API call fails.
 * Contract: imageId in → SafeZones out (same shape regardless of mock vs real).
 */
export async function analyzeSafeZones(imageId: string): Promise<SafeZones> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  if (process.env.SKIP_AI === "true") {
    console.log("[analyze] SKIP_AI=true — using hardcoded zones (dev mode)");
    return { imageId, ...HARDCODED_FALLBACK };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[analyze] ANTHROPIC_API_KEY not set — using hardcoded zones");
    return { imageId, ...HARDCODED_FALLBACK };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 },
            },
            {
              type: "text",
              text: `This is a product image for SWITCH NAILS, a press-on nail brand. The hand, fingers, and nails are the hero subject — they must never be covered by text.

Analyze the image and return a JSON object (no markdown, no explanation, just raw JSON) with:

1. "avoidRegions": 1–2 normalized rects (0-1) that generously cover the ENTIRE hand, fingers, and nails — err on the side of covering too much rather than missing any part of the hand. Include the wrist if visible.
2. "zones": exactly 3 objects, each with "id" ("A", "B", or "C") and "rect" (normalized 0-1). Safe areas for text that do NOT overlap the hand or nails:
   - A: top-left area (clear of hand/nails)
   - B: bottom strip (below the hand/nails, or a clear strip at the bottom)
   - C: top-right area (clear of hand/nails)

Each rect: { "x": number, "y": number, "w": number, "h": number }
All values between 0 and 1. x+w ≤ 1, y+h ≤ 1.

Return only the JSON object, example shape:
{"avoidRegions":[{"x":0.2,"y":0.2,"w":0.6,"h":0.6}],"zones":[{"id":"A","rect":{"x":0.02,"y":0.02,"w":0.45,"h":0.14}},{"id":"B","rect":{"x":0.02,"y":0.8,"w":0.96,"h":0.18}},{"id":"C","rect":{"x":0.55,"y":0.02,"w":0.43,"h":0.2}}]}`,
            },
          ],
        },
      ],
    }), "analyze");

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as {
      avoidRegions: { x: number; y: number; w: number; h: number }[];
      zones: { id: "A" | "B" | "C"; rect: { x: number; y: number; w: number; h: number } }[];
    };

    console.log(`[analyze] SafeZones from Claude for ${imageId}`);
    console.log("  avoidRegions:", JSON.stringify(parsed.avoidRegions));
    console.table(parsed.zones.map((z) => ({ id: z.id, x: z.rect.x, y: z.rect.y, w: z.rect.w, h: z.rect.h })));
    return { imageId, avoidRegions: parsed.avoidRegions, zones: parsed.zones };
  } catch (err) {
    console.error("[analyze] Claude call failed — using hardcoded fallback:", err);
    return { imageId, ...HARDCODED_FALLBACK };
  }
}
