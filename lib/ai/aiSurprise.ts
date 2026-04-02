import type { SurpriseSpec } from "@/lib/types";
import { read as readStorage } from "@/lib/storage";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-sonnet-4-6";

const MOODS = [
  "bold", "whisper", "electric", "zen", "raw", "editorial",
  "playful", "architectural", "luxe", "stark", "dramatic",
  "serene", "avant-garde", "powerful", "gentle", "rebellious",
  "optimistic", "melancholic", "industrial", "romantic",
  "nostalgic", "futuristic", "street", "clinical", "chaotic",
  "warm", "cold", "explosive", "quiet", "expressive",
];
const MOVEMENTS = [
  "Bauhaus", "Swiss International Style", "Art Deco",
  "Contemporary Minimal", "Editorial Fashion", "Brutalist",
  "Scandinavian", "Japanese Wabi-Sabi", "80s Maximalism",
  "Memphis Design", "De Stijl", "Mid-Century Modern",
  "Neo-Gothic", "Constructivist", "Pop Art", "Streetwear",
  "Fine Art Photography", "Neon Noir", "Cottagecore",
  "Kinetic Typography", "Risograph Print", "Y2K",
  "Punk Zine", "High Fashion Editorial", "Retro Futurism",
];

const FALLBACK: SurpriseSpec = {
  layout: "color_block",
  bgColor: "#FF4D00",
  textColor: "#FFFFFF",
  accentColor: "#FFFFFF",
  overlayOpacity: 0.6,
  imageOpacity: 1,
  font: "bebas",
  fontWeight: 900,
  letterSpacingKey: "wide",
  textTransform: "uppercase",
  textAlign: "left",
  headlineScale: "huge",
  headlineRotation: 0,
  subtextFont: "sans",
  accent: "bar",
  label: "NEW",
  labelStyle: "tag",
  labelRotation: -3,
  decoration: "side_stripe",
  en: { headline: "Bold by Design", subtext: "Experimental Series" },
  de: { headline: "Kühn gestaltet", subtext: "Experimentelle Serie" },
};

