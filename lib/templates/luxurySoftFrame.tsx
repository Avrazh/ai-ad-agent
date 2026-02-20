import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

// Luxury / Soft Frame
// Thin SVG border rect inset from canvas edges — decorative editorial frame.
// Warm neutral card with centered Playfair Display headline.
// No shadow, no radius — clean architectural feel.
const definition: TemplateDefinition = {
  id: "luxury_soft_frame",
  familyId: "luxury",
  name: "Soft Frame",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 50,
    color: "#1A1A1A",
    bg: "rgba(250,248,245,0.93)",
    radius: 0,
    shadow: false,
  },
  maxLines: 3,
};

// Frame inset from canvas edges (px)
const FRAME_INSET = 22;
const FRAME_COLOR = "#C8B99A";
const FRAME_STROKE = 1.5;

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.13));

  const frameX = FRAME_INSET;
  const frameY = FRAME_INSET;
  const frameW = w - FRAME_INSET * 2;
  const frameH = h - FRAME_INSET * 2;

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Decorative frame — SVG rect over entire canvas */}
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", top: 0, left: 0, display: "flex" }}
      >
        <rect
          x={frameX}
          y={frameY}
          width={frameW}
          height={frameH}
          fill="none"
          stroke={FRAME_COLOR}
          strokeWidth={FRAME_STROKE}
        />
      </svg>

      {/* Centered headline card — clamped so it never overflows the canvas bottom */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          maxHeight: h - zonePx.y - 24,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "44px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          {/* Headline — centered Playfair Display */}
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: headlineFontSize,
              fontWeight: 700,
              color: theme.color,
              lineHeight: 1.3,
              textAlign: "center",
              margin: 0,
              overflow: "hidden",
            }}
          >
            {spec.headlineText}
          </p>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
