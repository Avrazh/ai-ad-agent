import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "switch_grid_3x2_no_text",
  familyId: "ai",
  name: "Switch 3x2 Grid (No Text)",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 72,
    color: "#6b3c46",
    bg: "#f7f3f1",
    radius: 0,
    shadow: false,
  },
  maxLines: 1,
  copySlots: [],
};

const CANVAS_BG = "#f7f3f1";
const TILE_BG = "#fbf8f7";
const TILE_BORDER = "rgba(107,60,70,0.10)";
const DIVIDER = "rgba(107,60,70,0.22)";
const OUTER_PAD = 48;
const GAP = 24;

function imageTile(src: string, objectPosition: string): string {
  return `<div style="flex:1;overflow:hidden;background:${TILE_BG};border:1px solid ${TILE_BORDER};">
    <img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:${objectPosition};display:block;" />
  </div>`;
}

function emptyTile(): string {
  return `<div style="flex:1;overflow:hidden;background:${TILE_BG};border:1px solid ${TILE_BORDER};display:flex;align-items:center;justify-content:center;">
    <div style="width:72px;height:1px;background:${DIVIDER};border-radius:999px;"></div>
  </div>`;
}

function build(spec: AdSpec, imageBase64: string, _zonePx: PixelRect): string {
  const { w, h } = spec.renderMeta;

  return `
<div style="width:${w}px;height:${h}px;background:${CANVAS_BG};padding:${OUTER_PAD}px;box-sizing:border-box;display:flex;">
  <div style="width:100%;height:100%;display:flex;flex-direction:column;gap:${GAP}px;">
    <div style="display:flex;flex-direction:row;flex:1;gap:${GAP}px;">
      ${emptyTile()}
      ${imageTile(imageBase64, "70% 30%")}
    </div>
    <div style="display:flex;flex-direction:row;flex:1;gap:${GAP}px;">
      ${emptyTile()}
      ${imageTile(imageBase64, "62% 55%")}
    </div>
    <div style="display:flex;flex-direction:row;flex:1;gap:${GAP}px;">
      ${imageTile(imageBase64, "45% 70%")}
      ${emptyTile()}
    </div>
  </div>
</div>`;
}

registerTemplate(definition, build);
export { definition };
