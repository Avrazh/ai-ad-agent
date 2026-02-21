import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clearAllStorage } from "@/lib/storage";

export async function POST() {
  try {
    // Wipe all files from both uploads/ and generated/ — works even when DB is
    // empty (cold start) because it lists Blob directly rather than reading URLs
    // from the database.
    await clearAllStorage();

    // Wipe all DB records in foreign-key order
    const db = getDb();
    db.prepare(`DELETE FROM render_results`).run();
    db.prepare(`DELETE FROM ad_specs`).run();
    db.prepare(`DELETE FROM copy_pools`).run();
    db.prepare(`DELETE FROM safe_zones`).run();
    db.prepare(`DELETE FROM images`).run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Clear error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 }
    );
  }
}
