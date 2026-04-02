import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";
import { BRAND_NAME } from "@/lib/customerConfig";

const definition: TemplateDefinition = {
  id: "luxury_editorial_left",
  familyId: "luxury",
  name: "Editorial Left",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 60,
    color: "#1A1A1A",
    bg: "rgba(255,252,248,0.92)",
    radius: 0,
    shadow: false,
  },
  maxLines: 4,
  copySlots: ["headline", "subtext"],
  preferredHeadlineLength: "medium",
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect): string {
  const { w, h } = spec.renderMeta;
  const { theme } = spec;
  const headline = (spec.copy.headline ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;").replace(/\n/g, "<br>");
  const subtext = (spec.copy.subtext ?? "Luxury Collection").replace(/'/g, "&#39;");
  const subtextSize = Math.round(theme.fontSize * 0.38);
  const cropXPct = (spec.cropX ?? 0.5) * 100;
  const cropYPct = (spec.cropY ?? 0.5) * 100;

  return `
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${imageBase64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${cropXPct}% ${cropYPct}%;" />
  <div style="
    position:absolute;
    left:${zonePx.x}px;top:${zonePx.y}px;
    width:${zonePx.w}px;
    max-height:${h - zonePx.y - 24}px;
    overflow:hidden;
  ">
    <div style="
      background:${theme.bg};
      border-radius:${theme.radius}px;
      padding:32px 36px;
      display:flex;
      flex-direction:row;
      width:100%;
    ">
      <div style="width:3px;background:#C8A96E;border-radius:1px;margin-right:22px;flex-shrink:0;align-self:stretch;"></div>
      <div style="display:flex;flex-direction:column;min-width:0;flex:1;min-height:${Math.round(theme.fontSize * 1.3 * 2.5)}px;">
        ${spec.hideHeadline ? `<div style="flex:1;"></div>` : `<p data-fit-headline style="
          font-family:'${theme.fontHeadline}',serif;
          font-size:clamp(22px,${theme.fontSize}px,${theme.fontSize}px);
          font-weight:700;
          color:${spec.headlineColor ?? theme.color};
          line-height:1.3;
          margin:0;
          word-break:normal;
          overflow-wrap:normal;
        ">${headline}</p>`}
        <p style="
          font-family:'Inter',sans-serif;
          font-size:clamp(12px,${subtextSize}px,${subtextSize}px);
          font-weight:400;
          color:#7A7060;
          letter-spacing:0.10em;
          text-transform:uppercase;
          margin:14px 0 0 0;
          word-break:break-word;
        ">${subtext}</p>
      </div>
    </div>
  </div>
  ${spec.showBrand ? (() => { const bfs = Math.round(36 * (spec.brandNameFontScale ?? 1.0)); const btp = spec.brandNameY !== undefined ? Math.round(h * spec.brandNameY) : Math.round(h * 0.78); return `<div style="position:absolute;top:${btp}px;left:0;width:100%;text-align:center;"><span style="font-family:'Krona One',sans-serif;font-size:${bfs}px;font-weight:400;color:${spec.brandColor ?? '#ffffff'};letter-spacing:0.25em;text-transform:uppercase;">${BRAND_NAME}</span></div>`; })() : ""}
</div>`;
}

registerTemplate(definition, build);
export { definition };
