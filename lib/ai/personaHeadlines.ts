import Anthropic from "@anthropic-ai/sdk";
import type { ImageTags } from "@/lib/types";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_HEADLINE = "The nails made for you";

/**
 * Generates two English headlines per persona (one per tone) for a given image.
 * Uses pre-cached ImageTags - pure text prompt, no vision tokens.
 * Returns Record<personaId, Record<tone, headline>>. Falls back on any error.
 */
export async function generatePersonaHeadlines(
  imageId: string
): Promise<Record<string, Record<string, string>>> {
  const { getImage, getAllPersonas } = await import("@/lib/db");

  const img = await getImage(imageId);
  if (!img) throw new Error(`Image ${imageId} not found`);

  const tags = img.tags as ImageTags | null;
  if (!tags) throw new Error(`Image ${imageId} has no tags - run analyze first`);

  const personas = await getAllPersonas();

  const makeFallback = () =>
    Object.fromEntries(
      personas.map((p) => [
        p.id,
        Object.fromEntries(p.tones.map((t) => [t, FALLBACK_HEADLINE])),
      ])
    );

  if (process.env.SKIP_AI === "true") {
    console.log("[persona-headlines] SKIP_AI=true - using hardcoded fallback");
    return makeFallback();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[persona-headlines] ANTHROPIC_API_KEY not set - using hardcoded fallback");
    return makeFallback();
  }

  const personaBlock = personas
    .map(
      (p) =>
        `ID: ${p.id}
Name: ${p.name}
Motivation: ${p.motivation}
Trigger: ${p.triggerMessage}
Tones: ${p.tones.join(", ")}
Angle: ${p.creativeAngle}`
    )
    .join(`

`);

  const tagLines = [
    `- Color: ${tags.color}`,
    `- Finish: ${tags.finish}`,
    `- Length: ${tags.length}`,
    `- Shape: ${tags.shape}`,
    `- Style mood: ${tags.style_mood}`,
    `- Complexity: ${tags.complexity}`,
    `- Occasion: ${tags.occasion ?? "everyday"}`,
    `- Nail art: ${tags.nail_art_type ?? "plain"}`,
  ].join(`
`);

  const prompt = [
    "You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).",
    "",
    "Product characteristics:",
    tagLines,
    "",
    "For each persona below, write one punchy English headline (4-8 words) PER TONE listed.",
    "Each headline must reflect BOTH the product characteristics AND the specific tone.",
    "Rules: no emojis, no generic phrases, specific to press-on nails.",
    "",
    "Return ONLY raw JSON mapping persona ID -> tone -> headline:",
    "{",
    "  \"per_trend_1\": { \"aspirational\": \"...\" , \"emotional\": \"...\" },",
    "  \"per_busy_1\":  { \"benefit\":      \"...\" , \"urgency\":    \"...\" }",
    "}",
    "",
    "Personas:",
    personaBlock,
  ].join(`
`);

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () =>
        client.messages.create({
          model: MODEL,
          max_tokens: 1600,
          messages: [{ role: "user", content: prompt }],
        }),
      "persona-headlines"
    );

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<string, Record<string, string>>;

    const count = Object.values(parsed).reduce((n, tones) => n + Object.keys(tones).length, 0);
    console.log(`[persona-headlines] Generated ${count} headlines for ${imageId}`);
    return parsed;
  } catch (err) {
    console.error("[persona-headlines] Claude call failed - using hardcoded fallback:", err);
    return makeFallback();
  }
}
