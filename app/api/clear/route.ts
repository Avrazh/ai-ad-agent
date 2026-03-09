import { NextResponse } from "next/server";
import { clearAll } from "@/lib/db";
import { clearAllStorage } from "@/lib/storage";

export async function POST() {
  try {
    // Wipe all files from both uploads/ and generated/ — works even when DB is
    // empty (cold start) because it lists Blob directly rather than reading URLs
    // from the database.
    await clearAllStorage();

    // Wipe all DB records in foreign-key order
    await clearAll();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Clear error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Clear failed" },
      { status: 500 }
    );
  }
}
