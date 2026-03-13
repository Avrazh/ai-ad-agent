import { NextResponse } from "next/server";
import { seedSegmentsAndPersonas } from "@/lib/db";

export async function POST() {
  const result = await seedSegmentsAndPersonas();
  return NextResponse.json({ ok: true, ...result });
}
