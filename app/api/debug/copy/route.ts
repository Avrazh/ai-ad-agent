import { NextResponse } from "next/server";
import { getAllPersonas, getAllGlobalPersonaHeadlines } from "@/lib/db";

export async function GET() {
  const allPersonas = await getAllPersonas();
  const globalHls = await getAllGlobalPersonaHeadlines("en");

  const phRows = allPersonas.flatMap((p) =>
    p.tones.map((tone, i) => {
      const hs = globalHls[p.id]?.[tone] ?? [];
      const cells = hs.length
        ? hs.map((h) => `<div style="color:#f1f5f9;font-size:13px;padding:2px 0">${h}</div>`).join("")
        : `<em style="color:#4b5563">—</em>`;
      return `<tr style="background:#111827">
          ${i === 0
            ? `<td style="padding:5px 10px;color:#6b7280;font-size:11px;white-space:nowrap;vertical-align:top" rowspan="${p.tones.length}">${p.id}</td>
               <td style="padding:5px 10px;color:#94a3b8;font-size:11px;white-space:nowrap;vertical-align:top" rowspan="${p.tones.length}">${p.name}</td>`
            : ""}
          <td style="padding:5px 10px;font-size:11px;white-space:nowrap;vertical-align:top">
            <span style="color:#6366f1;background:#1e1b4b;border-radius:4px;padding:1px 6px">${tone}</span>
          </td>
          <td style="padding:5px 10px;vertical-align:top">${cells}</td>
        </tr>`;
    })
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Persona Headlines Debug</title>
  <style>
    * { box-sizing: border-box; }
    body { background: #111; color: #f3f4f6; font-family: system-ui, sans-serif; padding: 32px; margin: 0; }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    p.sub { color: #6b7280; font-size: 13px; margin: 0 0 32px; }
    td { border-bottom: 1px solid #1e293b; vertical-align: top; }
  </style>
</head>
<body>
  <h1>Persona Headlines</h1>
  <p class="sub">${allPersonas.length} personas — global, not per-image</p>
  <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">
    <thead>
      <tr style="background:#0f172a">
        <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Persona ID</th>
        <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Name</th>
        <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Tone</th>
        <th style="padding:5px 10px;text-align:left;color:#475569;font-size:11px;font-weight:500">Headlines</th>
      </tr>
    </thead>
    <tbody>${phRows}</tbody>
  </table>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
