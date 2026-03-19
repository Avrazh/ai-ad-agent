import type { TextBox } from "@/lib/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns absolutely-positioned HTML divs for all user text boxes.
 * Inject this inside <body> which has position:relative and overflow:hidden.
 */
export function buildTextBoxesHtml(boxes: TextBox[], canvasW: number, canvasH: number): string {
  if (!boxes || boxes.length === 0) return "";
  return boxes.map(box => {
    const x = Math.round(box.x * canvasW);
    const y = Math.round(box.y * canvasH);
    const w = Math.round(box.w * canvasW);
    const fs = Math.round(box.fontSize * canvasH);
    const fw = box.bold ? 700 : 400;
    const lines = box.text.split("\n").map(l => box.bullets ? `&bull; ${esc(l)}` : esc(l));
    const html = lines.join("<br>");
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:fit-content;max-width:${w}px;padding:2px 8px;font-family:'Inter',sans-serif;font-size:${fs}px;font-weight:${fw};color:${esc(box.color)};line-height:1.3;word-break:break-word;white-space:pre-wrap;">${html}</div>`;
  }).join("\n");
}
