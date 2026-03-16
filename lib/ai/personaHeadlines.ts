import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_HEADLINE = "The nails made for you";

/**
 * Generates two English headlines per tone per persona.
 * No image context — based purely on persona motivation, tone, and creative angle.
 * Called once globally; results cached in global_persona_headlines table.
 * Returns Record<personaId, Record<tone, string[]>> (array of 2 headlines per tone).
 */
export async function generateGlobalPersonaHeadlines(): Promise<
  Record<string, Record<string, string[]>>
> {
  const { getAllPersonas } = await import("@/lib/db");
  const personas = await getAllPersonas();

  const makeFallback = () =>
    Object.fromEntries(
      personas.map((p) => [
        p.id,
        Object.fromEntries(
          p.tones.map((t) => [t, [FALLBACK_HEADLINE, FALLBACK_HEADLINE]])
        ),
      ])
    );

  if (process.env.SKIP_AI === "true") {
    console.log("[global-persona-headlines] SKIP_AI=true - using fallback");
    return makeFallback();
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[global-persona-headlines] ANTHROPIC_API_KEY not set - using fallback");
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

  const prompt = [
    "You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).",
    "",
    "For each persona below, write TWO punchy English headlines (4-8 words) PER TONE listed.",
    "Headlines must reflect the persona's motivation and the specific tone.",
    "Rules: no emojis, no generic phrases, specific to press-on nails. Make the two headlines clearly different from each other.",
    "",
    'Return ONLY raw JSON mapping persona ID -> tone -> [headline1, headline2]:',
    "{",
    '  "per_trend_1": { "aspirational": ["...", "..."], "emotional": ["...", "..."] },',
    '  "per_busy_1":  { "benefit":      ["...", "..."], "urgency":   ["...", "..."] }',
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
          max_tokens: 2400,
          messages: [{ role: "user", content: prompt }],
        }),
      "global-persona-headlines"
    );

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<string, Record<string, string[]>>;

    const count = Object.values(parsed).reduce(
      (n, tones) => n + Object.values(tones).reduce((m, hs) => m + hs.length, 0),
      0
    );
    console.log(`[global-persona-headlines] Generated ${count} headlines for ${personas.length} personas`);
    return parsed;
  } catch (err) {
    console.error("[global-persona-headlines] Claude call failed - using fallback:", err);
    return makeFallback();
  }
}
