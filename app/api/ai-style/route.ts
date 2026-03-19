import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { newId } from "@/lib/ids";
import { insertAdSpec, insertRenderResult, getImage, getCopySlotsByImage } from "@/lib/db";
import { read as readStorage, save } from "@/lib/storage";
import { generateAIBackground } from "@/lib/ai/aiBackground";
import { renderHtmlToPng } from "@/lib/render/renderAd";
import { FORMAT_DIMS } from "@/lib/types";
import type { Format, Language, AdSpec } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { imageId, lang = "en", format = "9:16" } = await req.json() as {
      imageId: string;
      lang?: Language;
      format?: Format;
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

    // Resize product image to match the target canvas (so Claude composes at the right scale)
    const resized = await sharp(rawBuffer).resize(w, h, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer();
    const imageBase64 = resized.toString("base64");

    // 2. Generate background HTML via Claude Sonnet (no text, no UI)
    console.log("[ai-style] Generating background HTML...");
    let backgroundHtml = await generateAIBackground(imageBase64, "image/jpeg", format as Format);

    // Replace product image placeholder with actual base64 (same pattern as surprise-render)
    backgroundHtml = backgroundHtml.replace(
      /__PRODUCT_IMAGE__/g,
      `data:image/jpeg;base64,${imageBase64}`,
    );

    // 3. Render background HTML to PNG via Puppeteer
    console.log("[ai-style] Rendering background PNG...");
    const bgPngBuffer = await renderHtmlToPng(backgroundHtml, w, h);

    // 4. Save background PNG to storage
    const bgId = newId("bg");
    const bgUrl = await save("generated", `${bgId}.png`, bgPngBuffer);
    console.log(`[ai-style] Background saved: ${bgUrl}`);

    // 5. Pick headline from copy slots (aspirational → any headline → fallback)
    const copySlots = await getCopySlotsByImage(imageId);
    let headline = "";
    let primarySlotId = "default";
    const headlineSlot =
      copySlots.find((s) => s.language === lang && s.slotType === "headline" && s.tone === "aspirational")
      ?? copySlots.find((s) => s.language === lang && s.slotType === "headline")
      ?? copySlots.find((s) => s.slotType === "headline");
    if (headlineSlot) {
      headline = headlineSlot.text;
      primarySlotId = headlineSlot.id;
    }

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

    // 7. Persist AdSpec + RenderResult — background PNG is the initial pngUrl.
    // No second Puppeteer render needed: LiveAdCanvas overlays the headline client-side.
    // The headline is baked in only on Approve via /api/reposition.
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
