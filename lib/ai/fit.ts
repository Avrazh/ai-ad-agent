import Anthropic from "@anthropic-ai/sdk";
import { read as readStorage } from "@/lib/storage";
import { withRetry } from "./retry";
import path from "path";

export type FitResult = Record<string, "good" | "poor">;
const MODEL = "claude-haiku-4-5-20251001";

export async function checkPersonaFit(imageId: string): Promise<FitResult> {
  const { getImage, getAllPersonas } = await import("@/lib/db");
  const [img, personas] = await Promise.all([getImage(imageId), getAllPersonas()]);
  if (!img) throw new Error(`Image "${imageId}" not found`);

  const allGood: FitResult = Object.fromEntries(personas.map((p) => [p.id, "good" as const]));

  if (process.env.SKIP_AI === "true") return allGood;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return allGood;

  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  const personaList = personas
    .map((p) => `${p.id}: ${p.name} — motivated by: ${p.motivation}. Avoid showing: ${p.whatNotToShow}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 } },
            { type: "text", text: `This is a SWITCH NAILS press-on nails product image. Rate each persona as "good" or "poor" fit for this image based on nail style, aesthetic, and visual tone.\n\nRate "poor" only if the image directly conflicts with what the persona avoids — e.g. luxury editorial for a budget persona, maximalist nails for a minimalist persona.\nRate "good" if neutral or relevant.\n\nPersonas:\n${personaList}\n\nReturn ONLY raw JSON mapping persona id to "good" or "poor":\n{"per_trend_1":"good","per_busy_1":"poor"}` },
          ],
        }],
      }),
      "fit"
    );
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return { ...allGood, ...JSON.parse(text) };
  } catch (err) {
    console.error("[fit] Failed — defaulting all to good:", err);
    return allGood;
  }
}
