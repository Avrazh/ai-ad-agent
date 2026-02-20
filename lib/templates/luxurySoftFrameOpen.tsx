import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

// Luxury / Soft Frame Open
// Same thin SVG border rect as Soft Frame — but no card.
// White Playfair Display headline floats directly on the image, centered.
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
};

// Frame inset from canvas edges (px)
const FRAME_INSET = 22;
const FRAME_COLOR = "#C8B99A";
const FRAME_STROKE = 1.5;

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.51));

  const frameX = FRAME_INSET;
  const frameY = FRAME_INSET;
  const frameW = w - FRAME_INSET * 2;
  const frameH = h - FRAME_INSET * 2;

  // Text fills full frame interior — no clipping
  // Zone center determines vertical gravity (top / center / bottom)
  const INNER_PAD = 40;
  const textLeft = frameX + INNER_PAD;
  const textTop = frameY + INNER_PAD;
  const textWidth = frameW - INNER_PAD * 2;
  const textHeight = frameH - INNER_PAD * 2;

  const zoneCenterNorm = (zonePx.y + zonePx.h / 2) / h;
  const justifyContent = zoneCenterNorm < 0.38 ? "flex-start"
    : zoneCenterNorm > 0.62 ? "flex-end"
    : "center";

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
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

      {/* Headline — full frame interior, zone sets vertical gravity */}
      <div
        style={{
          position: "absolute",
          left: textLeft,
          top: textTop,
          width: textWidth,
          height: textHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent,
        }}
      >
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
  );
}

registerTemplate(definition, build);

export { definition };
