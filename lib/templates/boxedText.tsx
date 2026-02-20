import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "boxed_text",
  familyId: "promo",
  name: "Boxed Text",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Bebas Neue",
    fontSize: 52,
    color: "#292121",
    bg: "rgba(255, 255, 255, 0.75)",
    radius: 16,
    shadow: true,
  },
  maxLines: 2,
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const maxFontSize = Math.min(theme.fontSize, zonePx.h * 0.35);

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Text box at bottom of zone */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          height: zonePx.h,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            background: theme.bg,
            borderRadius: theme.radius,
            padding: "28px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: maxFontSize,
              color: theme.color,
              textAlign: "center",
              lineHeight: 1.2,
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
