import { NextRequest, NextResponse } from "next/server";
import { getSavedAIStyles, insertSavedAIStyle, deleteSavedAIStyle } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET() {
  try {
    const styles = await getSavedAIStyles();
    return NextResponse.json({ styles });
  } catch (err) {
    console.error("GET /api/ai-styles error:", err);
    return NextResponse.json({ error: "Failed to load saved styles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, templateId, applicability, estimatedCostUsd, surpriseSpec } = body as {
      name: string;
      templateId: string;
      applicability?: string;
      estimatedCostUsd?: number;
      surpriseSpec?: object; // SurpriseSpec without en/de copy
    };

    if (!name || !templateId) {
      return NextResponse.json({ error: "name and templateId required" }, { status: 400 });
    }

    const id = newId("sas");
    await insertSavedAIStyle({
      id, name, templateId, applicability, estimatedCostUsd,
      surpriseSpec: surpriseSpec ? JSON.stringify(surpriseSpec) : undefined,
    });
    const styles = await getSavedAIStyles();
    const style = styles.find((s) => s.id === id);
    return NextResponse.json({ style });
  } catch (err) {
    console.error("POST /api/ai-styles error:", err);
    return NextResponse.json({ error: "Failed to save style" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await deleteSavedAIStyle(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/ai-styles error:", err);
    return NextResponse.json({ error: "Failed to delete style" }, { status: 500 });
  }
}
