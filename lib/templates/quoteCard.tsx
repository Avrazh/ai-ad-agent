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
  copySlots: ["quote"],
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;

  // available = space from zone top to canvas bottom minus margin
  // Natural card height at design sizes ≈ 396px (quoteMarkEffective 129 + text 120 + sep 41 + attr 34 + padding 72)
  const available = Math.max(60, h - zonePx.y - 24);
  const fontScale = Math.min(1, available / 396);

  const quoteMarkSize  = Math.round(240 * fontScale);
  const headlineFontSize = Math.min(theme.fontSize, Math.round(theme.fontSize * fontScale));
  const attributionFontSize = Math.round(headlineFontSize * 0.72);
  const PAD_V = Math.max(10, Math.round(36 * fontScale));
  const PAD_H = Math.max(12, Math.round(40 * fontScale));
  const SEP_MT = Math.max(8, Math.round(24 * fontScale));
  const SEP_MB = Math.max(6, Math.round(16 * fontScale));
  const MARK_MB = Math.round(-20 * fontScale);

  const accentBlue = "#1AABFB";

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* White card — clamped so it never overflows the canvas bottom */}
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
            paddingTop: PAD_V, paddingBottom: PAD_V,
            paddingLeft: PAD_H, paddingRight: PAD_H,
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
              lineHeight: 0.62,
              marginBottom: MARK_MB,
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
            {spec.copy.quote ?? ""}
          </p>

          {/* Full-width separator line */}
          <div
            style={{
              marginTop: SEP_MT,
              marginBottom: SEP_MB,
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
            {spec.copy.attribution ?? "\u2014 Verified Review"}
          </div>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
