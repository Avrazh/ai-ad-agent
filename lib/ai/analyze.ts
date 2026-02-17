import type { SafeZones } from "@/lib/types";

/**
 * Mock image analyzer — returns 3 normalized safe zones.
 * Later: replace internals with real AI (Claude/GPT vision).
 * Contract stays the same: imageId in → SafeZones out.
 */
export async function analyzeSafeZones(imageId: string): Promise<SafeZones> {
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
