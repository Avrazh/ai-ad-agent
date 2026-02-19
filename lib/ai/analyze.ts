import type { SafeZones } from "@/lib/types";
import { read as readStorage } from "@/lib/storage";
import path from "path";

/**
 * Mock image analyzer — returns 3 normalized safe zones.
 * Later: replace internals with real AI (Claude/GPT vision).
 * Contract stays the same: imageId in → SafeZones out.
 *
 * Image is loaded as base64 and ready to pass to real AI —
 * see "REAL AI" comment below.
 */
export async function analyzeSafeZones(imageId: string): Promise<SafeZones> {
  // Load image from storage — ready for real AI vision call
  const { getImage } = await import("@/lib/db");
  const img = getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.filename);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const imageBase64 = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`;

  // REAL AI: replace the hardcoded zones below with a Claude/GPT vision call, e.g.:
  // const zones = await callAI({ imageBase64, task: "detect safe zones" });
  // return { imageId, ...zones };
  void imageBase64; // remove this line when wiring real AI

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 200));

  return {
    imageId,
    avoidRegions: [
      // Product center area — don't place text here
      { x: 0.2, y: 0.25, w: 0.6, h: 0.5 },
    ],
    zones: [
      {
        id: "A",
        rect: { x: 0.04, y: 0.03, w: 0.5, h: 0.15 },   // top-left
      },
      {
        id: "B",
        rect: { x: 0.04, y: 0.78, w: 0.92, h: 0.19 },   // bottom
      },
      {
        id: "C",
        rect: { x: 0.6, y: 0.05, w: 0.36, h: 0.25 },    // top-right
      },
    ],
  };
}
