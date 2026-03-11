import type { AdSpec, PixelRect, SafeZones, TemplateDefinition } from "@/lib/types";
import { BRAND_NAME } from "@/lib/customerConfig";
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

const LETTER_SPACING_VAL: Record<string, string> = {
  tight: "-1px",
  normal: "0",
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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function build(spec: AdSpec, imageBase64: string, zonePx: PixelRect, safeZones?: SafeZones): string {
  const { w, h } = spec.renderMeta;
  const s = spec.surpriseSpec;
  const theme = spec.theme;

  const layout         = s?.layout            ?? "top_bottom";
  const bgColor        = s?.bgColor           ?? theme.bg;
  const textColor      = s?.textColor         ?? theme.color;
  const accentColor    = s?.accentColor       ?? textColor;
  const fontFamily     = resolveFont(s?.font);
  const subtextFamily  = resolveFont(s?.subtextFont ?? "sans");
  const fontWeight     = s?.fontWeight        ?? 700;
  const letterSpacing  = LETTER_SPACING_VAL[s?.letterSpacingKey ?? "normal"] ?? "0";
  const textTransform  = s?.textTransform === "uppercase" ? "uppercase" : "none";
  const textAlign      = s?.textAlign === "center" ? "center" : s?.textAlign === "right" ? "right" : "left";
  const alignItems     = textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start";
  const hlScale        = s?.headlineScale     ?? "medium";
  const hlRotation     = s?.headlineRotation  ?? 0;
  const accentType     = s?.accent            ?? "none";
  const overlayOpacity = s?.overlayOpacity    ?? 0.6;
  const imageOpacity   = s?.imageOpacity      ?? 1;
  const decoration     = s?.decoration        ?? "none";
  const label          = s?.label;
  const labelStyle     = s?.labelStyle        ?? "plain";
  const labelRotation  = s?.labelRotation     ?? 0;
  const calloutText    = s?.calloutText;
  const calloutPos     = s?.calloutPosition   ?? "top_right";
  const headline       = esc(spec.copy.headline ?? "");
  const subtext        = spec.copy.subtext ? esc(spec.copy.subtext) : null;

  // ── Shared HTML helpers ───────────────────────────────────────

  function accentHTML(mb = 20): string {
    if (accentType === "line")   return `<div style="width:40px;height:1px;background:${accentColor};margin-bottom:${mb}px;flex-shrink:0;align-self:${alignItems};"></div>`;
    if (accentType === "bar")    return `<div style="width:56px;height:5px;background:${accentColor};margin-bottom:${mb}px;flex-shrink:0;align-self:${alignItems};"></div>`;
    if (accentType === "dot")    return `<div style="width:10px;height:10px;border-radius:5px;background:${accentColor};margin-bottom:${mb}px;flex-shrink:0;align-self:${alignItems};"></div>`;
    if (accentType === "circle") return `<div style="width:14px;height:14px;border-radius:7px;border:2px solid ${accentColor};margin-bottom:${mb}px;flex-shrink:0;align-self:${alignItems};"></div>`;
    return "";
  }

  function labelHTML(mb = 10): string {
    if (!label) return "";
    const labelColor = labelStyle === "tag" ? bgColor : accentColor;
    const bg = labelStyle === "tag" ? accentColor : "transparent";
    const border = labelStyle === "outlined" ? `1.5px solid ${accentColor}` : "none";
    const pad = (labelStyle === "tag" || labelStyle === "outlined") ? "3px 10px" : "0";
    return `<div style="align-self:${alignItems};margin-bottom:${mb}px;display:inline-flex;transform:rotate(${labelRotation}deg);background:${bg};border:${border};padding:${pad};">
      <p style="margin:0;font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${labelColor};line-height:1.4;">${esc(label)}</p>
    </div>`;
  }

  function calloutHTML(): string {
    if (!calloutText) return "";
    const size = clamp(Math.round(w * 0.16), 56, 120);
    const edge = Math.round(size * 0.28);
    const fontSize = clamp(Math.round(size * 0.22), 12, 28);
    const top    = calloutPos.startsWith("top")    ? `${edge}px` : "auto";
    const bottom = calloutPos.startsWith("bottom") ? `${edge}px` : "auto";
    const right  = calloutPos.endsWith("right")    ? `${edge}px` : "auto";
    const left   = calloutPos.endsWith("left")     ? `${edge}px` : "auto";
    return `<div style="position:absolute;top:${top};bottom:${bottom};left:${left};right:${right};width:${size}px;height:${size}px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <p style="margin:0;font-family:'Bebas Neue',sans-serif;font-size:${fontSize}px;font-weight:900;color:${bgColor};text-align:center;line-height:1.1;">${esc(calloutText)}</p>
    </div>`;
  }

  function decorationHTML(): string {
    if (!decoration || decoration === "none") return "";
    const cs = 44, ci = 22;
    if (decoration === "corner_lines") {
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;pointer-events:none;">
        <path d="M ${ci} ${ci+cs} L ${ci} ${ci} L ${ci+cs} ${ci}" stroke="${accentColor}" stroke-width="1.5" fill="none"/>
        <path d="M ${w-ci-cs} ${ci} L ${w-ci} ${ci} L ${w-ci} ${ci+cs}" stroke="${accentColor}" stroke-width="1.5" fill="none"/>
        <path d="M ${ci} ${h-ci-cs} L ${ci} ${h-ci} L ${ci+cs} ${h-ci}" stroke="${accentColor}" stroke-width="1.5" fill="none"/>
        <path d="M ${w-ci-cs} ${h-ci} L ${w-ci} ${h-ci} L ${w-ci} ${h-ci-cs}" stroke="${accentColor}" stroke-width="1.5" fill="none"/>
      </svg>`;
    }
    if (decoration === "side_stripe") {
      return `<div style="position:absolute;left:0;top:0;width:7px;height:${h}px;background:${accentColor};"></div>`;
    }
    if (decoration === "geometric_block") {
      const size = Math.round(Math.min(w, h) * 0.5);
      return `<div style="position:absolute;width:${size}px;height:${size}px;background:${accentColor};opacity:0.07;bottom:${-Math.round(size*0.18)}px;right:${-Math.round(size*0.18)}px;transform:rotate(18deg);"></div>`;
    }
    if (decoration === "diagonal_cut") {
      const cut = Math.round(Math.min(w, h) * 0.32);
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;pointer-events:none;">
        <polygon points="0,0 ${cut},0 0,${cut}" fill="${accentColor}" opacity="0.13"/>
      </svg>`;
    }
    return "";
  }

  function subtextHTML(size: number): string {
    if (!subtext) return "";
    return `<p style="font-family:'${subtextFamily}',sans-serif;font-size:${size}px;font-weight:400;color:${textColor};opacity:0.55;text-align:${textAlign};letter-spacing:0.16em;text-transform:uppercase;margin:16px 0 0 0;word-break:break-word;">${subtext}</p>`;
  }

  function headlineHTML(hSize: number, textW: number): string {
    return `<p data-fit-headline style="font-family:'${fontFamily}',sans-serif;font-size:${hSize}px;font-weight:${fontWeight};color:${textColor};text-align:${textAlign};text-transform:${textTransform};letter-spacing:${letterSpacing};line-height:1.15;margin:0;width:${textW}px;flex-shrink:0;word-break:normal;overflow-wrap:normal;transform:rotate(${hlRotation}deg);">${headline}</p>`;
  }

  // ── split_right ───────────────────────────────────────────────
  if (layout === "split_right") {
    const IMG_W  = Math.round(w * 0.55);
    const TEXT_W = w - IMG_W;
    const PAD    = 44;
    const textW  = TEXT_W - PAD * 2;
    const hSize  = clamp(Math.round(textW * (HL_MULT_W[hlScale] ?? 0.18)), 32, 140);
    const sSize  = clamp(Math.round(hSize * 0.32), 12, 28);
    return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:row;position:relative;">
      <div style="width:${TEXT_W}px;height:${h}px;flex-shrink:0;display:flex;flex-direction:column;align-items:${alignItems};justify-content:center;background:${bgColor};padding:0 ${PAD}px;overflow:hidden;">
        ${labelHTML()}${accentHTML()}
        ${headlineHTML(hSize, textW)}
        ${subtextHTML(sSize)}
      </div>
      <img src="${imageBase64}" style="width:${IMG_W}px;height:${h}px;object-fit:cover;flex-shrink:0;opacity:${imageOpacity};" />
      ${decorationHTML()}${calloutHTML()}
    </div>`;
  }

  // ── full_overlay ──────────────────────────────────────────────
  if (layout === "full_overlay") {
    const PAD    = 60;
    const textW  = w - PAD * 2;
    const hSize  = clamp(Math.round(h * 0.30 * (HL_MULT[hlScale] ?? 0.23)), 32, 80);
    const sSize  = clamp(Math.round(hSize * 0.30), 13, 28);
    const textTop = zonePx.y + 32;
    return `<div style="width:${w}px;height:${h}px;display:flex;position:relative;">
      <img src="${imageBase64}" style="position:absolute;width:${w}px;height:${h}px;object-fit:cover;opacity:${imageOpacity};" />
      <div style="position:absolute;width:${w}px;height:${h}px;background:${bgColor};opacity:${overlayOpacity};"></div>
      <div style="position:absolute;left:${PAD}px;top:${textTop}px;width:${textW}px;display:flex;flex-direction:column;align-items:${alignItems};">
        ${labelHTML()}${accentHTML()}
        ${headlineHTML(hSize, textW)}
        ${subtextHTML(sSize)}
      </div>
      ${decorationHTML()}${calloutHTML()}
    </div>`;
  }

  // ── clean_headline ──────────────────────────────────────────────
  // Full-bleed image with text overlay and no background overlay (overlayOpacity forced to 0)
  if (layout === "clean_headline") {
    // Fixed text zone — hardcoded proportionally from 1080×1920 reference:
    // x: 100–980px (9.26%–90.74%), y: 385–1535px (20.05%–79.9%)
    // TODO: blend with dynamic safeZones in a future pass
    const TEXT_X      = Math.round(w * 0.0926);   // ~100px at 1080w
    const TEXT_W      = Math.round(w * 0.8148);   // ~880px at 1080w
    const TEXT_Y      = Math.round(h * 0.2005);   // ~385px at 1920h
    const TEXT_MAX_Y  = Math.round(h * 0.7995);   // ~1535px at 1920h
    const TEXT_ZONE_H = TEXT_MAX_Y - TEXT_Y;
    const hSize  = clamp(Math.round(TEXT_W * 0.12), 48, 130);
    const sSize  = clamp(Math.round(hSize * 0.28), 13, 28);
    // Smart crop: center on subject so hands/face stay in frame
    let subjectPos = "50% 50%";
    if (safeZones?.avoidRegions?.length) {
      const r = safeZones.avoidRegions[0];
      subjectPos = `${Math.round((r.x + r.w / 2) * 100)}% ${Math.round((r.y + r.h / 2) * 100)}%`;
    }
    const brandHTML = spec.showBrand
      ? `<div style="position:absolute;bottom:${Math.round(h * 0.2005)}px;left:0;width:100%;text-align:center;"><span style="font-family:'Playfair Display',serif;font-size:36px;font-weight:700;color:${spec.brandColor ?? textColor};letter-spacing:0.25em;text-transform:uppercase;">${BRAND_NAME}</span></div>`
      : "";
    return `<div style="width:${w}px;height:${h}px;display:flex;position:relative;">
      <img src="${imageBase64}" style="position:absolute;width:${w}px;height:${h}px;object-fit:cover;object-position:${subjectPos};opacity:${imageOpacity};" />
      <div style="position:absolute;left:${TEXT_X}px;top:${TEXT_Y}px;width:${TEXT_W}px;max-height:${TEXT_ZONE_H}px;overflow:hidden;display:flex;flex-direction:column;align-items:${alignItems};">
        ${headlineHTML(hSize, TEXT_W)}
        ${subtextHTML(sSize)}
      </div>
      ${brandHTML}
      ${calloutHTML()}
    </div>`;
  }

    // ── frame_overlay ─────────────────────────────────────────────
  if (layout === "frame_overlay") {
    const INSET  = 28;
    const PAD    = 52;
    const textW  = w - PAD * 2;
    const hSize  = clamp(Math.round(h * 0.12), 36, 110);
    const sSize  = clamp(Math.round(hSize * 0.32), 13, 30);
    const textTop = zonePx.y + 28;
    return `<div style="width:${w}px;height:${h}px;display:flex;position:relative;">
      <img src="${imageBase64}" style="position:absolute;width:${w}px;height:${h}px;object-fit:cover;opacity:${imageOpacity};" />
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;top:0;left:0;pointer-events:none;">
        <rect x="${INSET}" y="${INSET}" width="${w-INSET*2}" height="${h-INSET*2}" fill="none" stroke="${accentColor}" stroke-width="7"/>
      </svg>
      <div style="position:absolute;left:${PAD}px;top:${textTop}px;width:${textW}px;display:flex;flex-direction:column;align-items:${alignItems};">
        ${labelHTML()}${accentHTML()}
        ${headlineHTML(hSize, textW)}
        ${subtextHTML(sSize)}
      </div>
      ${decorationHTML()}${calloutHTML()}
    </div>`;
  }

  // ── postcard ──────────────────────────────────────────────────
  if (layout === "postcard") {
    const CARD_MX  = Math.round(w * 0.065);
    const CARD_MY  = Math.round(h * 0.06);
    const CARD_W   = w - 2 * CARD_MX;
    const CARD_H   = h - 2 * CARD_MY;
    const CARD_PAD = 36;
    const TEXT_H   = Math.round(CARD_H * 0.38);
    const IMG_H    = CARD_H - TEXT_H;
    const imgW     = CARD_W - 2 * CARD_PAD;
    const imgH     = IMG_H - CARD_PAD;
    const textW    = CARD_W - 2 * CARD_PAD;
    const hSize    = clamp(Math.round(TEXT_H * (HL_MULT[hlScale] ?? 0.30)), 40, 160);
    const sSize    = clamp(Math.round(hSize * 0.28), 13, 28);
    // Pan images to show the subject (avoidRegion center) rather than always center-cropping
    let subjectPos = "50% 50%";
    if (safeZones?.avoidRegions?.length) {
      const r = safeZones.avoidRegions[0];
      const cx = Math.round((r.x + r.w / 2) * 100);
      const cy = Math.round((r.y + r.h / 2) * 100);
      subjectPos = `${cx}% ${cy}%`;
    }
    return `<div style="width:${w}px;height:${h}px;display:flex;position:relative;">
      <img src="${imageBase64}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;object-fit:cover;object-position:${subjectPos};opacity:${imageOpacity};" />
      <div style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;background:rgba(0,0,0,${overlayOpacity});"></div>
      <div style="position:absolute;left:${CARD_MX}px;top:${CARD_MY}px;width:${CARD_W}px;height:${CARD_H}px;background:${bgColor};display:flex;flex-direction:column;">
        <div style="height:${TEXT_H}px;flex-shrink:0;display:flex;flex-direction:column;align-items:${alignItems};justify-content:center;padding:0 ${CARD_PAD}px;overflow:hidden;">
          ${labelHTML()}${accentHTML()}
          ${headlineHTML(hSize, textW)}
          ${subtextHTML(sSize)}
        </div>
        <div style="height:${IMG_H}px;flex-shrink:0;padding:0 ${CARD_PAD}px ${CARD_PAD}px;display:flex;">
          <img src="${imageBase64}" style="width:${imgW}px;height:${imgH}px;object-fit:cover;object-position:${subjectPos};" />
        </div>
      </div>
      ${decorationHTML()}${calloutHTML()}
    </div>`;
  }

  // ── vertical_text — SVG with pattern fill ────────────────────
  if (layout === "vertical_text") {
    const SPLIT = Math.round(w * 0.50);
    const rightPanelW = w - SPLIT;
    const word = (
      headline.replace(/&[a-z]+;/gi, "x").split(/\s+/).filter(Boolean).sort((a, b) => a.length - b.length)[0] ?? "STYLE"
    ).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "STYLE";
    const letters = word.split("");
    const N = letters.length;
    const cellH = Math.floor(h / N);
    const fontSize = Math.min(Math.floor(cellH * 0.88), Math.floor((rightPanelW - 20) / 0.62));
    const LETTER_X = SPLIT + 10;
    const baselineOffset = Math.round(fontSize * 0.365);
    const letterElems = letters.map((ch, i) => {
      const cy = Math.round(cellH * (i + 0.5)) + baselineOffset;
      return `<text x="${LETTER_X}" y="${cy}" font-family="Bebas Neue" font-size="${fontSize}" text-anchor="start" font-weight="400" fill="url(#ip)">${ch}</text>`;
    }).join("\n");
    const subtextEl = subtext
      ? `<text x="${LETTER_X}" y="${h - 88}" font-family="Inter" font-size="${Math.round(w * 0.025)}" fill="${textColor}" text-anchor="start" font-weight="400" letter-spacing="4">${subtext}</text>`
      : "";
    // Return as HTML div wrapping the SVG so renderAd.ts receives consistent HTML
    return `<div style="width:${w}px;height:${h}px;overflow:hidden;">
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>
          <pattern id="ip" patternUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">
            <image href="${imageBase64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
          </pattern>
        </defs>
        <image href="${imageBase64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
        <rect x="${SPLIT}" y="0" width="${w - SPLIT}" height="${h}" fill="${bgColor}"/>
        ${letterElems}
        ${subtextEl}
      </svg>
    </div>`;
  }

  // ── bottom_bar (default / fallback) ───────────────────────────
  const BAR_H  = Math.round(h * 0.27);
  const PAD_X  = 52;
  const textW  = w - PAD_X * 2;
  const hSize  = clamp(Math.round(BAR_H * (HL_MULT[hlScale] ?? 0.23)), 36, 130);
  const sSize  = clamp(Math.round(hSize * 0.32), 12, 30);
  return `<div style="width:${w}px;height:${h}px;display:flex;position:relative;">
    <img src="${imageBase64}" style="position:absolute;width:${w}px;height:${h}px;object-fit:cover;opacity:${imageOpacity};" />
    <div style="position:absolute;left:0;bottom:0;width:${w}px;height:${BAR_H}px;display:flex;flex-direction:column;align-items:${alignItems};justify-content:center;background:${bgColor};padding:0 ${PAD_X}px;overflow:hidden;">
      ${labelHTML(8)}${accentHTML(18)}
      ${headlineHTML(hSize, textW)}
      ${subtextHTML(sSize)}
    </div>
    ${decorationHTML()}${calloutHTML()}
  </div>`;
}

registerTemplate(definition, build);
export { definition };
