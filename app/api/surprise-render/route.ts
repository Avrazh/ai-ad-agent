import { NextRequest, NextResponse } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { generateSurpriseSVG } from "@/lib/ai/surpriseRender";
import { read, save } from "@/lib/storage";
import { newId } from "@/lib/ids";
import { insertAdSpec, insertRenderResult } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { imageId, imageUrl, lang = "en", referenceImageBase64, referenceImageMimeType, userPrompt } = await req.json();

    if (!imageId || !imageUrl) {
      return NextResponse.json(
        { error: "imageId and imageUrl required" },
        { status: 400 }
      );
    }

    // 1. Claude generates SVG (optionally inspired by reference image)
    let svg = await generateSurpriseSVG(imageUrl, lang, referenceImageBase64, referenceImageMimeType, userPrompt);

    // 2. Load product image and replace placeholder with real base64
    const imageBuffer = await read("uploads", imageUrl);
    const imageBase64 = imageBuffer.toString("base64");
    const mimeType = imageUrl.match(/\.png$/i)
      ? "image/png"
      : imageUrl.match(/\.webp$/i)
      ? "image/webp"
      : "image/jpeg";

    svg = svg.replace(
      /__PRODUCT_IMAGE__/g,
      `data:${mimeType};base64,${imageBase64}`
    );

    // 3. SVG → PNG via resvg
    // Must supply our bundled fonts — Vercel Linux has zero system fonts installed,
    // so without this all text renders invisible.
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1080 },
      font: {
        fontDirs: [path.join(process.cwd(), "fonts")],
        defaultFontFamily: "Inter",
        sansSerifFamily: "Inter",
        serifFamily: "Playfair Display",
        loadSystemFonts: false,
      },
    });
    const pngBuffer = Buffer.from(resvg.render().asPng());

    // 4. Save PNG to storage
    const resultId = newId("sr");
    const pngUrl = await save("generated", `${resultId}.png`, pngBuffer);

    // 5. Insert minimal ad_spec row first (required by FK constraint), then render result
    await insertAdSpec(resultId, imageId, JSON.stringify({ templateId: "ai_surprise_svg", lang, format: "9:16" }));
    await insertRenderResult({
      id: resultId,
      adSpecId: resultId,
      imageId,
      familyId: "ai",
      templateId: "ai_surprise_svg",
      primarySlotId: "",
      pngUrl,
    });

    // 6. Return same shape as /api/generate results
    return NextResponse.json({
      results: [
        {
          id: resultId,
          adSpecId: resultId,
          imageId,
          familyId: "ai",
          templateId: "ai_surprise_svg",
          primarySlotId: "",
          format: "9:16",
          pngUrl,
          approved: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("surprise-render error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
