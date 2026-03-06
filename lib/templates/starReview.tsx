import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "star_review",
  familyId: "testimonial",
  name: "Star Review",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 34,
    color: "#1a1a1a",
    bg: "#FFFFFF",
    radius: 16,
    shadow: true,
  },
  maxLines: 3,
  copySlots: ["quote"],
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;

  // Natural card height at design sizes ≈ 185px (stars 36 + starMb 14 + text 91 + padding 44)
  const available = Math.max(60, h - zonePx.y - 24);
  const fontScale = Math.min(1, available / 185);

  const headlineFontSize = Math.min(theme.fontSize, Math.round(Math.min(theme.fontSize, zonePx.h * 0.17) * fontScale));
  const starSize = Math.min(Math.round(36 * fontScale), Math.round(zonePx.h * 0.12));
  const PAD_V = Math.max(8, Math.round(22 * fontScale));
  const PAD_H = Math.max(10, Math.round(28 * fontScale));
  const STAR_MB = Math.max(6, Math.round(14 * fontScale));

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Star review card — clamped so it never overflows the canvas bottom */}
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
            maxWidth: "100%",
            boxShadow: theme.shadow ? "0 4px 20px rgba(0,0,0,0.15)" : "none",
          }}
        >
          {/* 5 stars row */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              marginBottom: STAR_MB,
            }}
          >
            <span style={{ fontSize: starSize, color: "#F59E0B", display: "flex" }}>★</span>
            <span style={{ fontSize: starSize, color: "#F59E0B", display: "flex", marginLeft: 4 }}>★</span>
            <span style={{ fontSize: starSize, color: "#F59E0B", display: "flex", marginLeft: 4 }}>★</span>
            <span style={{ fontSize: starSize, color: "#F59E0B", display: "flex", marginLeft: 4 }}>★</span>
            <span style={{ fontSize: starSize, color: "#F59E0B", display: "flex", marginLeft: 4 }}>★</span>
          </div>

          {/* Headline text */}
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: headlineFontSize,
              fontWeight: 700,
              color: theme.color,
              lineHeight: 1.35,
              margin: 0,
              overflow: "hidden",
            }}
          >
            {spec.copy.quote ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
