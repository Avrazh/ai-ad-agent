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

    // 3. Generate photorealistic background via gpt-image-1
    console.log("[ai-style] Generating background via gpt-image-1...");
    const bgPngBuffer = await generateAIBackground(format as Format, personaContext);

    // 4. Resize background to exact canvas dimensions
    const bgResized = await sharp(bgPngBuffer).resize(w, h, { fit: "cover" }).png().toBuffer();

    // 5. Save clean background (used as aiBgImagePath for canvas re-use)
    const bgId = newId("bg");
    const bgUrl = await save("generated", `${bgId}.png`, bgResized);

    // 6. Composite product image on top of background
    const maxProductW = Math.round(w * 0.82);
    const maxProductH = Math.round(h * 0.82);
    const productResized = await sharp(rawBuffer)
      .resize(maxProductW, maxProductH, { fit: "inside" })
      .png()
      .toBuffer();
    const productMeta = await sharp(productResized).metadata();
    const productW = productMeta.width ?? maxProductW;
    const productH = productMeta.height ?? maxProductH;
    const left = Math.round((w - productW) / 2);
    const top = Math.round((h - productH) / 2);

    const compositedBuffer = await sharp(bgResized)
      .composite([{ input: productResized, left, top }])
      .png()
      .toBuffer();

    const compId = newId("bg");
    const compUrl = await save("generated", `${compId}.png`, compositedBuffer);
    console.log(`[ai-style] Saved composited result: ${compUrl}`);

    // 7. Pick headline

    const FALLBACK_HEADLINE = "The nails made for you";
    const personaHls = personaId ? await getGlobalPersonaHeadlines(personaId, lang) : [];
    const headline = personaHls[0]?.headline ?? FALLBACK_HEADLINE;
    const primarySlotId = personaId ? `${personaId}:${personaHls[0]?.tone ?? "default"}` : "default";

    // 7. Build AdSpec
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

    // 8. Persist
    const resultId = newId("rr");
    await insertAdSpec(adSpecId, imageId, JSON.stringify(adSpec));
    await insertRenderResult({
      id: resultId,
      adSpecId,
      imageId,
      familyId: "ai",
      templateId: "ai_background",
      primarySlotId,
      pngUrl: compUrl,
      aiBgPngUrl: bgUrl,
    });

    // 9. Return result
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
        pngUrl: compUrl,
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
