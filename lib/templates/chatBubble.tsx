import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "chat_bubble",
  name: "Chat Bubble",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 38,
    color: "#1a1a1a",
    bg: "#FFFFFF",
    radius: 20,
    shadow: true,
  },
  maxLines: 3,
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const maxFontSize = Math.min(theme.fontSize, zonePx.h * 0.25);
  const tailSize = 14;

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Bubble at top of zone */}
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
        {/* Bubble body */}
        <div
          style={{
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "22px 28px",
            display: "flex",
            maxWidth: "100%",
            boxShadow: theme.shadow
              ? "0 4px 20px rgba(0,0,0,0.15)"
              : "none",
          }}
        >
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: maxFontSize,
              fontWeight: 700,
              color: theme.color,
              lineHeight: 1.3,
              margin: 0,
              overflow: "hidden",
            }}
          >
            {spec.headlineText}
          </p>
        </div>

        {/* Tail triangle */}
        <div
          style={{
            display: "flex",
            marginLeft: 24,
            marginTop: -1,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: `${tailSize}px solid transparent`,
              borderRight: `${tailSize}px solid transparent`,
              borderTop: `${tailSize}px solid ${theme.bg}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
