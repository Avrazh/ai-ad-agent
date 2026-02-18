import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

// iOS iMessage-style sent bubble.
// Tail is an SVG <polygon> — perfectly sharp point, not a CSS border trick.
const definition: TemplateDefinition = {
  id: "message_bubble",
  familyId: "testimonial",
  name: "Message Bubble",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Inter",
    fontSize: 38,
    color: "#FFFFFF",
    bg: "#007AFF",
    radius: 42,
    shadow: true,
  },
  maxLines: 3,
};

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;
  const fontSize = Math.min(theme.fontSize, Math.round(zonePx.h * 0.13));
  const bubbleBg = theme.bg;

  // Tail: right-pointing ► SVG polygon
  // tailW = horizontal length (how far it sticks out)
  // tailHalf = half the total height → total height = tailHalf * 2
  // Pointier = larger tailW relative to tailHalf
  const tailHalf = Math.round(fontSize * 0.30); // half-height of tail
  const tailW    = Math.round(fontSize * 1.00); // length → 1:0.6 ratio = nice sharp point
  const tailH    = tailHalf * 2;

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        style={{ width: w, height: h, objectFit: "cover", position: "absolute" }}
      />

      {/* Zone container — right-aligned for "sent" style */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        {/* Row: [bubble body] [► SVG tail] */}
        {/* alignItems: flex-end pins both to their bottom edges → tail sits at bubble bottom */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            maxWidth: "90%",
          }}
        >
          {/* Bubble body — borderBottomRightRadius: 0 so tail polygon connects flush */}
          <div
            style={{
              background: bubbleBg,
              borderTopLeftRadius: theme.radius,
              borderTopRightRadius: theme.radius,
              borderBottomLeftRadius: theme.radius,
              borderBottomRightRadius: 0,
              padding: "18px 24px",
              display: "flex",
              boxShadow: theme.shadow ? "0 3px 18px rgba(0,0,0,0.20)" : "none",
            }}
          >
            <p
              style={{
                fontFamily: theme.fontHeadline,
                fontSize,
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

          {/* SVG tail: polygon points → (0,0) top-left, (tailW, tailHalf) sharp tip, (0, tailH) bottom-left */}
          <div style={{ width: tailW, height: tailH, display: "flex", flexShrink: 0 }}>
            <svg
              width={tailW}
              height={tailH}
              viewBox={`0 0 ${tailW} ${tailH}`}
            >
              <polygon
                points={`0,0 ${tailW},${tailHalf} 0,${tailH}`}
                fill={bubbleBg}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