export async function generateSurpriseSpec(imageId: string): Promise<SurpriseSpec> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);

  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[surprise] ANTHROPIC_API_KEY not set — using fallback");
    return FALLBACK;
  }

  const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
  const movement = MOVEMENTS[Math.floor(Math.random() * MOVEMENTS.length)];
  const seed = Math.floor(Math.random() * 100);

  try {
    const client = new Anthropic({ apiKey });

    const response = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 },
          },
          {
            type: "text",
            text: `You are a bold advertising art director with total creative freedom.

Design a high-impact, experimental social media ad layout for this product image.
Every decision you make should produce a result that feels visually distinct and surprising.

Creative seeds — commit to these fully:
- Mood: "${mood}"
- Design reference: "${movement}"
- Variation seed: ${seed}


Return ONLY a raw JSON object (no markdown, no explanation). Use exactly these field names:

{
  "layout": string,
  "bgColor": "#hex",
  "textColor": "#hex",
  "accentColor": "#hex",
  "overlayOpacity": number,
  "imageOpacity": number,
  "font": string,
  "fontWeight": number,
  "letterSpacingKey": string,
  "textTransform": string,
  "textAlign": string,
  "headlineScale": string,
  "headlineRotation": number,
  "subtextFont": string,
  "accent": string,
  "label": string | null,
  "labelStyle": string,
  "labelRotation": number,
  "calloutText": string | null,
  "calloutPosition": string,
  "decoration": string,
  "en": { "headline": string, "subtext": string },
  "de": { "headline": string, "subtext": string }
}

━━━ LAYOUT ━━━
Pick based on image composition and mood. All are valid:
- "top_bottom"   image top 60%, solid panel below with text
- "split_left"   image left 55%, bold text panel right 45%
- "split_right"  text panel left 45%, image right 55%
- "full_overlay" image full-bleed, semi-transparent overlay, text in safe zone
- "bottom_bar"   image full-bleed, solid color bar pinned to bottom
- "color_block"  LARGE bold color block left 55%, image right 45% — use vivid color
- "frame_overlay" image full-bleed, thick decorative SVG frame border over it
- "magazine"     image top 45%, editorial text zone below with oversized ghost letter

━━━ COLOR PALETTE ━━━
Be experimental. Match the mood. Dark is NOT the default:
- Dark editorial: near-black (#0D0D0D–#222), light text (#F5F0E8 or #FFFFFF)
- High contrast: pure white (#FFFFFF) bg, black text, vivid accentColor
- Vibrant: saturated bg — electric blue #1034FF, hot orange #FF4D00, deep red #CC0022, forest green #1A5C3A, hot pink #FF1493, acid yellow #D4FF00 — white or black text
- Pastel editorial: warm cream #F5EDD6, muted rose #EDE0D4, sage #D4E0D0 — dark text
- Neon dark: very dark bg + neon accent (#00FF87, #FF00C8, #00D4FF)
- Primary bold: pure red, blue, or yellow bg — Pop Art or Bauhaus feel
bgColor + textColor + accentColor must create strong contrast. Never near-identical shades.

imageOpacity: 0.3–1.0
- 1.0 = full photo (default)
- 0.5–0.7 = muted, slightly desaturated feel (works well with full_overlay)
- 0.3–0.5 = very muted/tinted, graphic poster feel

━━━ TYPOGRAPHY ━━━
font (headline):
- "serif"  = Playfair Display — luxury, editorial, fashion, romance
- "sans"   = Inter — modern, clean, minimal, tech
- "bebas"  = Bebas Neue — bold, condensed, sport, streetwear, brutalist, impact

subtextFont (subtext — can be DIFFERENT from headline font for visual contrast):
- Same options: "serif" | "sans" | "bebas"
- Mixing fonts creates hierarchy: e.g. bebas headline + sans subtext, serif headline + bebas subtext

fontWeight: 300=light, 400=regular, 700=bold, 900=heavy/brutal
letterSpacingKey: "tight"=compressed, "normal"=balanced, "wide"=editorial air, "ultra"=fashion tracking
textTransform: "none" or "uppercase"
textAlign: "left", "center", or "right"
headlineScale: "small"=refined, "medium"=confident, "large"=dominant, "huge"=oversized
headlineRotation: float between -4 and 4 — slight slant for editorial energy (0 = straight)

━━━ ACCENT (small decoration before headline) ━━━
"line" | "bar" | "dot" | "circle" | "none"

━━━ LABEL (short tag above the headline) ━━━
label: short uppercase word or phrase — e.g. "NEW", "EXCLUSIVE", "SS25", "LIMITED", "BESTSELLER", null
labelStyle: "tag"=colored background pill, "outlined"=border only, "plain"=text only
labelRotation: float between -15 and 15 degrees (slight tilt for sticker feel, 0 = straight)
→ Use a label whenever the mood calls for editorial layers or product context. Can be null.

━━━ CALLOUT (bold badge overlaid anywhere on canvas) ━━━
calloutText: short bold text — e.g. "50% OFF", "#1", "SALE", "2025", "★★★★★", null
calloutPosition: "top_right" | "top_left" | "bottom_right" | "bottom_left"
→ Callout is a circular badge with big bold text. Use it for promotions, rankings, or dates. Can be null.

━━━ DECORATION (larger background/structural visual element) ━━━
"none"            — clean, no extra decoration
"corner_lines"    — thin L-bracket marks at all 4 canvas corners (editorial, luxury)
"side_stripe"     — thick colored stripe on left edge of canvas (bold, modern)
"geometric_block" — large low-opacity rotated square behind text (depth, texture)
"diagonal_cut"    — SVG diagonal colored triangle in top-left corner (dynamic, asymmetric)
→ Decoration adds a layer of visual complexity. Combine with color + typography for a unique look.

━━━ COPY ━━━
- headline: 2–6 words, hooky, specific to product. No emojis. No hashtags.
  "full_overlay", "bottom_bar", "frame_overlay": MAXIMUM 3–4 words.
- subtext: 2–4 words. Collection name, qualifier, or short tagline.
- German: natural fluent German — NOT word-for-word translation.
- Never start headline or subtext with a dash or bullet character.

━━━ CREATIVE DIRECTION ━━━
Push combinations. These produce strong results:
- bebas font + vibrant color_block + diagonal_cut + uppercase = high impact streetwear
- serif font + cream palette + corner_lines + label "SS25" at slight rotation = luxury editorial
- sans 300 weight + ultra letter spacing + side_stripe + no label = Swiss minimal
- bebas huge + full_overlay + muted imageOpacity (0.5) + callout = promotional poster
- serif + split_right + geometric_block + right textAlign + outlined label = fashion magazine`,
          },
        ],
      }],
    }), "surprise");

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = validateSpec(JSON.parse(text) as SurpriseSpec);
    console.log(`[surprise] mood="${mood}" movement="${movement}" seed=${seed}`);
    logSpec("[surprise]", parsed);
    return parsed;
  } catch (err) {
    console.error("[surprise] Claude call failed — using fallback:", err);
    return FALLBACK;
  }
}

