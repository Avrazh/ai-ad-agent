import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { Readable } from "stream";

const STORAGE_ROOT = process.env.NODE_ENV === "production"
  ? "/tmp"
  : path.join(process.cwd(), "storage");

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

  const bucket = segments[0];
  if (bucket !== "uploads" && bucket !== "generated") {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  // Use basename to prevent path traversal
  const filename = path.basename(segments.slice(1).join("/"));
  const filePath = path.join(STORAGE_ROOT, bucket, filename);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  try {
    // Check file exists before streaming (createReadStream errors are async and not caught by try/catch)
    await fsPromises.access(filePath);
    const stream = fs.createReadStream(filePath);
    const readable = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(readable, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
