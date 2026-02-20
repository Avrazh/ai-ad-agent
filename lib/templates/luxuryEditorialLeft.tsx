import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

// Luxury / Editorial Left
// Semi-transparent warm white card.
// 2px champagne gold vertical bar on the left edge.
// Playfair Display headline + Inter subtext — left-aligned, editorial feel.
const definition: TemplateDefinition = {
  id: "luxury_editorial_left",
  familyId: "luxury",
  name: "Editorial Left",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 46,
    color: "#1A1A1A",
    bg: "rgba(255,252,248,0.92)",
    radius: 0,
    shadow: false,
  },
  maxLines: 4,
};

// Static subtext per language
const SUBTEXT: Record<string, string> = {
  en: "Luxury Collection",
  de: "Luxuskollektion",
  fr: "Collection Luxe",
  es: "Colección de Lujo",
};

const GOLD = "#C8A96E";

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.12));
  const subtextFontSize = Math.round(headlineFontSize * 0.52);
  const subtext = SUBTEXT[spec.lang] ?? SUBTEXT.en;
  const barWidth = 3;
  const barGap = 22; // space between bar and text

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Card container — clamped so it never overflows the canvas bottom */}
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
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "32px 36px",
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            width: "100%",
            position: "relative",
          }}
        >
          {/* Gold vertical bar */}
          <div
            style={{
              width: barWidth,
              background: GOLD,
              borderRadius: 1,
              marginRight: barGap,
              flexShrink: 0,
              display: "flex",
            }}
          />

          {/* Text column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              flex: 1,
            }}
          >
            {/* Headline */}
            <p
              style={{
                fontFamily: theme.fontHeadline,
                fontSize: headlineFontSize,
                fontWeight: 700,
                color: theme.color,
                lineHeight: 1.3,
                margin: 0,
                overflow: "hidden",
              }}
            >
              {spec.headlineText}
            </p>

            {/* Subtext — Inter Regular, letter-spaced, muted */}
            <p
              style={{
                fontFamily: "Inter",
                fontSize: subtextFontSize,
                fontWeight: 400,
                color: "#7A7060",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                margin: 0,
                marginTop: 16,
                overflow: "hidden",
              }}
            >
              {subtext}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
