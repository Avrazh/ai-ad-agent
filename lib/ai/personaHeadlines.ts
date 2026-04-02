import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-sonnet-4-6";
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
    "You are a world-class ad copywriter for SWITCH NAILS (press-on nails brand).",
    "",
    "For each persona below, write TWO English headlines PER TONE listed.",
    "",
    "What makes a great headline here:",
    "- Sounds like a real person wrote it, not a marketing bot",
    "- Speaks directly to what the persona actually feels or wants",
    "- Specific and vivid — avoid vague words like 'perfect', 'amazing', 'beautiful'",
    "- Natural rhythm — read it aloud, it should flow like something you'd actually say",
    "- 4-9 words, no emojis, no exclamation marks",
    "- The two headlines per tone must feel clearly different — different angle, different structure",
    "- Never start a headline with a dash or bullet character",
    "",
    "Bad example: 'Perfect Nails Every Single Time' (generic, could be any brand)",
    "Good example: 'Change your nails like you change your mind' (specific feeling, natural voice)",
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

/**
 * Generates headlines for a single persona (used when a custom persona is created).
 */
export async function generateHeadlinesForPersona(persona: {
  id: string;
  name: string;
  motivation: string;
  triggerMessage: string;
  creativeAngle: string;
  tones: string[];
}): Promise<Record<string, string[]>> {
  const fallback = Object.fromEntries(
    persona.tones.map((t) => [t, [FALLBACK_HEADLINE, FALLBACK_HEADLINE]])
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.SKIP_AI === 'true') return fallback;

  const prompt = [
    'You are a world-class ad copywriter for SWITCH NAILS (press-on nails brand).',
    '',
    'For the persona below, write TWO English headlines PER TONE listed.',
    '',
    'What makes a great headline here:',
    '- Sounds like a real person wrote it, not a marketing bot',
    '- Speaks directly to what the persona actually feels or wants',
    '- Specific and vivid — avoid vague words like "perfect", "amazing", "beautiful"',
    '- Natural rhythm — read it aloud, it should flow like something you\'d actually say',
    '- 4-9 words, no emojis, no exclamation marks',
    '- The two headlines per tone must feel clearly different — different angle, different structure',
    '- Never start a headline with a dash or bullet character',
    '',
    'Return ONLY raw JSON: tone -> [headline1, headline2]',
    '{ "aspirational": ["...", "..."], "benefit": ["...", "..."] }',
    '',
    `Persona name: ${persona.name}`,
    `Description: ${persona.motivation}`,
    `Tones: ${persona.tones.join(', ')}`,
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () => client.messages.create({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      'custom-persona-headlines'
    );
    const raw = response.content.find((b) => b.type === 'text')?.text ?? '';
    const text = raw.replace(/^```(?:json)?[\s]*/i, '').replace(/[\s]*```[\s]*$/i, '').trim();
    return JSON.parse(text) as Record<string, string[]>;
  } catch (err) {
    console.error('[custom-persona-headlines] Claude call failed - using fallback:', err);
    return fallback;
  }
}

/**
 * Generates one customer review quote per persona for testimonial ad layouts.
 * Quote format: "Review text. — Sofia M." (name embedded, no real person)
 * Stored with slot_type = 'quote' in global_persona_headlines.
 */
export async function generateGlobalPersonaQuotes(): Promise<Record<string, string>> {
  const { getAllPersonas } = await import("@/lib/db");
  const personas = await getAllPersonas();
  const FALLBACK_QUOTE = "These nails saved my routine. \u2014 Emma R.";
  const makeFallback = () => Object.fromEntries(personas.map((p) => [p.id, FALLBACK_QUOTE]));

  if (process.env.SKIP_AI === "true") return makeFallback();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return makeFallback();

  const personaBlock = personas
    .map((p) => `ID: ${p.id}\nName: ${p.name}\nMotivation: ${p.motivation}`)
    .join("\n\n");

  const prompt = [
    "You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).",
    "",
    "For each persona, write ONE short customer review quote (10-20 words) in first-person voice.",
    "Append a fictional reviewer name at the end in the format: \u2014 FirstName L.",
    "Rules: no emojis, specific to press-on nails, positive but genuine-sounding.",
    "",
    "Return ONLY raw JSON: persona ID -> full quote string including the name",
    "",
    "Personas:",
    personaBlock,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () => client.messages.create({ model: MODEL, max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
      "global-persona-quotes"
    );
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<string, string>;
    console.log(`[global-persona-quotes] Generated ${Object.keys(parsed).length} quotes for ${personas.length} personas`);
    return parsed;
  } catch (err) {
    console.error("[global-persona-quotes] Claude call failed - using fallback:", err);
    return makeFallback();
  }
}
