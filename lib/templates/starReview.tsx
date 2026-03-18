import type { AdSpec, PixelRect, SafeZones, TemplateDefinition } from "@/lib/types";
import { BRAND_NAME } from "@/lib/customerConfig";
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
    radius: 24,
    shadow: true,
  },
  maxLines: 3,
  copySlots: ["quote"],
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect, safeZones?: SafeZones): string {
  const { w, h } = spec.renderMeta;
  const { theme } = spec;
  const shadow = theme.shadow ? "0 8px 32px rgba(0,0,0,0.18)" : "none";
  const quote = (spec.copy.quote ?? "").replace(/'/g, "&#39;").replace(/"/g, "&quot;");

  // Attribution: "— Emma R., Verified Buyer" → extract "Emma R." and avatar letter
  const rawAttrib = spec.copy.attribution ?? "";
  const nameMatch = rawAttrib.match(/^—\s*([^,]+)/);
  const fullName = nameMatch ? nameMatch[1].trim() : "";
  const firstName = fullName.split(/\s+/)[0] ?? "";
  const avatarLetter = firstName.charAt(0).toUpperCase() || "V";
  // Role label is always "Verified customer" — will be translated when TR feature lands
  const roleLabel = "Verified customer";

  // Fixed text zone — same proportions as clean_headline (100–980 x, 385–1535 y)
  // TODO: blend with dynamic safeZones in a future pass
  const cardX     = Math.round(w * 0.0926);   // ~100px at 1080w
  const cardY     = Math.round(h * 0.2005);   // ~385px at 1920h
  const cardW     = Math.round(w * 0.8148);   // ~880px at 1080w
  const maxCardH  = Math.round(h * 0.7995) - cardY; // zone height ~1150px
  // Card position: use explicit override if set, otherwise auto top/bottom from avoidRegion
  const override = spec.headlineYOverride;
  let cardPos: string;
  if (override !== undefined) {
    const yPx = Math.round(h * Math.max(0.2005, Math.min(0.7995, override)));
    cardPos = `top:${yPx}px`;
  } else {
    const avoidTopY = safeZones?.avoidRegions?.[0]?.y ?? 1;
    const useBottom = avoidTopY < 0.4;
    cardPos = useBottom ? `bottom:${h - (cardY + maxCardH)}px` : `top:${cardY}px`;
  }

  return `
<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;">
  <img src="${imageBase64}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;" />
  <div style="
    position:absolute;
    left:${cardX}px;${cardPos};
    width:${cardW}px;
    max-height:${maxCardH}px;
    overflow:hidden;
  ">
    <div style="
      background:${theme.bg};
      border-radius:${theme.radius}px;
      padding:28px 32px 24px;
      display:flex;
      flex-direction:column;
      gap:0;
      box-shadow:${shadow};
    ">
      <div style="font-size:50px;color:#FBD04A;letter-spacing:4px;line-height:1;margin-bottom:16px;">★★★★★</div>
      <p data-fit-headline style="font-family:'${theme.fontHeadline}',sans-serif;font-size:clamp(13px,28px,28px);font-weight:400;color:${theme.color};line-height:1.45;margin:0;word-break:normal;overflow-wrap:normal;">${quote}</p>
      <div style="height:1px;background:#E8E8E8;margin:18px 0 16px;flex-shrink:0;"></div>
      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <div style="width:52px;height:52px;border-radius:50%;background:#4CAF50;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-family:'Inter',sans-serif;font-size:26px;font-weight:700;color:#FFFFFF;">${avatarLetter}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;">
          ${fullName
            ? `<span style="font-family:'${theme.fontHeadline}',sans-serif;font-size:28px;font-weight:700;color:${theme.color};line-height:1.2;">${fullName}</span>
          <span style="font-family:'${theme.fontHeadline}',sans-serif;font-size:28px;font-weight:400;color:#888888;line-height:1.2;">${roleLabel}</span>`
            : `<span style="font-family:'${theme.fontHeadline}',sans-serif;font-size:28px;font-weight:700;color:${theme.color};line-height:1.2;">${roleLabel}</span>`
          }
        </div>
      </div>
    </div>
  </div>
  ${spec.showBrand ? (() => { const bfs = Math.round(36 * (spec.brandNameFontScale ?? 1.0)); const btp = spec.brandNameY !== undefined ? Math.round(h * spec.brandNameY) : Math.round(h * 0.78); return `<div style="position:absolute;top:${btp}px;left:0;width:100%;text-align:center;"><span style="font-family:'Krona One',sans-serif;font-size:${bfs}px;font-weight:400;color:${spec.brandColor ?? theme.color};letter-spacing:0.25em;text-transform:uppercase;">${BRAND_NAME}</span></div>`; })() : ""}
</div>`;
}

registerTemplate(definition, build);
export { definition };
