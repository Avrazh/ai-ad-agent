import { NextRequest, NextResponse } from "next/server";
import { read } from "@/lib/storage";
import path from "path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  if (segments.length < 2) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const bucket = segments[0] as "uploads" | "generated";
  if (bucket !== "uploads" && bucket !== "generated") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const filename = segments.slice(1).join("/");

  try {
    const buffer = await read(bucket, filename);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
