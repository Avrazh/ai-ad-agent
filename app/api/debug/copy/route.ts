import { NextResponse } from "next/server";
import { getAllImages, getCopyPool, getPersonaHeadlines, getAllPersonas } from "@/lib/db";
import type { CopyPool, CopySlot } from "@/lib/types";

const ANGLE_COLOR: Record<string, string> = {
  benefit:      "#22c55e",
  curiosity:    "#3b82f6",
  urgency:      "#f59e0b",
  emotional:    "#ec4899",
  aspirational: "#a78bfa",
  story:        "#06b6d4",
  contrast:     "#f97316",
};

const SLOT_BG: Record<string, string> = {
  headline: "#1e293b",
  quote:    "#1a2530",
  subtext:  "#1c1c1e",
};

function slotRow(s: CopySlot) {
  const angle = s.angle ? `<span style="color:${ANGLE_COLOR[s.angle] ?? "#9ca3af"};font-size:11px;margin-left:6px">${s.angle}</span>` : "";
  const attr  = s.attribution ? `<div style="color:#6b7280;font-size:11px;margin-top:2px">${s.attribution}</div>` : "";
  return `
    <tr style="background:${SLOT_BG[s.slotType] ?? "#111"}">
      <td style="padding:6px 10px;color:#6b7280;font-size:11px;white-space:nowrap">${s.id}</td>
      <td style="padding:6px 10px;white-space:nowrap">
        <span style="font-size:11px;background:#334155;border-radius:4px;padding:1px 6px;color:#94a3b8">${s.slotType}</span>
        ${angle}
      </td>
      <td style="padding:6px 10px;font-size:13px;color:#f1f5f9">${s.text}${attr}</td>
    </tr>`;
}

export async function GET() {
  const images = await getAllImages();
  const cards: string[] = [];

  const allPersonas = await getAllPersonas();
  for (const img of images) {
    const raw = await getCopyPool(img.id);
    if (!raw) {
      cards.push(`
        <div style="background:#1c1c1e;border-radius:12px;padding:16px;margin-bottom:32px;">
          <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">${img.id}</p>
          <p style="color:#f3f4f6;font-weight:600;margin:0">${img.filename}</p>
          <p style="color:#f87171;font-size:12px;margin:8px 0 0">No copy pool yet — analyze image first</p>
        </div>`);
      continue;
    }

    const pool: CopyPool = JSON.parse(raw);
    const langs = [...new Set(pool.slots.map(s => s.lang))];

    const langSections = langs.map(lang => {
      const slots = pool.slots.filter(s => s.lang === lang);
      const rows = slots.map(slotRow).join("");
      return `
        <div style="margin-top:16px">
          <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px">${lang.toUpperCase()} — ${slots.length} slots</p>
          <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#0f172a">
                <th style="padding:6px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">ID</th>
                <th style="padding:6px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Type / Angle</th>
                <th style="padding:6px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Text</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

    cards.push(`
      <div style="background:#1c1c1e;border-radius:12px;padding:16px;margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
          <img src="${img.url}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #333" />
          <div>
            <p style="color:#9ca3af;font-size:11px;margin:0">${img.id}</p>
            <p style="color:#f3f4f6;font-weight:600;margin:0">${img.filename}
              <span style="color:#6b7280;font-weight:400;font-size:12px;margin-left:8px">${pool.slots.length} slots total</span>
            </p>
          </div>
        </div>
        ${langSections}
      </div>`);
  }

  // Build single persona headlines table across all images
  const imagesWithHeadlines = await Promise.all(
    images.map(async (img) => ({
      img,
      ph: await getPersonaHeadlines(img.id, "en"),
    }))
  );
  const anyHeadlines = imagesWithHeadlines.some(({ ph }) => Object.keys(ph).length > 0);

  const imgHeaders = imagesWithHeadlines.map(({ img }) =>
    `<th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500;min-width:160px">
      <div style="display:flex;align-items:center;gap:6px">
        <img src="${img.url}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #333" />
        <span style="color:#6b7280;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${img.filename}</span>
      </div>
    </th>`
  ).join("");

  const phRows = allPersonas.flatMap((p) =>
    p.tones.map((tone, i) => {
      const cells = imagesWithHeadlines.map(({ ph }) => {
        const h = ph[p.id]?.[tone];
        return `<td style="padding:5px 10px;color:${h ? "#f1f5f9" : "#4b5563"};font-size:13px">${h ?? "<em>—</em>"}</td>`;
      }).join("");
      return `<tr style="background:#111827">
        ${i === 0
          ? `<td style="padding:5px 10px;color:#6b7280;font-size:11px;white-space:nowrap;vertical-align:top" rowspan="${p.tones.length}">${p.id}</td>
             <td style="padding:5px 10px;color:#94a3b8;font-size:11px;white-space:nowrap;vertical-align:top" rowspan="${p.tones.length}">${p.name}</td>`
          : ""}
        <td style="padding:5px 10px;font-size:11px;white-space:nowrap">
          <span style="color:#6366f1;background:#1e1b4b;border-radius:4px;padding:1px 6px">${tone}</span>
        </td>
        ${cells}
      </tr>`;
    })
  ).join("");

  const personaTable = anyHeadlines ? `
    <div style="margin-top:48px">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 4px">Persona Headlines</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px">${allPersonas.length} personas × 2 tones — one column per image</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#0f172a">
              <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Persona ID</th>
              <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Name</th>
              <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Tone</th>
              ${imgHeaders}
            </tr>
          </thead>
          <tbody>${phRows}</tbody>
        </table>
      </div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Copy Pool Debug</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #111; color: #f3f4f6; font-family: system-ui, sans-serif; padding: 32px; margin: 0; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    p.sub { color: #6b7280; font-size: 13px; margin: 0 0 32px; }
    td { border-bottom: 1px solid #1e293b; vertical-align: top; }
  </style>
</head>
<body>
  <h1>Copy Pool Debug</h1>
  <p class="sub">${images.length} image${images.length !== 1 ? "s" : ""} — refresh after analyzing</p>
  ${cards.length ? cards.join("") : '<p style="color:#6b7280">No images yet.</p>'}
  ${personaTable}
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
