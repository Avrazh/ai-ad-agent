import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "luxury_minimal_center",
  familyId: "luxury",
  name: "Minimal Center",
  supportedZones: ["A", "B"],
  themeDefaults: {
    fontHeadline: "Bodoni Moda",
    fontSize: 110,
    color: "rgb(245, 240, 232)",
    bg: "transparent",
    radius: 0,
    shadow: false,
  },
  maxLines: 3,
  copySlots: ["headline"],
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;

  // Responsive font sizing based on zone height
  const headlineFontSize = clamp(
    Math.round(zonePx.h * 0.28),
    48,
    theme.fontSize
  );

  const PAD_X = 60;  // zone edge → box edge
  const PAD_Y = 40;
  const BOX_PAD_H = 24; // box inner horizontal padding

  // Explicit widths to guarantee Satori wraps text correctly
  const boxW = zonePx.w - PAD_X * 2;
  const textW = boxW - BOX_PAD_H * 2;

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background Image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
        style={{
          width: w,
          height: h,
          objectFit: "cover",
          position: "absolute",
        }}
      />

      {/* Soft center gradient for readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      {/* Zone container */}
      <div
        style={{
          position: "absolute",
          left: zonePx.x,
          top: zonePx.y,
          width: zonePx.w,
          height: zonePx.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: PAD_X,
          paddingRight: PAD_X,
          paddingTop: PAD_Y,
          paddingBottom: PAD_Y,
        }}
      >
        {/* Bordered box */}
        <div
          style={{
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: theme.color,
            paddingTop: 20,
            paddingBottom: 20,
            paddingLeft: BOX_PAD_H,
            paddingRight: BOX_PAD_H,
            width: boxW,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: theme.fontHeadline,
              fontSize: headlineFontSize,
              fontWeight: 700,
              color: theme.color,
              lineHeight: 1.15,
              letterSpacing: -0.5,
              margin: 0,
              textShadow: "0 6px 24px rgba(0,0,0,0.35)",
              width: textW,
              textAlign: "center",
            }}
          >
            {spec.copy.headline ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}

registerTemplate(definition, build);

export { definition };
