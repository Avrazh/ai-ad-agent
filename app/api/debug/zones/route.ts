import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(
    `<!DOCTYPE html><html><body style="background:#111;color:#f3f4f6;font-family:system-ui;padding:32px">
      <h1 style="font-size:20px;font-weight:700">Safe Zones</h1>
      <p style="color:#6b7280">Safe zones have been removed — cropping is now user-controlled.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
