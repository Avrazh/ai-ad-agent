import type { CopyPool, CopySlot, Language } from "@/lib/types";
import { newId } from "@/lib/ids";
import { read as readStorage } from "@/lib/storage";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Generates a CopyPool using Claude Haiku vision.
 * Claude looks at the image and writes product-specific slots:
 *   1 headline × 2 languages (EN + DE) = 2
 *   1 quote    × 2 languages (EN + DE) = 2
 *   1 subtext  × 2 languages (EN + DE) = 2
 *   Total: 6 slots
 *
 * Falls back to hardcoded pool if the API call fails or key is missing.
 */
export async function generateCopyPool(imageId: string): Promise<CopyPool> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  if (process.env.SKIP_AI === "true") {
    console.log("[copy] SKIP_AI=true — using hardcoded pool (dev mode)");
    return buildHardcodedPool(imageId);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[copy] ANTHROPIC_API_KEY not set — using hardcoded pool");
    return buildHardcodedPool(imageId);
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
              text: `You are an expert e-commerce ad copywriter for SWITCH NAILS (press-on nails brand). The image shows the brand’s nails product. Write ad copy in English (en) and German (de).

Return ONLY a raw JSON object (no markdown, no explanation) with this exact shape:

{
  "en": {
    "headline": {"angle":"benefit","text":"..."},
    "quote": {"text":"...","attribution":"— Name, Verified Buyer"},
    "subtext": {"angle":"benefit","text":"..."}
  },
  "de": {
    "headline": {"angle":"benefit","text":"..."},
    "quote": {"text":"...","attribution":"— Name, Verifizierte Käuferin"},
    "subtext": {"angle":"benefit","text":"..."}
  }
}

Rules:
- headline: 1-8 words, punchy, specific to what you see in the image. Pick best angle from: benefit, curiosity, urgency, emotional, aspirational, story, contrast
- quote: 10-25 words, customer review voice, first person, specific benefit
- subtext: 3-8 words, supporting line matching the headline angle
- German: natural fluent German, not a literal translation
- No emojis anywhere
- Always write about the stick-on nails — ignore rings, jewelry or other props`,
            },
          ],
        },
      ],
    }), "copy");

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<
      string,
      {
        headline: { angle: string; text: string };
        quote: { text: string; attribution: string };
        subtext: { angle: string; text: string };
      }
    >;

    const slots: CopySlot[] = [];

    for (const lang of ["en", "de"] as Language[]) {
      const bucket = parsed[lang];
      if (!bucket) continue;

      const h = bucket.headline;
      if (h?.text) slots.push({ id: newId("sl"), lang, slotType: "headline", text: h.text, angle: h.angle as CopySlot["angle"], wordCount: h.text.trim().split(/\s+/).filter(Boolean).length });

      const q = bucket.quote;
      if (q?.text) slots.push({ id: newId("sl"), lang, slotType: "quote", text: q.text, attribution: q.attribution, wordCount: q.text.trim().split(/\s+/).filter(Boolean).length });

      const s = bucket.subtext;
      if (s?.text) slots.push({ id: newId("sl"), lang, slotType: "subtext", text: s.text, angle: s.angle as CopySlot["angle"], wordCount: s.text.trim().split(/\s+/).filter(Boolean).length });
    }

    console.log(`[copy] CopyPool from Claude for ${imageId} — ${slots.length} slots`);
    console.table(
      slots.map((s) => ({
        lang:  s.lang,
        type:  s.slotType,
        angle: s.angle ?? (s.slotType === "quote" ? "—" : ""),
        text:  s.text,
      }))
    );
    return { imageId, slots };
  } catch (err) {
    console.error("[copy] Claude call failed — using hardcoded fallback:", err);
    return buildHardcodedPool(imageId);
  }
}

// ── Hardcoded fallback pool (generic, used when API key is missing or call fails) ──

function buildHardcodedPool(imageId: string): CopyPool {
  const slots: CopySlot[] = [
    { id: newId("sl"), lang: "en", slotType: "headline", text: "Salon look in 5 minutes",            angle: "benefit", wordCount: 5 },
    { id: newId("sl"), lang: "en", slotType: "quote",    text: "I literally threw away my nail kit after using these. Zero chipping, zero hassle, zero regrets.", attribution: "— Emma R., Verified Buyer", wordCount: 16 },
    { id: newId("sl"), lang: "en", slotType: "subtext",  text: "Professional results at home",        angle: "benefit", wordCount: 4 },
    { id: newId("sl"), lang: "de", slotType: "headline", text: "Salon-Look in 5 Minuten",             angle: "benefit", wordCount: 4 },
    { id: newId("sl"), lang: "de", slotType: "quote",    text: "Ich habe mein Nagelset weggeworfen, nachdem ich diese benutzt habe. Kein Absplittern, kein Aufwand, keine Reue.", attribution: "— Emma R., Verifizierte Käuferin", wordCount: 17 },
    { id: newId("sl"), lang: "de", slotType: "subtext",  text: "Professionelle Ergebnisse zu Hause",  angle: "benefit", wordCount: 4 },
  ];
  return { imageId, slots };
}
