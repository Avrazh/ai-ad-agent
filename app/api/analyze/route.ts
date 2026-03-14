import { NextRequest, NextResponse } from "next/server";
import { analyzeSafeZones } from "@/lib/ai/analyze";
import { generateCopyPool } from "@/lib/ai/copy";
import { extractImageTags } from "@/lib/ai/tags";
import { generatePersonaHeadlines } from "@/lib/ai/personaHeadlines";
import {
  getImage,
  insertImage,
  getSafeZones,
  upsertSafeZones,
  getCopyPool,
  upsertCopyPool,
  upsertImageTags,
  hasPersonaHeadlines,
  upsertPersonaHeadlines,
} from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageId, imageUrl, imageWidth, imageHeight } = body as {
      imageId: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    // Ensure image exists in DB (re-seed on cold start)
    let image = await getImage(imageId);
    if (!image) {
      if (!imageUrl) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      await insertImage({
        id: imageId,
        filename: imageId + ".png",
        url: imageUrl,
        width: imageWidth ?? 0,
        height: imageHeight ?? 0,
      });
      image = await getImage(imageId)!;
    }

    // Safe zones — cached per imageId
    const cachedZones = await getSafeZones(imageId);
    if (!cachedZones) {
      const safeZones = await analyzeSafeZones(imageId);
      await upsertSafeZones(imageId, JSON.stringify(safeZones));
    }

    // Copy pool — cached per imageId
    const cachedCopy = await getCopyPool(imageId);
    if (!cachedCopy) {
      const copyPool = await generateCopyPool(imageId);
      await upsertCopyPool(imageId, JSON.stringify(copyPool));
    }

    // Image tags — cached in images.tags column, extracted once per image
    const freshImage = await getImage(imageId);
    if (!freshImage?.tags) {
      const tags = await extractImageTags(imageId);
      await upsertImageTags(imageId, tags);
    }

    // Persona headlines — one Haiku text call per image, cached forever
    if (!(await hasPersonaHeadlines(imageId, "en"))) {
      const generated = await generatePersonaHeadlines(imageId);
      const rows = Object.entries(generated).map(([personaId, headline]) => ({
        imageId,
        personaId,
        headline,
        language: "en",
      }));
      await upsertPersonaHeadlines(rows);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
