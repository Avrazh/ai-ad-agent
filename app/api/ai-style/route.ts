import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { newId } from "@/lib/ids";
import { insertAdSpec, insertRenderResult, getImage, getPersona, getGlobalPersonaHeadlines } from "@/lib/db";
import { read as readStorage, save } from "@/lib/storage";
import { generateAIBackground } from "@/lib/ai/aiBackground";
import { FORMAT_DIMS } from "@/lib/types";
import type { Format, Language, AdSpec } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { imageId, lang = "en", format = "9:16", personaId } = await req.json() as {
      imageId: string;
      lang?: Language;
      format?: Format;
      personaId?: string;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    // 1. Load product image
    const imageRow = await getImage(imageId);
    if (!imageRow) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const { w, h } = FORMAT_DIMS[format as Format];
    const rawBuffer = await readStorage("uploads", imageRow.url);
    const mimeType: "image/jpeg" | "image/png" | "image/webp" =
      imageRow.url.match(/\.png$/i) ? "image/png"
      : imageRow.url.match(/\.webp$/i) ? "image/webp"
      : "image/jpeg";

    // Resize product image for the vision step (square crop is fine for nail analysis)
    const resized = await sharp(rawBuffer).resize(1024, 1024, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    const imageBase64 = resized.toString("base64");

    // 2. Load persona context if available
    const personaRow = personaId ? await getPersona(personaId) : undefined;
    const personaContext = personaRow
      ? {
          name: personaRow.name,
          visualWorld: personaRow.visualWorld,
          nailPreference: personaRow.nailPreference,
          motivation: personaRow.motivation,
        }
      : undefined;

    // 3. Generate new photorealistic image via gpt-image-1 (two-step: vision → image gen)
    console.log("[ai-style] Generating realistic image via gpt-image-1...");
    const bgPngBuffer = await generateAIBackground(imageBase64, "image/jpeg", format as Format, personaContext);

    // 4. Resize to exact format dimensions and save
    const bgResized = await sharp(bgPngBuffer).resize(w, h, { fit: "cover" }).png().toBuffer();
    const bgId = newId("bg");
    const bgUrl = await save("generated", `${bgId}.png`, bgResized);
    console.log(`[ai-style] Image saved: ${bgUrl}`);

    // 5. Pick headline from global persona headlines
    const FALLBACK_HEADLINE = "The nails made for you";
    const personaHls = personaId ? await getGlobalPersonaHeadlines(personaId, lang) : [];
    const headline = personaHls[0]?.headline ?? FALLBACK_HEADLINE;
    const primarySlotId = personaId ? `${personaId}:${personaHls[0]?.tone ?? "default"}` : "default";

    // 6. Build AdSpec
    const adSpecId = newId("as");
    const adSpec: AdSpec = {
      id: adSpecId,
      imageId,
      format: format as Format,
      lang: lang as Language,
      familyId: "ai",
      templateId: "ai_background",
      zoneId: "A",
      primarySlotId,
      copy: { headline },
      theme: {
        fontHeadline: "Playfair Display",
        fontSize: 90,
        color: "#ffffff",
        bg: "#000000",
        radius: 0,
        shadow: false,
      },
      renderMeta: { w, h },
      headlineYOverride: 0.65,
      aiBgImagePath: bgUrl,
    };

    // 7. Persist AdSpec + RenderResult
    const resultId = newId("rr");
    await insertAdSpec(adSpecId, imageId, JSON.stringify(adSpec));
    await insertRenderResult({
      id: resultId,
      adSpecId,
      imageId,
      familyId: "ai",
      templateId: "ai_background",
      primarySlotId,
      pngUrl: bgUrl,
      aiBgPngUrl: bgUrl,
    });

    // 8. Return result
    return NextResponse.json({
      ok: true,
      result: {
        id: resultId,
        adSpecId,
        imageId,
        familyId: "ai",
        templateId: "ai_background",
        primarySlotId,
        format,
        lang,
        pngUrl: bgUrl,
        aiBgPngUrl: bgUrl,
        approved: false,
        createdAt: new Date().toISOString(),
        headlineText: headline,
        headlineYOverride: 0.65,
      },
    });
  } catch (err) {
    console.error("[ai-style] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
