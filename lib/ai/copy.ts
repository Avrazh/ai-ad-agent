import type { CopyPool, Headline } from "@/lib/types";
import { newId } from "@/lib/ids";

/**
 * Mock copy generator — returns 10 headlines grouped by angle.
 * Later: replace internals with real AI (Claude/GPT).
 * Contract stays the same: imageId in → CopyPool out.
 */
export async function generateCopyPool(imageId: string): Promise<CopyPool> {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 300));

  const headlines: Headline[] = [
    // 4× benefit
    { id: newId("hl"), angle: "benefit", text: "Salon look in 5 minutes" },
    { id: newId("hl"), angle: "benefit", text: "No glue, no mess, no stress" },
    { id: newId("hl"), angle: "benefit", text: "Reusable up to 3 weeks" },
    { id: newId("hl"), angle: "benefit", text: "Strong hold, gentle removal" },

    // 3× curiosity
    { id: newId("hl"), angle: "curiosity", text: "What if nails lasted 2 weeks?" },
    { id: newId("hl"), angle: "curiosity", text: "The secret to effortless nails" },
    { id: newId("hl"), angle: "curiosity", text: "Why 10K women switched this month" },

    // 3× urgency
    { id: newId("hl"), angle: "urgency", text: "Limited drop — grab yours" },
    { id: newId("hl"), angle: "urgency", text: "Selling fast — don't miss out" },
    { id: newId("hl"), angle: "urgency", text: "Today only: free express shipping" },
  ];

  return {
    imageId,
    headlines,
    ctas: ["Shop Now", "Get Yours", "Try It"],
  };
}
