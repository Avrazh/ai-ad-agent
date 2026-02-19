import { NextRequest, NextResponse } from "next/server";
import { save, removeGenerated, removeBlobUrl } from "@/lib/storage";
import { insertImage, getAllImages } from "@/lib/db";
import { newId } from "@/lib/ids";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, and WebP images are allowed" },
        { status: 400 }
      );
    }

    const previousImageUrl = formData.get("previousImageUrl") as string | null;

    // Clean up old session blobs before saving the new image
    await removeGenerated();
    if (previousImageUrl) await removeBlobUrl(previousImageUrl);

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".png";
    const id = newId("img");
    const filename = `${id}${ext}`;

    const url = await save("uploads", filename, buffer);

    // Read image dimensions from the buffer
    const { width, height } = readDimensions(buffer, file.type);

    insertImage({ id, filename, url, width, height });

    return NextResponse.json({ imageId: id, url, width, height });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  const images = getAllImages();
  return NextResponse.json({ images });
}

// Simple dimension reader — supports PNG and JPEG headers without extra deps
function readDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } {
  try {
    if (mimeType === "image/png") {
      // PNG: width at byte 16, height at byte 20 (big-endian 32-bit)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mimeType === "image/jpeg") {
      // JPEG: scan for SOF0/SOF2 markers
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0 (0xC0) or SOF2 (0xC2) contain dimensions
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch {
    // fallback below
  }

  // Fallback: reasonable default for 4:5
  return { width: 1080, height: 1350 };
}
