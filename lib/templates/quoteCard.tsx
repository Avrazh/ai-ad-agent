import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "quote_card",
  familyId: "testimonial",
  name: "Quote Card",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 48,
    color: "#0A0A0A",
    bg: "rgba(255, 255, 255, 0.82)",
    radius: 6,
    shadow: true,
  },
  maxLines: 5,
  copySlots: ["quote"],
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect): string {
  const { w, h } = spec.renderMeta;
  const { theme } = spec;
  const shadow = theme.shadow ? "0 2px 20px rgba(0,0,0,0.10)" : "none";
  const quote = (spec.copy.quote ?? "").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  const attribution = (spec.copy.attribution ?? "\u2014 Verified Review").replace(/'/g, "&#39;");

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
      padding:32px 36px;
      display:flex;
      flex-direction:column;
      box-shadow:${shadow};
    ">
      <div style="font-family:'${theme.fontHeadline}',sans-serif;font-size:clamp(48px,12vw,200px);font-weight:700;color:#1AABFB;line-height:0.7;margin-bottom:-12px;">&#x201C;</div>
      <p data-fit-headline style="font-family:'${theme.fontHeadline}',sans-serif;font-size:clamp(16px,${theme.fontSize}px,${theme.fontSize}px);font-weight:700;color:${theme.color};line-height:1.25;margin:0;word-break:normal;overflow-wrap:normal;">${quote}</p>
      <div style="margin-top:20px;margin-bottom:14px;height:1px;background:#E0E0E0;"></div>
      <div style="font-family:'${theme.fontHeadline}',sans-serif;font-size:clamp(13px,${Math.round(theme.fontSize * 0.72)}px,${Math.round(theme.fontSize * 0.72)}px);font-weight:400;color:#3A3A3A;">${attribution}</div>
    </div>
  </div>
</div>`;
}

registerTemplate(definition, build);
export { definition };
