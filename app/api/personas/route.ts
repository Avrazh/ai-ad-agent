import { NextResponse } from "next/server";
import { getAllPersonas } from "@/lib/db";

export async function GET() {
  try {
    const all = await getAllPersonas();
    const personas = all.map(({ id, segmentId, name, tones }) => ({
      id,
      segmentId,
      name,
      tones,
    }));
    return NextResponse.json(personas);
  } catch (err) {
    console.error("[personas]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
