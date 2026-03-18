import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "luxury_soft_frame_open",
  familyId: "luxury",
  name: "Soft Frame Open",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 150,
    color: "#FFFFFF",
    bg: "transparent",
    radius: 0,
    shadow: false,
  },
  maxLines: 3,
  copySlots: ["headline"],
  preferredHeadlineLength: "short",
};

const FRAME_INSET = 22;
const FRAME_COLOR = "#C8B99A";
const FRAME_STROKE = 1.5;

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect): string {
  const { w, h } = spec.renderMeta;
  const { theme } = spec;
  const headline = (spec.copy.headline ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");

  const frameW = w - FRAME_INSET * 2;
  const frameH = h - FRAME_INSET * 2;
  const INNER_PAD = 40;

  // Zone center determines vertical gravity
  const zoneCenterNorm = (zonePx.y + zonePx.h / 2) / h;
  const justifyContent = zoneCenterNorm < 0.38 ? "flex-start"
    : zoneCenterNorm > 0.62 ? "flex-end"
    : "center";

  return `
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${imageBase64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;pointer-events:none;">
    <rect x="${FRAME_INSET}" y="${FRAME_INSET}" width="${frameW}" height="${frameH}" fill="none" stroke="${FRAME_COLOR}" stroke-width="${FRAME_STROKE}"/>
  </svg>
  <div style="
    position:absolute;
    left:${FRAME_INSET + INNER_PAD}px;
    top:${FRAME_INSET + INNER_PAD}px;
    width:${frameW - INNER_PAD * 2}px;
    height:${frameH - INNER_PAD * 2}px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:${justifyContent};
    overflow:hidden;
  ">
    <p data-fit-headline style="
      font-family:'${theme.fontHeadline}',serif;
      font-size:clamp(28px,${theme.fontSize}px,${theme.fontSize}px);
      font-weight:700;
      color:${spec.headlineColor ?? theme.color};
      line-height:1.3;
      text-align:center;
      margin:0;
      word-break:normal;
      overflow-wrap:normal;
    ">${headline}</p>
  </div>
</div>`;
}

registerTemplate(definition, build);
export { definition };
