import sharp from "sharp";
import { getImage } from "@/lib/db";
import { read as readStorage } from "@/lib/storage";

export async function sampleBrandZoneBrightness(imageId: string, yFraction = 0.78): Promise<number> {
  try {
    const img = await getImage(imageId);
    if (!img) return 255;
    const buf = await readStorage("uploads", img.url);
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1080;
    const ih = meta.height ?? 1920;
    const left   = Math.round(iw * 0.05);
    const top    = Math.round(ih * Math.max(0, Math.min(0.95, yFraction)));
    const width  = Math.round(iw * 0.90);
    const height = Math.round(ih * 0.05);
    const { data } = await sharp(buf)
      .extract({ left, top, width, height })
      .resize(64, 16, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    const channels = data.length / (64 * 16);
    for (let i = 0; i < data.length; i += channels) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (64 * 16);
  } catch {
    return 255;
  }
}
