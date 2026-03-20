import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";

export type TranslateItem = {
  index: number;
  headline: string;
  subtext: string;
};

export type TranslateResult = {
  index: number;
  headline: string;
  subtext: string;
};

/**
 * Translates an array of (headline, subtext) pairs into targetLang.
 * Cultural adaptation -- NOT word-for-word.
 * Single Claude Haiku call regardless of item count.
 * Falls back to original text on failure.
 */
export async function translateCopy(
  items: TranslateItem[],
  targetLangCode: string,
  targetLangName: string
): Promise<TranslateResult[]> {
  const fallback = items.map((i) => ({ index: i.index, headline: i.headline, subtext: i.subtext }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.SKIP_AI === "true") return fallback;

  const itemsJson = JSON.stringify(
    items.map((i) => ({ index: i.index, headline: i.headline, subtext: i.subtext }))
  );

  const prompt = [
    `You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).`,
    `Translate the following ad copy into ${targetLangName} (language code: ${targetLangCode}).`,
    ``,
    `Rules:`,
    `- Cultural adaptation, NOT word-for-word translation`,
    `- Keep the same emotional tone and punch as the original`,
    `- Keep similar length -- translated text should fit the same visual space`,
    `- No emojis`,
    `- If subtext is empty string "", keep it as ""`,
    ``,
    `Return ONLY raw JSON array, same structure as input, with translated headline and subtext:`,
    `[{"index":0,"headline":"...","subtext":"..."},{"index":1,"headline":"...","subtext":"..."}]`,
    ``,
    `Items to translate:`,
    itemsJson,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () =>
        client.messages.create({
          model: MODEL,
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      `translate-${targetLangCode}`
    );
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
    const parsed = JSON.parse(text) as TranslateResult[];
    console.log(`[translate] ${parsed.length} items -> ${targetLangName}`);
    return parsed;
  } catch (err) {
    console.error(`[translate] Failed for ${targetLangCode} -- using originals:`, err);
    return fallback;
  }
}
