import { NextRequest, NextResponse } from "next/server";
import {
  hasPersonaHeadlines,
  getPersonaHeadlines,
  upsertPersonaHeadlines,
} from "@/lib/db";
import { generatePersonaHeadlines } from "@/lib/ai/personaHeadlines";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "imageId required" }, { status: 400 });
  }

  try {
    if (await hasPersonaHeadlines(imageId, "en")) {
      const headlines = await getPersonaHeadlines(imageId, "en");
      return NextResponse.json(headlines);
    }

    // Not cached (image pre-dates this feature) - generate on demand
    const generated = await generatePersonaHeadlines(imageId);
    const rows: { imageId: string; personaId: string; tone: string; headline: string; language: string }[] = [];
    for (const [personaId, toneMap] of Object.entries(generated)) {
      for (const [tone, headline] of Object.entries(toneMap)) {
        rows.push({ imageId, personaId, tone, headline, language: "en" });
      }
    }
    await upsertPersonaHeadlines(rows);
    return NextResponse.json(generated);
  } catch (err) {
    console.error("[persona-headlines GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
