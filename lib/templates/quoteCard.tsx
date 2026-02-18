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
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;

  // Quote mark dominates — roughly 35% of zone height, capped generously
  const quoteMarkSize = Math.min(240, Math.round(zonePx.h * 2.90));
  // Body text: bold, readable but clearly smaller than the mark
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.95));
  // Attribution smaller than body
  const attributionFontSize = Math.round(headlineFontSize * 0.72);

  const accentBlue = "#1AABFB";

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* White card */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "36px 40px",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            boxShadow: theme.shadow ? "0 2px 20px rgba(0,0,0,0.10)" : "none",
          }}
        >
          {/* Large opening quotation mark — vivid blue, tight line-height */}
          <div
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: quoteMarkSize,
              fontWeight: 700,
              color: accentBlue,
              // lineHeight < 1 compresses space below the glyph
              lineHeight: 0.62,
              marginBottom: -20,
              display: "flex",
            }}
          >
            {"\u201C"}
          </div>

          {/* Headline — heavy bold, near-black, tight leading */}
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: headlineFontSize,
              fontWeight: 700,
              color: theme.color,
              lineHeight: 1.25,
              margin: 0,
              overflow: "hidden",
            }}
          >
            {spec.headlineText}
          </p>

          {/* Full-width separator line */}
          <div
            style={{
              marginTop: 24,
              marginBottom: 16,
              width: "100%",
              height: 1,
              background: "#E0E0E0",
              display: "flex",
            }}
          />

          {/* Attribution */}
          <div
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: attributionFontSize,
              fontWeight: 400,
              color: "#3A3A3A",
              display: "flex",
            }}
          >
            {"\u2014 Verified Review"}
          </div>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
