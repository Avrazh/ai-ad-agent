import { NextRequest, NextResponse } from "next/server";
import { getAdSpec } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await getAdSpec(id);
    if (!row) {
      return NextResponse.json({ error: "AdSpec not found" }, { status: 404 });
    }
    const spec = JSON.parse(row.data);
    return NextResponse.json({ spec });
  } catch (err) {
    console.error("GET /api/ad-spec error:", err);
    return NextResponse.json({ error: "Failed to load spec" }, { status: 500 });
  }
}
