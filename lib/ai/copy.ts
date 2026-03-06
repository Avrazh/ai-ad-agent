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
 *   9 headline slots × 2 languages (EN + DE) = 18
 *   3 quote slots    × 2 languages (EN + DE) = 6
 *   8 subtext slots  × 2 languages (EN + DE) = 16
 *   Total: 40 slots
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[copy] ANTHROPIC_API_KEY not set — using hardcoded pool");
    return buildHardcodedPool(imageId);
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 2048,
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
              text: `You are an expert e-commerce ad copywriter. Look at this product image carefully and write ad copy for it in English (en) and German (de).

Return ONLY a raw JSON object (no markdown, no explanation) with this exact shape:

{
  "en": {
    "headlines": [
      {"angle":"benefit","text":"..."},
      {"angle":"benefit","text":"..."},
      {"angle":"curiosity","text":"..."},
      {"angle":"urgency","text":"..."},
      {"angle":"emotional","text":"..."},
      {"angle":"aspirational","text":"..."},
      {"angle":"aspirational","text":"..."},
      {"angle":"story","text":"..."},
      {"angle":"contrast","text":"..."}
    ],
    "quotes": [
      {"text":"...","attribution":"— Name, Verified Buyer"},
      {"text":"...","attribution":"— Name, Verified Buyer"},
      {"text":"...","attribution":"— Name, Verified Buyer"}
    ],
    "subtexts": [
      {"angle":"benefit","text":"..."},
      {"angle":"curiosity","text":"..."},
      {"angle":"urgency","text":"..."},
      {"angle":"emotional","text":"..."},
      {"angle":"aspirational","text":"..."},
      {"angle":"aspirational","text":"..."},
      {"angle":"story","text":"..."},
      {"angle":"contrast","text":"..."}
    ]
  },
  "de": { ... same structure ... }
}

Rules:
- headlines: 1-8 words, punchy, specific to what you see in the image
- aspirational headlines: ≤7 words, refined, no emojis, no urgency
- quotes: 10-25 words, customer review voice, first person, specific benefit
- subtexts: 3-8 words, match the angle of its paired headline
- German: natural fluent German, not a literal translation
- No emojis anywhere
- Write about the actual product visible in the image, not generic copy`,
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
        headlines: { angle: string; text: string }[];
        quotes: { text: string; attribution: string }[];
        subtexts: { angle: string; text: string }[];
      }
    >;

    const slots: CopySlot[] = [];

    for (const lang of ["en", "de"] as Language[]) {
      const bucket = parsed[lang];
      if (!bucket) continue;

      for (const h of bucket.headlines) {
        slots.push({ id: newId("sl"), lang, slotType: "headline", text: h.text, angle: h.angle as CopySlot["angle"], wordCount: h.text.trim().split(/\s+/).filter(Boolean).length });
      }
      for (const q of bucket.quotes) {
        slots.push({ id: newId("sl"), lang, slotType: "quote", text: q.text, attribution: q.attribution, wordCount: q.text.trim().split(/\s+/).filter(Boolean).length });
      }
      for (const s of bucket.subtexts) {
        slots.push({ id: newId("sl"), lang, slotType: "subtext", text: s.text, angle: s.angle as CopySlot["angle"], wordCount: s.text.trim().split(/\s+/).filter(Boolean).length });
      }
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
  const headlinePool: Record<Language, { angle: string; text: string }[]> = {
    en: [
      { angle: "benefit",      text: "Salon look in 5 minutes" },
      { angle: "benefit",      text: "No glue, no mess, no stress" },
      { angle: "curiosity",    text: "What if nails lasted 2 weeks?" },
      { angle: "urgency",      text: "Limited drop — grab yours" },
      { angle: "emotional",    text: "You deserve nails that turn heads" },
      { angle: "aspirational", text: "Effortlessly you." },
      { angle: "aspirational", text: "Crafted for the discerning few." },
      { angle: "story",        text: "She stopped getting manicures. Here's why." },
      { angle: "contrast",     text: "Salon price. Home speed." },
    ],
    de: [
      { angle: "benefit",      text: "Salon-Look in 5 Minuten" },
      { angle: "benefit",      text: "Kein Kleber, kein Chaos, kein Stress" },
      { angle: "curiosity",    text: "Was, wenn Nägel 2 Wochen halten?" },
      { angle: "urgency",      text: "Limitierte Edition — jetzt sichern" },
      { angle: "emotional",    text: "Du verdienst Nägel, die Blicke fangen" },
      { angle: "aspirational", text: "Mühelose Eleganz." },
      { angle: "aspirational", text: "Für anspruchsvolle Geschmäcker." },
      { angle: "story",        text: "Sie hörte auf, zum Nagelstudio zu gehen. Das ist der Grund." },
      { angle: "contrast",     text: "Salon-Qualität. Heimvorteil." },
    ],
    fr: [],
    es: [],
  };

  const quotePool: Record<Language, { text: string; attribution: string }[]> = {
    en: [
      { text: "I literally threw away my nail kit after using these. Zero chipping, zero hassle, zero regrets.", attribution: "— Emma R., Verified Buyer" },
      { text: "My manicurist was shocked these aren't gel. Two weeks in and they still look perfect.", attribution: "— Sophie M., Verified Buyer" },
      { text: "I've tried every press-on brand out there. Nothing comes close to this quality.", attribution: "— Jade L., Verified Buyer" },
    ],
    de: [
      { text: "Ich habe mein Nagelset weggeworfen, nachdem ich diese benutzt habe. Kein Absplittern, kein Aufwand, keine Reue.", attribution: "— Emma R., Verifizierte Käuferin" },
      { text: "Meine Nageldesignerin war schockiert, dass das kein Gel ist. Zwei Wochen später sehen sie noch perfekt aus.", attribution: "— Sophie M., Verifizierte Käuferin" },
      { text: "Ich habe jede Marke ausprobiert. Nichts kommt an diese Qualität heran.", attribution: "— Jade L., Verifizierte Käuferin" },
    ],
    fr: [],
    es: [],
  };

  const subtextPool: Record<Language, { angle: string; text: string }[]> = {
    en: [
      { angle: "benefit",      text: "Professional results at home" },
      { angle: "curiosity",    text: "See what you've been missing" },
      { angle: "urgency",      text: "Limited time · Limited stock" },
      { angle: "emotional",    text: "Because you deserve the best" },
      { angle: "aspirational", text: "Luxury Collection" },
      { angle: "aspirational", text: "For the discerning few" },
      { angle: "story",        text: "Her secret. Now yours." },
      { angle: "contrast",     text: "Salon quality. Home price." },
    ],
    de: [
      { angle: "benefit",      text: "Professionelle Ergebnisse zu Hause" },
      { angle: "curiosity",    text: "Entdecke, was du verpasst hast" },
      { angle: "urgency",      text: "Limitiert · Jetzt sichern" },
      { angle: "emotional",    text: "Weil du das Beste verdienst" },
      { angle: "aspirational", text: "Luxuskollektion" },
      { angle: "aspirational", text: "Für anspruchsvolle Geschmäcker" },
      { angle: "story",        text: "Ihr Geheimnis. Jetzt deins." },
      { angle: "contrast",     text: "Salon-Qualität. Heimvorteil." },
    ],
    fr: [],
    es: [],
  };

  const slots: CopySlot[] = [];

  for (const lang of ["en", "de"] as Language[]) {
    for (const entry of headlinePool[lang]) {
      slots.push({ id: newId("sl"), lang, slotType: "headline", text: entry.text, angle: entry.angle as CopySlot["angle"], wordCount: entry.text.trim().split(/\s+/).filter(Boolean).length });
    }
    for (const entry of quotePool[lang]) {
      slots.push({ id: newId("sl"), lang, slotType: "quote", text: entry.text, attribution: entry.attribution, wordCount: entry.text.trim().split(/\s+/).filter(Boolean).length });
    }
    for (const entry of subtextPool[lang]) {
      slots.push({ id: newId("sl"), lang, slotType: "subtext", text: entry.text, angle: entry.angle as CopySlot["angle"], wordCount: entry.text.trim().split(/\s+/).filter(Boolean).length });
    }
  }

  return { imageId, slots };
}
