import satori, { type FontWeight, type FontStyle } from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFile } from "fs/promises";
import path from "path";
import type { AdSpec, SafeZones } from "@/lib/types";
import { toPixels } from "@/lib/types";
import { getTemplate } from "@/lib/templates";
import { read as readStorage, save } from "@/lib/storage";
import { newId } from "@/lib/ids";

type FontEntry = { name: string; data: Buffer; weight: FontWeight; style: FontStyle };

// Cache fonts in memory after first load
let fontsLoaded: FontEntry[] | null = null;

async function loadFonts() {
  if (fontsLoaded) return fontsLoaded;

  const fontsDir = path.join(process.cwd(), "fonts");

  const [interRegular, interBold, bebas, playfairRegular, playfairBold] = await Promise.all([
    readFile(path.join(fontsDir, "Inter-Regular.ttf")),
    readFile(path.join(fontsDir, "Inter-Bold.ttf")),
    readFile(path.join(fontsDir, "BebasNeue-Regular.ttf")),
    readFile(path.join(fontsDir, "PlayfairDisplay-Regular.woff")),
    readFile(path.join(fontsDir, "PlayfairDisplay-Bold.woff")),
  ]);

  fontsLoaded = [
    { name: "Inter", data: interRegular, weight: 400 as FontWeight, style: "normal" as FontStyle },
    { name: "Inter", data: interBold, weight: 700 as FontWeight, style: "normal" as FontStyle },
    { name: "Bebas Neue", data: bebas, weight: 400 as FontWeight, style: "normal" as FontStyle },
    { name: "Playfair Display", data: playfairRegular, weight: 400 as FontWeight, style: "normal" as FontStyle },
    { name: "Playfair Display", data: playfairBold, weight: 700 as FontWeight, style: "normal" as FontStyle },
  ];

  return fontsLoaded;
}

export async function renderAd(
  spec: AdSpec,
  safeZones: SafeZones
): Promise<{ pngUrl: string; renderResultId: string }> {
  const template = getTemplate(spec.templateId);

  // Find the zone used by this spec
  const zone = safeZones.zones.find((z) => z.id === spec.zoneId);
  if (!zone) throw new Error(`Zone "${spec.zoneId}" not found in SafeZones`);

  // Convert normalized zone to pixel coords
  const zonePx = toPixels(zone.rect, spec.renderMeta.w, spec.renderMeta.h);

  // Load the source image as base64
  const imageFilename = await getImageFilename(spec.imageId);
  const imageBuffer = await readStorage("uploads", imageFilename);
  const ext = path.extname(imageFilename).replace(".", "");
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const imageBase64 = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`;

  // Build the template JSX
  const element = template.build(spec, imageBase64, zonePx);

  // Satori: JSX → SVG
  const fonts = await loadFonts();
  const svg = await satori(element, {
    width: spec.renderMeta.w,
    height: spec.renderMeta.h,
    fonts,
  });

  // resvg: SVG → PNG
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: spec.renderMeta.w },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Save the PNG
  const renderResultId = newId("rr");
  const pngFilename = `${renderResultId}.png`;
  const pngUrl = await save("generated", pngFilename, Buffer.from(pngBuffer));

  return { pngUrl, renderResultId };
}

// Helper to find the stored filename for an image ID
async function getImageFilename(imageId: string): Promise<string> {
  // Import db here to avoid circular deps
  const { getImage } = await import("@/lib/db");
  const img = getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  return img.filename;
}