// ── Shared: validate + clamp Claude's raw JSON output ────────
function validateSpec(parsed: SurpriseSpec): SurpriseSpec {
  const validLayouts = ["top_bottom", "split_left", "split_right", "full_overlay", "bottom_bar", "color_block", "frame_overlay", "magazine", "postcard", "vertical_text"];
  if (!validLayouts.includes(parsed.layout)) parsed.layout = "top_bottom";

  const validFonts = ["serif", "sans", "bebas"];
  if (!validFonts.includes(parsed.font)) parsed.font = "serif";
  if (parsed.subtextFont && !validFonts.includes(parsed.subtextFont)) parsed.subtextFont = "sans";

  const validWeights = [300, 400, 700, 900];
  if (!validWeights.includes(parsed.fontWeight)) parsed.fontWeight = 700;

  const validLS = ["tight", "normal", "wide", "ultra"];
  if (!validLS.includes(parsed.letterSpacingKey)) parsed.letterSpacingKey = "normal";

  const validAligns = ["left", "center", "right"];
  if (!validAligns.includes(parsed.textAlign)) parsed.textAlign = "left";

  const validAccents = ["line", "bar", "dot", "circle", "none"];
  if (!validAccents.includes(parsed.accent)) parsed.accent = "none";

  const validScales = ["small", "medium", "large", "huge"];
  if (!validScales.includes(parsed.headlineScale)) parsed.headlineScale = "medium";

  const validDecorations = ["none", "corner_lines", "side_stripe", "geometric_block", "diagonal_cut"];
  if (parsed.decoration && !validDecorations.includes(parsed.decoration)) parsed.decoration = "none";

  const validLabelStyles = ["tag", "outlined", "plain"];
  if (parsed.labelStyle && !validLabelStyles.includes(parsed.labelStyle)) parsed.labelStyle = "plain";

  const validCalloutPositions = ["top_right", "top_left", "bottom_right", "bottom_left"];
  if (parsed.calloutPosition && !validCalloutPositions.includes(parsed.calloutPosition)) parsed.calloutPosition = "top_right";

  parsed.overlayOpacity = Math.max(0.3, Math.min(0.85, parsed.overlayOpacity ?? 0.6));
  if (parsed.imageOpacity != null) parsed.imageOpacity = Math.max(0.3, Math.min(1, parsed.imageOpacity));
  if (parsed.headlineRotation != null) parsed.headlineRotation = Math.max(-4, Math.min(4, parsed.headlineRotation));
  if (parsed.labelRotation != null) parsed.labelRotation = Math.max(-15, Math.min(15, parsed.labelRotation));

  if (!parsed.label) parsed.label = undefined;
  if (!parsed.calloutText) parsed.calloutText = undefined;

  return parsed;
}

function logSpec(prefix: string, p: SurpriseSpec) {
  console.log(`${prefix} layout=${p.layout} font=${p.font}/${p.fontWeight} ls=${p.letterSpacingKey}`);
  console.log(`${prefix} bg=${p.bgColor} text=${p.textColor} accent=${p.accentColor} imgOpacity=${p.imageOpacity ?? 1}`);
  console.log(`${prefix} label="${p.label ?? "-"}" callout="${p.calloutText ?? "-"}" decoration=${p.decoration ?? "none"}`);
  console.log(`${prefix} en: "${p.en?.headline}" / "${p.en?.subtext}"`);
}

