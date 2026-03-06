import type { AdSpec, PixelRect, TemplateDefinition } from "@/lib/types";
import { registerTemplate } from "./registry";

const definition: TemplateDefinition = {
  id: "ai_surprise",
  familyId: "ai",
  name: "AI Surprise",
  supportedZones: ["A", "B", "C"],
  themeDefaults: {
    fontHeadline: "Playfair Display",
    fontSize: 90,
    color: "#F5F0E8",
    bg: "#0D0D0D",
    radius: 0,
    shadow: false,
  },
  maxLines: 3,
  copySlots: ["headline", "subtext"],
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const LETTER_SPACING: Record<string, string | number> = {
  tight: -1,
  normal: 0,
  wide: "0.12em",
  ultra: "0.25em",
};

const HL_MULT: Record<string, number> = {
  small: 0.17, medium: 0.23, large: 0.30, huge: 0.38,
};
const HL_MULT_W: Record<string, number> = {
  small: 0.13, medium: 0.18, large: 0.24, huge: 0.31,
};

function resolveFont(f?: string) {
  if (f === "bebas") return "Bebas Neue";
  if (f === "serif") return "Playfair Display";
  return "Inter";
}

function build(spec: AdSpec, imageBase64: string, _zonePx: PixelRect) {
  const { w, h } = spec.renderMeta;
  const s = spec.surpriseSpec;
  const theme = spec.theme;

  // ── Core variables ───────────────────────────────────────────
  const layout          = s?.layout            ?? "top_bottom";
  const bgColor         = s?.bgColor           ?? theme.bg;
  const textColor       = s?.textColor         ?? theme.color;
  const accentColor     = s?.accentColor       ?? textColor;
  const fontFamily      = resolveFont(s?.font);
  const subtextFamily   = resolveFont(s?.subtextFont ?? "sans");
  const fontWeight      = s?.fontWeight        ?? 700;
  const letterSpacing   = LETTER_SPACING[s?.letterSpacingKey ?? "normal"] ?? 0;
  const textTransform   = (s?.textTransform === "uppercase" ? "uppercase" : "none") as "uppercase" | "none";
  const textAlign       = (s?.textAlign === "center" ? "center" : s?.textAlign === "right" ? "right" : "left") as "left" | "center" | "right";
  const alignItems      = textAlign === "center" ? "center" as const : textAlign === "right" ? "flex-end" as const : "flex-start" as const;
  const hlScale         = s?.headlineScale     ?? "medium";
  const hlRotation      = s?.headlineRotation  ?? 0;
  const accentType      = s?.accent            ?? "none";
  const overlayOpacity  = s?.overlayOpacity    ?? 0.6;
  const imageOpacity    = s?.imageOpacity      ?? 1;
  const decoration      = s?.decoration        ?? "none";
  const label           = s?.label;
  const labelStyle      = s?.labelStyle        ?? "plain";
  const labelRotation   = s?.labelRotation     ?? 0;
  const calloutText     = s?.calloutText;
  const calloutPosition = s?.calloutPosition   ?? "top_right";
  const headline        = spec.copy.headline   ?? "";
  const subtext         = spec.copy.subtext;

  // ── Word-fit: cap font size so longest word always fits column ─
  const FONT_CHAR_RATIO: Record<string, number> = {
    "Bebas Neue": 0.45,
    "Playfair Display": 0.52,
    "Inter": 0.50,
  };
  const MIN_HL = 22;
  const baseCharRatio = FONT_CHAR_RATIO[fontFamily] ?? 0.50;
  // Ultra/wide letter-spacing (in em) adds to effective per-char width
  const lsEm = typeof letterSpacing === "string" && letterSpacing.endsWith("em")
    ? parseFloat(letterSpacing)
    : 0;
  const charRatio = baseCharRatio + lsEm;
  const longestWordLen = headline.split(/\s+/).filter(Boolean)
    .reduce((max, w) => Math.max(max, w.length), 0);

  /** Returns the largest font size where the longest word fits within colW. */
  function wordFitSize(computed: number, colW: number): number {
    if (longestWordLen === 0) return computed;
    const cap = Math.max(MIN_HL, Math.floor(colW / (longestWordLen * charRatio)));
    return Math.max(MIN_HL, Math.min(computed, cap));
  }

  /**
   * Returns the largest font size where the full text block fits inside a
   * fixed-height panel. Assumes worst-case: 3 lines of headline (lineHeight 1.15)
   * plus optional subtext (capped at 36px + 16px gap) plus label/accent reserves.
   */
  function heightFitSize(
    computed: number,
    panelH: number,
    hasSubtext: boolean,
    hasLabel: boolean,
    hasAccent: boolean,
  ): number {
    const PAD_V   = 32; // ~16px breathing room top + bottom
    const labelH  = hasLabel  ? 34 : 0;
    const accentH = hasAccent ? 28 : 0;
    const avail   = panelH - PAD_V - labelH - accentH;
    if (avail <= 0) return MIN_HL;
    // sSize is capped at 36px; gap is 16px → max subtext block = 52px
    const subtextReserve = hasSubtext ? 52 : 0;
    const cap = Math.max(MIN_HL, Math.floor((avail - subtextReserve) / (1.15 * 3)));
    return Math.max(MIN_HL, Math.min(computed, cap));
  }

  // ── Shared: accent mark before headline ──────────────────────
  function Accent({ mb = 20 }: { mb?: number }) {
    if (accentType === "line")   return <div style={{ width: 40, height: 1,  background: accentColor, marginBottom: mb, flexShrink: 0, alignSelf: alignItems, display: "flex" }} />;
    if (accentType === "bar")    return <div style={{ width: 56, height: 5,  background: accentColor, marginBottom: mb, flexShrink: 0, alignSelf: alignItems, display: "flex" }} />;
    if (accentType === "dot")    return <div style={{ width: 10, height: 10, borderRadius: 5, background: accentColor, marginBottom: mb, flexShrink: 0, alignSelf: alignItems, display: "flex" }} />;
    if (accentType === "circle") return <div style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderStyle: "solid" as const, borderColor: accentColor, marginBottom: mb, flexShrink: 0, alignSelf: alignItems, display: "flex" }} />;
    return null;
  }

  // ── Shared: label tag above headline ─────────────────────────
  function Label({ mb = 10 }: { mb?: number }) {
    if (!label) return null;
    const isTag      = labelStyle === "tag";
    const isOutlined = labelStyle === "outlined";
    const labelColor = isTag ? bgColor : accentColor;
    return (
      <div style={{
        alignSelf: alignItems,
        marginBottom: mb,
        display: "flex",
        transform: `rotate(${labelRotation}deg)`,
        background: isTag ? accentColor : "transparent",
        borderWidth: isOutlined ? 1.5 : 0,
        borderStyle: "solid" as const,
        borderColor: isOutlined ? accentColor : "transparent",
        paddingLeft:  (isTag || isOutlined) ? 10 : 0,
        paddingRight: (isTag || isOutlined) ? 10 : 0,
        paddingTop:   (isTag || isOutlined) ? 3  : 0,
        paddingBottom:(isTag || isOutlined) ? 3  : 0,
      }}>
        <p style={{ margin: 0, display: "flex", fontFamily: "Inter", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: labelColor, lineHeight: 1.4 }}>
          {label}
        </p>
      </div>
    );
  }

  // ── Shared: callout badge (absolute) ─────────────────────────
  function Callout() {
    if (!calloutText) return null;
    const size = clamp(Math.round(w * 0.16), 56, 120);
    const edge = Math.round(size * 0.28);
    const top    = calloutPosition.startsWith("top")    ? edge : undefined;
    const bottom = calloutPosition.startsWith("bottom") ? edge : undefined;
    const right  = calloutPosition.endsWith("right")    ? edge : undefined;
    const left   = calloutPosition.endsWith("left")     ? edge : undefined;
    const fontSize = clamp(Math.round(size * 0.22), 12, 28);
    return (
      <div style={{
        position: "absolute", top, bottom, left, right,
        width: size, height: size, borderRadius: size / 2,
        background: accentColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <p style={{ margin: 0, display: "flex", fontFamily: "Bebas Neue", fontSize, fontWeight: 900, color: bgColor, textAlign: "center", lineHeight: 1.1 }}>
          {calloutText}
        </p>
      </div>
    );
  }

  // ── Shared: decoration layer (absolute, full canvas) ─────────
  function DecorationLayer() {
    if (!decoration || decoration === "none") return null;
    const cs = 44; // corner bracket arm length
    const ci = 22; // corner bracket inset from edge

    if (decoration === "corner_lines") {
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
          <path d={`M ${ci} ${ci + cs} L ${ci} ${ci} L ${ci + cs} ${ci}`}              stroke={accentColor} strokeWidth={1.5} fill="none" />
          <path d={`M ${w - ci - cs} ${ci} L ${w - ci} ${ci} L ${w - ci} ${ci + cs}`}  stroke={accentColor} strokeWidth={1.5} fill="none" />
          <path d={`M ${ci} ${h - ci - cs} L ${ci} ${h - ci} L ${ci + cs} ${h - ci}`}  stroke={accentColor} strokeWidth={1.5} fill="none" />
          <path d={`M ${w-ci-cs} ${h-ci} L ${w-ci} ${h-ci} L ${w-ci} ${h-ci-cs}`}      stroke={accentColor} strokeWidth={1.5} fill="none" />
        </svg>
      );
    }

    if (decoration === "side_stripe") {
      return <div style={{ position: "absolute", left: 0, top: 0, width: 7, height: h, background: accentColor, display: "flex" }} />;
    }

    if (decoration === "geometric_block") {
      const size = Math.round(Math.min(w, h) * 0.5);
      return (
        <div style={{
          position: "absolute",
          width: size, height: size,
          background: accentColor, opacity: 0.07,
          bottom: -Math.round(size * 0.18),
          right:  -Math.round(size * 0.18),
          display: "flex",
          transform: "rotate(18deg)",
        }} />
      );
    }

    if (decoration === "diagonal_cut") {
      const cut = Math.round(Math.min(w, h) * 0.32);
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
          <polygon points={`0,0 ${cut},0 0,${cut}`} fill={accentColor} opacity="0.13" />
        </svg>
      );
    }

    return null;
  }

  // ── Shared: subtext paragraph ─────────────────────────────────
  function Subtext({ textW, size }: { textW: number; size: number }) {
    if (!subtext) return null;
    return (
      <p style={{
        fontFamily: subtextFamily, fontSize: size, fontWeight: 400,
        color: textColor, opacity: 0.55, textAlign,
        letterSpacing: "0.16em", textTransform: "uppercase",
        margin: 0, marginTop: 16, width: textW, flexShrink: 0,
      }}>
        {subtext}
      </p>
    );
  }

  // ── top_bottom ───────────────────────────────────────────────
  if (layout === "top_bottom") {
    const imageH = Math.round(h * 0.60);
    const textH  = h - imageH;
    const PAD_X  = 52;
    const textW  = w - PAD_X * 2;
    const hSizeRaw = clamp(Math.round(textH * (HL_MULT[hlScale] ?? 0.23)), 40, 180);
    const hSize  = wordFitSize(heightFitSize(hSizeRaw, textH, !!subtext, !!label, accentType !== "none"), textW);
    const sSize  = clamp(Math.round(hSize * 0.32), 14, 36);
    return (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", position: "relative" }}>
        <img src={imageBase64} width={w} height={imageH} style={{ width: w, height: imageH, objectFit: "cover", flexShrink: 0, opacity: imageOpacity }} />
        <div style={{ width: w, height: textH, flexShrink: 0, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", background: bgColor, paddingLeft: PAD_X, paddingRight: PAD_X }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.15, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── split_left ───────────────────────────────────────────────
  if (layout === "split_left") {
    const IMG_W  = Math.round(w * 0.55);
    const TEXT_W = w - IMG_W;
    const PAD    = 44;
    const textW  = TEXT_W - PAD * 2;
    const hSize  = wordFitSize(clamp(Math.round(textW * (HL_MULT_W[hlScale] ?? 0.18)), 32, 140), textW);
    const sSize  = clamp(Math.round(hSize * 0.32), 12, 28);
    return (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "row", position: "relative" }}>
        <img src={imageBase64} width={IMG_W} height={h} style={{ width: IMG_W, height: h, objectFit: "cover", flexShrink: 0, opacity: imageOpacity }} />
        <div style={{ width: TEXT_W, height: h, flexShrink: 0, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", background: bgColor, paddingLeft: PAD, paddingRight: PAD }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.2, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── split_right ──────────────────────────────────────────────
  if (layout === "split_right") {
    const IMG_W  = Math.round(w * 0.55);
    const TEXT_W = w - IMG_W;
    const PAD    = 44;
    const textW  = TEXT_W - PAD * 2;
    const hSize  = wordFitSize(clamp(Math.round(textW * (HL_MULT_W[hlScale] ?? 0.18)), 32, 140), textW);
    const sSize  = clamp(Math.round(hSize * 0.32), 12, 28);
    return (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "row", position: "relative" }}>
        <div style={{ width: TEXT_W, height: h, flexShrink: 0, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", background: bgColor, paddingLeft: PAD, paddingRight: PAD }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.2, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <img src={imageBase64} width={IMG_W} height={h} style={{ width: IMG_W, height: h, objectFit: "cover", flexShrink: 0, opacity: imageOpacity }} />
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── full_overlay ─────────────────────────────────────────────
  if (layout === "full_overlay") {
    const PAD   = 60;
    const textW = w - PAD * 2;
    const hSize = wordFitSize(clamp(Math.round(h * 0.30 * (HL_MULT[hlScale] ?? 0.23)), 32, 80), textW);
    const sSize = clamp(Math.round(hSize * 0.30), 13, 28);
    const textTop = _zonePx.y + 32;
    return (
      <div style={{ width: w, height: h, display: "flex", position: "relative" }}>
        <img src={imageBase64} width={w} height={h} style={{ position: "absolute", width: w, height: h, objectFit: "cover", opacity: imageOpacity }} />
        <div style={{ position: "absolute", width: w, height: h, background: bgColor, opacity: overlayOpacity }} />
        <div style={{ position: "absolute", left: PAD, top: textTop, width: textW, display: "flex", flexDirection: "column", alignItems }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.15, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── color_block ──────────────────────────────────────────────
  if (layout === "color_block") {
    const COLOR_W = Math.round(w * 0.55);
    const IMG_W   = w - COLOR_W;
    const PAD     = 52;
    const textW   = COLOR_W - PAD * 2;
    const hSize   = wordFitSize(clamp(Math.round(textW * (HL_MULT_W[hlScale] ?? 0.18)), 32, 180), textW);
    const sSize   = clamp(Math.round(hSize * 0.30), 12, 32);
    return (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "row", position: "relative" }}>
        <div style={{ width: COLOR_W, height: h, flexShrink: 0, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", background: bgColor, paddingLeft: PAD, paddingRight: PAD }}>
          <Label mb={14} /><Accent mb={24} />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.1, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <img src={imageBase64} width={IMG_W} height={h} style={{ width: IMG_W, height: h, objectFit: "cover", flexShrink: 0, opacity: imageOpacity }} />
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── frame_overlay ────────────────────────────────────────────
  if (layout === "frame_overlay") {
    const INSET = 28;
    const PAD   = 52;
    const textW = w - PAD * 2;
    const textTop = _zonePx.y + 28;
    // Available height from text start to bottom of frame border, minus small bottom margin
    const availH  = Math.max(60, h - INSET - 8 - textTop);
    const hSizeRaw = clamp(Math.round(h * 0.12), 36, 110);
    const hSize = wordFitSize(heightFitSize(hSizeRaw, availH, !!subtext, !!label, accentType !== "none"), textW);
    const sSize = clamp(Math.round(hSize * 0.32), 13, 30);
    return (
      <div style={{ width: w, height: h, display: "flex", position: "relative" }}>
        <img src={imageBase64} width={w} height={h} style={{ position: "absolute", width: w, height: h, objectFit: "cover", opacity: imageOpacity }} />
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
          <rect x={INSET} y={INSET} width={w - INSET * 2} height={h - INSET * 2} fill="none" stroke={accentColor} strokeWidth={7} />
        </svg>
        <div style={{ position: "absolute", left: PAD, top: textTop, width: textW, display: "flex", flexDirection: "column", alignItems }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.15, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── magazine ─────────────────────────────────────────────────
  if (layout === "magazine") {
    const imageH  = Math.round(h * 0.45);
    const textH   = h - imageH;
    const PAD_X   = 52;
    const textW   = w - PAD_X * 2;
    const hSizeRaw = clamp(Math.round(textH * (HL_MULT[hlScale] ?? 0.23)), 36, 110);
    const hSize   = wordFitSize(heightFitSize(hSizeRaw, textH, !!subtext, !!label, accentType !== "none"), textW);
    const sSize   = clamp(Math.round(hSize * 0.32), 14, 32);
    const decoSize = Math.round(textH * 0.80);
    return (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", position: "relative" }}>
        {/* contain keeps full product visible; bgColor fills letterbox gaps */}
        <div style={{ width: w, height: imageH, flexShrink: 0, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={imageBase64} style={{ width: w, height: imageH, objectFit: "contain", opacity: imageOpacity }} />
        </div>
        {/* Ghost letter — positioned from root canvas so it never clips real text */}
        <p style={{ position: "absolute", bottom: -Math.round(decoSize * 0.18), right: -Math.round(decoSize * 0.08), fontFamily, fontSize: decoSize, fontWeight: 900, color: textColor, opacity: 0.05, margin: 0, lineHeight: 1, display: "flex" }}>
          {(headline[0] ?? "A").toUpperCase()}
        </p>
        {/* Text panel — no overflow:hidden so headline is never clipped */}
        <div style={{ width: w, height: textH, flexShrink: 0, background: bgColor, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", paddingLeft: PAD_X, paddingRight: PAD_X }}>
          <Label /><Accent />
          <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.2, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
            {headline}
          </p>
          <Subtext textW={textW} size={sSize} />
        </div>
        <DecorationLayer /><Callout />
      </div>
    );
  }

  // ── bottom_bar (default / fallback) ──────────────────────────
  const BAR_H = Math.round(h * 0.27);
  const PAD_X = 52;
  const textW = w - PAD_X * 2;
  const hSizeRaw = clamp(Math.round(BAR_H * (HL_MULT[hlScale] ?? 0.23)), 36, 130);
  const hSize = wordFitSize(heightFitSize(hSizeRaw, BAR_H, !!subtext, !!label, accentType !== "none"), textW);
  const sSize = clamp(Math.round(hSize * 0.32), 12, 30);
  return (
    <div style={{ width: w, height: h, display: "flex", position: "relative" }}>
      <img src={imageBase64} width={w} height={h} style={{ position: "absolute", width: w, height: h, objectFit: "cover", opacity: imageOpacity }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: w, height: BAR_H, display: "flex", flexDirection: "column", alignItems, justifyContent: "center", background: bgColor, paddingLeft: PAD_X, paddingRight: PAD_X }}>
        <Label mb={8} /><Accent mb={18} />
        <p style={{ fontFamily, fontSize: hSize, fontWeight, color: textColor, textAlign, textTransform, letterSpacing, lineHeight: 1.15, margin: 0, width: textW, flexShrink: 0, transform: `rotate(${hlRotation}deg)` }}>
          {headline}
        </p>
        <Subtext textW={textW} size={sSize} />
      </div>
      <DecorationLayer /><Callout />
    </div>
  );
}

registerTemplate(definition, build);
export { definition };
