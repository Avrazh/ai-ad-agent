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
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const headlineFontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.17));
  const starSize = Math.min(36, Math.round(zonePx.h * 0.12));

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Star review card */}
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
            padding: "22px 28px",
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
              marginBottom: 14,
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
            {spec.headlineText}
          </p>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
