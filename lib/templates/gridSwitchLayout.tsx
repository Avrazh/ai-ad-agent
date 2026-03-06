// ─────────────────────────────────────────────────────────────
// SWITCH 3x2 GRID (NO TEXT)
// Square canvas • 3 rows x 2 cols • alternating text/image blocks
// Minimal + airy • muted brand color • centered • generous spacing
// ─────────────────────────────────────────────────────────────

import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "switch_grid_3x2_no_text",
  familyId: "ai",
  name: "Switch 3x2 Grid (No Text)",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Georgia", // (not used - no text)
    fontSize: 72, // (not used - no text)
    color: "#6b3c46",
    bg: "#f7f3f1",
    radius: 0,
    shadow: false,
  },
  maxLines: 1,
  copySlots: [],
};

const STYLE = {
  // One strong brand color (muted, not saturated)
  brand: "#6b3c46",

  // Light, minimal backgrounds
  canvasBg: "#f7f3f1",
  tileBg: "#fbf8f7",

  // Spacing
  outerPadding: 48,
  gap: 24,

  // Subtle separators / borders
  tileBorder: "rgba(107, 60, 70, 0.10)",
  dividerLine: "rgba(107, 60, 70, 0.22)",

  // Optional rounding (keep minimal; set to 0 for sharp)
  tileRadius: 0,

  // Image behavior
  imgObjectFit: "cover" as const,
};

function TileShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: STYLE.tileBg,
        border: `1px solid ${STYLE.tileBorder}`,
        borderRadius: STYLE.tileRadius,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

function ImageTile({
  src,
  objectPosition,
}: {
  src: string;
  objectPosition: string;
}) {
  return (
    <TileShell>
      <img
        src={src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: STYLE.imgObjectFit,
          objectPosition,
          display: "block",
        }}
      />
    </TileShell>
  );
}

// "Text block" layout, but intentionally no text.
// Keeping a soft, centered micro-divider maintains the editorial feel
// without adding heavy graphics.
function EmptyTextTile() {
  return (
    <TileShell>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: 72,
            height: 1,
            background: STYLE.dividerLine,
            borderRadius: 999,
          }}
        />
      </div>
    </TileShell>
  );
}

function build(spec: AdSpec, imageBase64: string, _zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;

  // 3x2 grid, alternating: T I / T I / I T
  // We reuse the single provided image but vary the crop via objectPosition.
  return (
    <div
      style={{
        width: w,
        height: h,
        background: STYLE.canvasBg,
        padding: STYLE.outerPadding,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      {/* 3 rows stacked vertically */}
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: STYLE.gap }}>
        {/* Row 1 */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, gap: STYLE.gap }}>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><EmptyTextTile /></div>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><ImageTile src={imageBase64} objectPosition="70% 30%" /></div>
        </div>
        {/* Row 2 */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, gap: STYLE.gap }}>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><EmptyTextTile /></div>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><ImageTile src={imageBase64} objectPosition="62% 55%" /></div>
        </div>
        {/* Row 3 */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, gap: STYLE.gap }}>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><ImageTile src={imageBase64} objectPosition="45% 70%" /></div>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}><EmptyTextTile /></div>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
