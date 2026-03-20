import type { AdSpec, PixelRect, SafeZones } from "@/lib/types";
import { registerTemplate } from "./registry";
import { BRAND_NAME } from "@/lib/customerConfig";

registerTemplate(
  {
    id: "ai_background",
    familyId: "ai",
    name: "AI Style",
    supportedZones: ["A", "B", "C"],
    themeDefaults: {
      fontHeadline: "Playfair Display",
      fontSize: 90,
      color: "#ffffff",
      bg: "#000000",
      radius: 0,
      shadow: false,
    },
    maxLines: 2,
    copySlots: ["headline"],
    preferredHeadlineLength: "short",
  },
  function build(spec: AdSpec, imageBase64: string, _zonePx: PixelRect, _safeZones?: SafeZones): string {
    const { w, h } = spec.renderMeta;
    const headline = spec.copy.headline ?? "";
    const hideHeadline = spec.hideHeadline === true;
    const headlineY = spec.headlineYOverride ?? 0.65;
    const headlineTopPx = Math.round(headlineY * h);
    const color = spec.headlineColor ?? spec.theme.color;
    const fontFamily = spec.headlineFont ?? spec.theme.fontHeadline ?? "Playfair Display";
    const fontScale = (spec as { headlineFontScale?: number }).headlineFontScale ?? 1.0;
    const baseFontSize = Math.round(spec.theme.fontSize * fontScale);

    const headlineHtml = !hideHeadline && headline ? `
      <p data-fit-headline style="
        position:absolute;
        left:0; right:0;
        top:${headlineTopPx}px;
        margin:0;
        padding:0 64px;
        font-family:'${fontFamily}',serif;
        font-size:${baseFontSize}px;
        font-weight:700;
        color:${color};
        text-align:center;
        line-height:1.2;
        letter-spacing:0.02em;
        text-shadow:0 2px 16px rgba(0,0,0,0.6);
        word-break:normal;
        overflow-wrap:normal;
        white-space:pre-wrap;
      ">${headline}</p>` : "";

    const brandFontSize = Math.round(36 * (spec.brandNameFontScale ?? 1.0));
    const brandTopPx = spec.brandNameY !== undefined
      ? Math.round(h * spec.brandNameY)
      : Math.round(h * 0.88);
    const brandHtml = spec.showBrand
      ? `<div style="position:absolute;top:${brandTopPx}px;left:0;width:100%;text-align:center;"><span style="font-family:'Krona One',sans-serif;font-size:${brandFontSize}px;font-weight:400;color:${spec.brandColor ?? color};letter-spacing:0.25em;text-transform:uppercase;">${BRAND_NAME}</span></div>`
      : "";

    return `
      <div style="position:relative;width:${w}px;height:${h}px;overflow:hidden;background:#000;">
        <img
          src="${imageBase64}"
          style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;"
          alt=""
        />
        ${headlineHtml}
        ${brandHtml}
      </div>`;
  },
);
