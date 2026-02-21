import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { removeByUrl } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageIds } = body as { imageIds: string[] };

    if (!imageIds || imageIds.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    const placeholders = imageIds.map(() => "?").join(",");

    // Collect all blob URLs that need to be deleted from storage
    const renderRows = db
      .prepare(`SELECT png_url FROM render_results WHERE image_id IN (${placeholders})`)
      .all(...imageIds) as { png_url: string }[];

    const imageRows = db
      .prepare(`SELECT url FROM images WHERE id IN (${placeholders})`)
      .all(...imageIds) as { url: string }[];

    // Delete storage files concurrently; ignore individual failures
    const urls = [
      ...renderRows.map((r) => r.png_url),
      ...imageRows.map((r) => r.url),
    ];
    await Promise.allSettled(urls.map((url) => removeByUrl(url)));

    // Delete DB records — child tables first (foreign key order)
    db.prepare(`DELETE FROM render_results WHERE image_id IN (${placeholders})`).run(...imageIds);
    db.prepare(`DELETE FROM ad_specs WHERE image_id IN (${placeholders})`).run(...imageIds);
    db.prepare(`DELETE FROM copy_pools WHERE image_id IN (${placeholders})`).run(...imageIds);
    db.prepare(`DELETE FROM safe_zones WHERE image_id IN (${placeholders})`).run(...imageIds);
    db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...imageIds);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Clear error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 }
    );
  }
}
