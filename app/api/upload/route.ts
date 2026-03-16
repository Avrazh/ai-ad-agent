import { NextRequest, NextResponse } from "next/server";
import { save, removeBlobUrl } from "@/lib/storage";
import { insertImage, getAllImages, hasGlobalPersonaHeadlines, upsertGlobalPersonaHeadlines } from "@/lib/db";
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

    // Delete the old upload blob if the client explicitly passes it
    if (previousImageUrl) await removeBlobUrl(previousImageUrl);

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || ".png";
    const id = newId("img");
    const filename = `${id}${ext}`;

    const url = await save("uploads", filename, buffer);

    // Read image dimensions from the buffer
    const { width, height } = readDimensions(buffer, file.type);

    await insertImage({ id, filename, url, width, height });

    // Fire-and-forget: warm up Puppeteer so first render is fast
    import("@/lib/render/renderAd").then(({ warmBrowser }) => warmBrowser()).catch(() => {});

    // Fire-and-forget: generate global persona headlines once (first cold start only)
    hasGlobalPersonaHeadlines().then(async (has) => {
      if (!has) {
        try {
          const { generateGlobalPersonaHeadlines } = await import("@/lib/ai/personaHeadlines");
          const generated = await generateGlobalPersonaHeadlines();
          const rows: { personaId: string; tone: string; headline: string; language: string }[] = [];
          for (const [pid, tones] of Object.entries(generated)) {
            for (const [tone, headlines] of Object.entries(tones)) {
              for (const headline of headlines) {
                rows.push({ personaId: pid, tone, headline, language: "en" });
              }
            }
          }
          await upsertGlobalPersonaHeadlines(rows);
        } catch (err) {
          console.warn("[upload] Failed to generate global persona headlines:", err);
        }
      }
    }).catch(() => {});

    return NextResponse.json({ imageId: id, url, width, height });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  const images = await getAllImages();
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
