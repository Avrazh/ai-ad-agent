import { registerTemplate } from "./registry";
import type { AdSpec, PixelRect, SafeZones } from "@/lib/types";

const definition = {
  id: "split_scene" as const,
  name: "Split Scene",
  supportedZones: ["A" as const, "B" as const, "C" as const],
  maxLines: 2,
  familyId: "ai" as const,
  label: "Split Scene",
  copySlots: ["headline" as const],
  preferredHeadlineLength: "short" as const,
  themeDefaults: { primaryColor: "#ffffff", accentColor: "#ffffff", fontHeadline: "Playfair Display", fontSize: 72, color: "#ffffff", bg: "#000000", radius: 0, shadow: false },
};

function build(
  spec: AdSpec,
  imageBase64: string,
  _zonePx: PixelRect,
  _safeZones?: SafeZones,
  context?: { sceneBase64?: string; secondImageBase64?: string }
): string {
  const W = 1080;
  const H = 1920;

  const dividerX  = spec.splitDividerX     ?? 0.5;
  const productPanX = spec.splitProductPanX ?? 0.5;
  const secondPanX  = spec.splitSecondPanX  ?? 0.5;
  const swapped     = spec.splitSwapped     ?? false;

  const leftW  = Math.round(dividerX * W);
  const rightW = W - leftW - 1;

  const productImg  = `<img src="${imageBase64}" style="width:100%;height:100%;object-fit:cover;object-position:${Math.round(productPanX * 100)}% 50%;display:block;" />`;
  const secondImg   = context?.secondImageBase64
    ? `<img src="${context.secondImageBase64}" style="width:100%;height:100%;object-fit:cover;object-position:${Math.round(secondPanX * 100)}% 50%;display:block;" />`
    : context?.sceneBase64
      ? `<img src="${context.sceneBase64}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block;" />`
      : `<div style="width:100%;height:100%;background:#1a1a2e;"></div>`;

  const leftImg  = swapped ? secondImg  : productImg;
  const rightImg = swapped ? productImg : secondImg;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>* { margin:0;padding:0;box-sizing:border-box; } body { width:${W}px;height:${H}px;overflow:hidden;background:#000; }</style>
</head><body>
<div style="position:relative;width:${W}px;height:${H}px;display:flex;">
  <div style="width:${leftW}px;height:${H}px;overflow:hidden;flex-shrink:0;">${leftImg}</div>
  <div style="width:1px;height:${H}px;background:rgba(255,255,255,0.25);flex-shrink:0;"></div>
  <div style="width:${rightW}px;height:${H}px;overflow:hidden;flex-shrink:0;">${rightImg}</div>
</div>
</body></html>`;
}

registerTemplate(definition, build);
