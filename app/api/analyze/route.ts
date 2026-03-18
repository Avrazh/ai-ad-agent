import { NextRequest, NextResponse } from "next/server";
import {
  getImage,
  insertImage,
  hasGlobalPersonaHeadlines,
  hasGlobalPersonaQuotes,
  upsertGlobalPersonaHeadlines,
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

    // Ensure image exists in DB
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
    }

    // Fire-and-forget: warm up Puppeteer browser so first render is faster
    import("@/lib/render/renderAd").then(({ warmBrowser }) => warmBrowser()).catch(() => {});

    // Fire-and-forget: generate global persona headlines if not yet done
    hasGlobalPersonaHeadlines().then(async (has) => {
      if (!has) {
        try {
          const { generateGlobalPersonaHeadlines } = await import("@/lib/ai/personaHeadlines");
          const generated = await generateGlobalPersonaHeadlines();
          const rows: { personaId: string; tone: string; headline: string; language: string }[] = [];
          for (const [pid, tones] of Object.entries(generated)) {
            for (const [tone, headlines] of Object.entries(tones)) {
              for (const headline of headlines) {
                rows.push({ personaId: pid, tone, headline, language: "en" });
              }
            }
          }
          await upsertGlobalPersonaHeadlines(rows);
          console.log("[analyze] Global persona headlines generated and stored");
        } catch (err) {
          console.warn("[analyze] Failed to generate global persona headlines:", err);
        }
      }
    }).catch(() => {});

    // Fire-and-forget: generate global persona quotes if not yet done
    hasGlobalPersonaQuotes().then(async (has) => {
      if (!has) {
        try {
          const { generateGlobalPersonaQuotes } = await import("@/lib/ai/personaHeadlines");
          const generated = await generateGlobalPersonaQuotes();
          const rows = Object.entries(generated).map(([pid, quote]) => ({
            personaId: pid, tone: "quote", headline: quote, language: "en", slotType: "quote",
          }));
          if (rows.length) await upsertGlobalPersonaHeadlines(rows);
          console.log("[analyze] Global persona quotes generated and stored");
        } catch (err) {
          console.warn("[analyze] Failed to generate global persona quotes:", err);
        }
      }
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
