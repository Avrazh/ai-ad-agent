import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "star_review",
  familyId: "testimonial",
  name: "Star Review",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 34,
    color: "#1a1a1a",
    bg: "#FFFFFF",
    radius: 16,
    shadow: true,
  },
  maxLines: 3,
  copySlots: ["quote"],
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect): string {
  const { w, h } = spec.renderMeta;
  const { theme } = spec;
  const shadow = theme.shadow ? "0 4px 20px rgba(0,0,0,0.15)" : "none";
  const quote = (spec.copy.quote ?? "").replace(/'/g, "&#39;").replace(/"/g, "&quot;");

  return `
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${imageBase64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
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
      padding:22px 28px;
      display:flex;
      flex-direction:column;
      box-shadow:${shadow};
    ">
      <div style="font-size:clamp(20px,36px,48px);color:#F59E0B;letter-spacing:3px;margin-bottom:12px;line-height:1;">★★★★★</div>
      <p data-fit-headline style="font-family:'${theme.fontHeadline}',sans-serif;font-size:clamp(14px,${theme.fontSize}px,${theme.fontSize}px);font-weight:700;color:${theme.color};line-height:1.35;margin:0;word-break:normal;overflow-wrap:normal;">${quote}</p>
    </div>
  </div>
</div>`;
}

registerTemplate(definition, build);
export { definition };
