import { NextResponse } from "next/server";
import { getAllImages, getSafeZones } from "@/lib/db";

export async function GET() {
  const images = await getAllImages();

  const cards: string[] = [];

  for (const img of images) {
    const raw = await getSafeZones(img.id);
    const zones = raw ? (JSON.parse(raw) as {
      avoidRegions: { x: number; y: number; w: number; h: number }[];
      zones: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
    }) : null;

    const ZONE_COLORS: Record<string, string> = { A: "#22c55e", B: "#3b82f6", C: "#f59e0b" };

    const TARGET_AR = 9 / 16;
    const imageAr = img.width > 0 && img.height > 0 ? img.width / img.height : TARGET_AR;
    let cropX = 0, cropY = 0, cropW = 1, cropH = 1;
    if (imageAr > TARGET_AR) {
      cropW = TARGET_AR / imageAr;
      // Mirror renderAd: use avoidRegion cx with CX_BIAS for horizontal alignment
      const CX_BIAS = -0.10;
      const region = zones?.avoidRegions[0];
      const cx = region ? Math.max(0, Math.min(1, region.x + region.w / 2 + CX_BIAS)) : 0.5;
      cropX = Math.max(0, Math.min(cx - cropW / 2, 1 - cropW));
    } else if (imageAr < TARGET_AR) {
      cropH = imageAr / TARGET_AR;
      cropY = (1 - cropH) / 2;
    }
    const cropSvg = `<rect x="${cropX.toFixed(4)}" y="${cropY.toFixed(4)}" width="${cropW.toFixed(4)}" height="${cropH.toFixed(4)}"
  fill="none" stroke="#ffffff" stroke-width="0.006" stroke-dasharray="0.03,0.015" opacity="0.9"/>
<text x="${(cropX + cropW / 2).toFixed(4)}" y="${(cropY + 0.04).toFixed(4)}"
  dominant-baseline="middle" text-anchor="middle"
  font-family="monospace" font-size="0.04" font-weight="bold"
  fill="#ffffff" stroke="#000" stroke-width="0.008" paint-order="stroke">9:16</text>`;

    const svgRects = [
      ...(zones ? [
        ...zones.avoidRegions.map(
          (r) =>
            `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
              fill="rgba(239,68,68,0.15)" stroke="#ef4444" stroke-width="0.004" stroke-dasharray="0.02,0.01"/>`
        ),
        ...zones.zones.map((z) => {
          const c = ZONE_COLORS[z.id] ?? "#ffffff";
          const r = z.rect;
          return `
            <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
              fill="${c}26" stroke="${c}" stroke-width="0.004"/>
            <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}"
              dominant-baseline="middle" text-anchor="middle"
              font-family="monospace" font-size="0.06" font-weight="bold"
              fill="${c}" stroke="#000" stroke-width="0.01" paint-order="stroke">${z.id}</text>`;
        }),
      ] : []),
      cropSvg,
    ].join("\n");

    const noZones = !zones
      ? `<p style="color:#f87171;margin:8px 0 0">No zones cached yet — upload and generate first</p>`
      : "";

    const avoidSummary = zones
      ? `<p style="margin:6px 0 2px;font-size:12px;color:#f87171">
           🔴 avoidRegion${zones.avoidRegions.length > 1 ? "s" : ""}:
           ${zones.avoidRegions.map(r => `(${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.w.toFixed(2)}×${r.h.toFixed(2)})`).join("  ")}
         </p>
         <p style="margin:2px 0;font-size:12px;color:#86efac">
           🟢 zones: ${zones.zones.map(z => `${z.id}=(${z.rect.x.toFixed(2)},${z.rect.y.toFixed(2)},${z.rect.w.toFixed(2)}×${z.rect.h.toFixed(2)})`).join("  ")}
         </p>`
      : "";

    cards.push(`
      <div style="background:#1c1c1e;border-radius:12px;padding:16px;margin-bottom:32px;">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">${img.id}</p>
        <p style="color:#f3f4f6;font-weight:600;margin:0 0 12px">${img.filename}
          <span style="color:#6b7280;font-weight:400;font-size:12px;margin-left:8px">${img.width}×${img.height}</span>
        </p>
        <div style="position:relative;display:inline-block;max-width:100%;">
          <img src="${img.url}" style="display:block;max-width:560px;max-height:560px;border-radius:6px;" />
          <svg viewBox="0 0 1 1" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;">
            ${svgRects}
          </svg>
        </div>
        ${avoidSummary}
        ${noZones}
        <div style="margin-top:10px;display:flex;gap:16px;font-size:12px;">
          <span style="color:#ef4444">■ avoid region (red dashed)</span>
          <span style="color:#22c55e">■ zone A (green)</span>
          <span style="color:#3b82f6">■ zone B (blue)</span>
          <span style="color:#f59e0b">■ zone C (amber)</span>
          <span style="color:#ffffff">■ 9:16 crop (white dashed)</span>
        </div>
      </div>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Safe Zones Debug</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #111; color: #f3f4f6; font-family: system-ui, sans-serif; padding: 32px; margin: 0; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
    p.sub { color: #6b7280; font-size: 13px; margin: 0 0 32px; }
  </style>
</head>
<body>
  <h1>Safe Zones Debug</h1>
  <p class="sub">${images.length} image${images.length !== 1 ? "s" : ""} — refresh after uploading a new image</p>
  ${cards.length ? cards.join("") : '<p style="color:#6b7280">No images yet. Upload one first.</p>'}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
