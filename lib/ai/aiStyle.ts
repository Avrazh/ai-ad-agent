import type { AIStylePool } from "@/lib/types";
import { read as readStorage } from "@/lib/storage";
import path from "path";

/**
 * AI Style Pool generator — returns layout variants for a given image.
 * Later: replace internals with real AI image API (fal.ai / OpenAI).
 * Contract stays the same: imageId in → AIStylePool out.
 *
 * Image is loaded as base64 and ready to pass to real AI —
 * see "REAL AI" comment below.
 */
export async function generateAIStylePool(imageId: string): Promise<AIStylePool> {
  // Load image from storage — ready for real AI image API call
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const imageBase64 = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`;

  // REAL AI: call fal.ai / OpenAI image generation here, e.g.:
  // const variants = await callImageAI({ imageBase64, task: "generate style variants" });
  // return { imageId, variants };
  void imageBase64; // remove this line when wiring real AI

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 200));

  // Return empty pool — variants populated when real AI is connected
  return { imageId, variants: [] };
}
