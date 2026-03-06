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
    fontSize: 60,
    color: "#1A1A1A",
    bg: "rgba(255,252,248,0.92)",
    radius: 0,
    shadow: false,
  },
  maxLines: 4,
  copySlots: ["headline", "subtext"],
  preferredHeadlineLength: "medium",
};

const GOLD = "#C8A96E";

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const theme = spec.theme;

  // Natural card height at design sizes ≈ 398px (3 lines × 60px × 1.3 + padding 64 + subtext 42 + buffer)
  // Using 3-line estimate so wrapping headlines never overflow in any format.
  const available = Math.max(60, h - zonePx.y - 24);
  const fontScale = Math.min(1, available / 398);

  const headlineFontSize = Math.round(theme.fontSize * fontScale);
  const subtext = spec.copy.subtext ?? "Luxury Collection";
  const PAD_V = Math.max(12, Math.round(32 * fontScale));
  const PAD_H = Math.max(14, Math.round(36 * fontScale));
  const SUBTEXT_MT = Math.max(6, Math.round(16 * fontScale));
  const barWidth = 3;
  const barGap = 22; // space between bar and text
  // Explicit pixel width for the text column — avoids Satori flex shrink issues
  const textColWidth = Math.max(60, zonePx.w - 2 * PAD_H - barWidth - barGap);

  // --- Word-fit sizing (same pattern as boxedText) ---
  const MIN_FONT = 22;
  // Playfair Display is a proportional serif — avg char width ~0.52× font size
  const CHAR_RATIO = 0.52;

  const longestWordLen = (spec.copy.headline ?? "")
    .split(/\s+/).filter(Boolean)
    .reduce((max, w) => Math.max(max, w.length), 0);

  const wordFitFont = longestWordLen > 0
    ? Math.max(MIN_FONT, Math.floor(textColWidth / (longestWordLen * CHAR_RATIO)))
    : headlineFontSize;

  const finalFontSize = Math.max(MIN_FONT, Math.min(headlineFontSize, wordFitFont));

  // If word still doesn't fit at finalFontSize, expand column into padding buffer
  let finalTextColWidth = textColWidth;
  if (longestWordLen > 0) {
    const wordPxAtFont = Math.ceil(longestWordLen * CHAR_RATIO * finalFontSize);
    if (wordPxAtFont > finalTextColWidth) {
      finalTextColWidth = Math.min(wordPxAtFont + 8, zonePx.w - barWidth - barGap - 20);
    }
  }

  const finalSubtextFontSize = Math.round(finalFontSize * 0.52);

  return (
    <div style={{ width: w, height: h, position: "relative", display: "flex" }}>
      {/* Background image */}
      <img
        src={imageBase64}
        width={w}
        height={h}
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
            paddingTop: PAD_V, paddingBottom: PAD_V,
            paddingLeft: PAD_H, paddingRight: PAD_H,
            display: "flex",
            flexDirection: "row",
            width: zonePx.w,
            overflow: "hidden",
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

          {/* Text column — all widths explicit in px, no "100%" to avoid Satori ambiguity */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              width: finalTextColWidth,
            }}
          >
            {/* Headline */}
            <p
              style={{
                fontFamily: theme.fontHeadline,
                fontSize: finalFontSize,
                fontWeight: 700,
                color: theme.color,
                lineHeight: 1.3,
                margin: 0,
                width: finalTextColWidth,
              }}
            >
              {spec.copy.headline ?? ""}
            </p>

            {/* Subtext — Inter Regular, letter-spaced, muted */}
            <p
              style={{
                fontFamily: "Inter",
                fontSize: finalSubtextFontSize,
                fontWeight: 400,
                color: "#7A7060",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                margin: 0,
                marginTop: SUBTEXT_MT,
                width: finalTextColWidth,
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
