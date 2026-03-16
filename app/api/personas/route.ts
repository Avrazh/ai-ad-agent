import { NextRequest, NextResponse } from "next/server";
import { getAllPersonas, insertCustomPersona, upsertGlobalPersonaHeadlines } from "@/lib/db";
import { generateHeadlinesForPersona } from "@/lib/ai/personaHeadlines";

// GET /api/personas — return all personas (used by UI on load)
export async function GET() {
  try {
    const personas = await getAllPersonas();
    return NextResponse.json(personas);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

// POST /api/personas — create a custom persona + generate its headlines
export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json() as { name: string; description: string };
    if (!name?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "name and description required" }, { status: 400 });
    }

    // Insert into DB
    const personaId = await insertCustomPersona(name.trim(), description.trim());

    // Generate headlines via Claude Haiku
    const tones = ["aspirational", "benefit", "emotional"];
    const headlines = await generateHeadlinesForPersona({
      id: personaId,
      name: name.trim(),
      motivation: description.trim(),
      triggerMessage: description.trim(),
      creativeAngle: description.trim(),
      tones,
    });

    // Store in global_persona_headlines
    const rows: { personaId: string; tone: string; headline: string; language: string }[] = [];
    for (const [tone, hls] of Object.entries(headlines)) {
      for (const headline of hls) {
        rows.push({ personaId, tone, headline, language: "en" });
      }
    }
    if (rows.length) await upsertGlobalPersonaHeadlines(rows);

    // Return the new persona in the same shape as getAllPersonas
    return NextResponse.json({
      id: personaId,
      segmentId: "seg_custom",
      name: name.trim(),
      age: "all ages",
      motivation: description.trim(),
      painPoint: "",
      objection: "",
      nailPreference: "",
      triggerMessage: description.trim(),
      creativeAngle: description.trim(),
      visualWorld: "",
      adFormats: "",
      whatNotToShow: "",
      tones,
      isCustom: true,
    });
  } catch (err) {
    console.error("[POST /api/personas]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
