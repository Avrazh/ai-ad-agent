import type { ImageTags } from "@/lib/types";
import { read as readStorage } from "@/lib/storage";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";

const HARDCODED_FALLBACK: ImageTags = {
  color: "nude",
  finish: "glossy",
  length: "medium",
  shape: "almond",
  style_mood: "minimal",
  complexity: "clean",
  occasion: "everyday",
  nail_art_type: "plain",
};

/**
 * Extracts structured image context tags from a nail product image using Claude Haiku vision.
 * Tags are cached in images.tags and used for persona-aware copy generation
 * without needing to re-analyze the image.
 *
 * Falls back to hardcoded defaults if the API call fails or key is missing.
 */
export async function extractImageTags(imageId: string): Promise<ImageTags> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  if (process.env.SKIP_AI === "true") {
    console.log("[tags] SKIP_AI=true — using hardcoded tags (dev mode)");
    return HARDCODED_FALLBACK;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[tags] ANTHROPIC_API_KEY not set — using hardcoded tags");
    return HARDCODED_FALLBACK;
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 256,
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
              text: `Analyze the nails in this SWITCH NAILS product image. Return ONLY a raw JSON object (no markdown, no explanation) with these exact fields and allowed values:

{
  "color": "nude|red|pink|white|black|blue|purple|green|orange|yellow|multicolor|clear",
  "finish": "glossy|matte|glitter|metallic|chrome|shimmer",
  "length": "short|medium|long",
  "shape": "round|oval|almond|square|coffin|stiletto",
  "style_mood": "minimal|elegant|bold|glam|playful|natural",
  "complexity": "clean|decorated|patterned",
  "occasion": "everyday|work|night_out|bridal|seasonal",
  "nail_art_type": "plain|french|ombre|floral|geometric|abstract|graphic"
}

Pick the single best-matching value for each field. Return only the JSON object.`,
            },
          ],
        },
      ],
    }), "tags");

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as ImageTags;

    console.log(`[tags] ImageTags from Claude for ${imageId}:`, parsed);
    return parsed;
  } catch (err) {
    console.error("[tags] Claude call failed — using hardcoded fallback:", err);
    return HARDCODED_FALLBACK;
  }
}