// ── Reference-inspired spec generation ───────────────────────
// Claude sees the reference ad + the product image, then generates
// a SurpriseSpec that captures the reference's visual style/mood.
export async function generateSurpriseSpecFromReference(
  imageId: string,
  referenceBase64: string,
  referenceMimeType: "jpeg" | "png" | "gif" | "webp",
): Promise<SurpriseSpec> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);

  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[reference] ANTHROPIC_API_KEY not set — using fallback");
    return FALLBACK;
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await withRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 900,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: `image/${referenceMimeType}`, data: referenceBase64 },
          },
          {
            type: "text",
            text: "This is the REFERENCE AD. Study its visual DNA: layout structure, color palette, typography style and weight, text placement, overall mood and aesthetic.",
          },
          {
            type: "image",
            source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 },
          },
          {
            type: "text",
            text: `This is the PRODUCT IMAGE. Create an ad for this product that captures the same visual style as the reference ad above.

Return ONLY a raw JSON object (no markdown, no explanation). Use exactly these field names:

{
  "layout": string,
  "bgColor": "#hex",
  "textColor": "#hex",
  "accentColor": "#hex",
  "overlayOpacity": number,
  "imageOpacity": number,
  "font": string,
  "fontWeight": number,
  "letterSpacingKey": string,
  "textTransform": string,
  "textAlign": string,
  "headlineScale": string,
  "headlineRotation": number,
  "subtextFont": string,
  "accent": string,
  "label": string | null,
  "labelStyle": string,
  "labelRotation": number,
  "calloutText": string | null,
  "calloutPosition": string,
  "decoration": string,
  "en": { "headline": string, "subtext": string },
  "de": { "headline": string, "subtext": string }
}

━━━ LAYOUT ━━━
Match the reference's composition. All are valid:
- "top_bottom"    image top 60%, solid panel below with text
- "split_left"    image left 55%, bold text panel right 45%
- "split_right"   text panel left 45%, image right 55%
- "full_overlay"  image full-bleed, semi-transparent overlay
- "bottom_bar"    image full-bleed, solid color bar pinned to bottom
- "color_block"   bold color block left 55%, image right 45%
- "frame_overlay" image full-bleed, thick decorative SVG frame border
- "magazine"      image top 45%, editorial text zone below
- "postcard"      full-bleed bg image + centered paper card overlay

━━━ COLOR PALETTE ━━━
Extract the reference ad's color palette — bg, text, and accent.
Match the mood: dark editorial, vibrant, pastel, neon, etc.

━━━ TYPOGRAPHY ━━━
font: "serif" (Playfair Display) | "sans" (Inter) | "bebas" (Bebas Neue)
subtextFont: same options — can differ from headline for contrast
fontWeight: 300 | 400 | 700 | 900
letterSpacingKey: "tight" | "normal" | "wide" | "ultra"
textTransform: "none" | "uppercase"
textAlign: "left" | "center" | "right"
headlineScale: "small" | "medium" | "large" | "huge"
headlineRotation: float −4 to 4

━━━ ACCENT / LABEL / CALLOUT / DECORATION ━━━
accent: "line" | "bar" | "dot" | "circle" | "none"
label: short tag e.g. "NEW", "SS25" or null — match reference's level of detail
labelStyle: "tag" | "outlined" | "plain"
labelRotation: float −15 to 15
calloutText: badge text or null
calloutPosition: "top_right" | "top_left" | "bottom_right" | "bottom_left"
decoration: "none" | "corner_lines" | "side_stripe" | "geometric_block" | "diagonal_cut"

━━━ COPY ━━━
Write new copy appropriate for the product. Do NOT copy the reference ad's text.
headline: 2–6 words matching the reference's tone and energy
subtext: 2–4 words
German: natural fluent German translation`,
          },
        ],
      }],
    }), "reference");

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = validateSpec(JSON.parse(text) as SurpriseSpec);
    console.log("[reference] spec generated from reference image");
    logSpec("[reference]", parsed);
    return parsed;
  } catch (err) {
    console.error("[reference] Claude call failed — using fallback:", err);
    return FALLBACK;
  }
}
