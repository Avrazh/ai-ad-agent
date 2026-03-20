import { NextRequest, NextResponse } from "next/server";
import { getAllPersonas, getGlobalPersonaHeadlines, clearGlobalPersonaHeadlines } from "@/lib/db";

export async function DELETE() {
  try {
    await clearGlobalPersonaHeadlines();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  void req;
  try {
    const personas = await getAllPersonas();
    const result: Record<string, Record<string, string>> = {};
    for (const persona of personas) {
      const hls = await getGlobalPersonaHeadlines(persona.id, "en");
      if (hls.length) {
        // Pick first headline per tone for the UI display map
        const toneMap: Record<string, string> = {};
        for (const { tone, headline } of hls) {
          if (!toneMap[tone]) toneMap[tone] = headline;
        }
        result[persona.id] = toneMap;
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[persona-headlines GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
