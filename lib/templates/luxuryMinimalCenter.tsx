import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

// Luxury / Minimal Center
// White card, centered Playfair Display headline, thin champagne divider below.
// Large padding — all about breathing room and restraint.
const definition: TemplateDefinition = {
  id: "luxury_minimal_center",
  familyId: "luxury",
  name: "Minimal Center",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 52,
    color: "#1A1A1A",
    bg: "#FFFFFF",
    radius: 0,
    shadow: false,
  },
  maxLines: 3,
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.14));
  const dividerColor = "#D4C5B0";

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Centered white card — generous padding, no shadow */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "52px 56px",
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

          {/* Thin champagne divider below headline */}
          <div
            style={{
              marginTop: 28,
              width: "60%",
              height: 1,
              background: dividerColor,
              display: "flex",
            }}
          />
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
