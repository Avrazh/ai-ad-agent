// ── Geometry ────────────────────────────────────────────────
// All rects are NORMALIZED (0–1) relative to image dimensions.
// Convert to pixels at render time: px = norm * canvasSize
export type NormRect = { x: number; y: number; w: number; h: number };

export type PixelRect = { x: number; y: number; w: number; h: number };

export function toPixels(norm: NormRect, canvasW: number, canvasH: number): PixelRect {
  return {
    x: Math.round(norm.x * canvasW),
    y: Math.round(norm.y * canvasH),
    w: Math.round(norm.w * canvasW),
    h: Math.round(norm.h * canvasH),
  };
}

// ── Image ───────────────────────────────────────────────────
export type ImageAsset = {
  id: string;
  filename: string;
  url: string;       // served via /api/files/uploads/{id}
  width: number;
  height: number;
  createdAt: string;
};

// ── AI outputs ──────────────────────────────────────────────
export type ZoneId = "A" | "B" | "C";

export type SafeZones = {
  imageId: string;
  avoidRegions: NormRect[];
  zones: { id: ZoneId; rect: NormRect }[];
};

export type Angle = "benefit" | "curiosity" | "urgency" | "emotional" | "aspirational" | "story" | "contrast";
export type Language = "en" | "de" | "fr" | "es";

// ── Copy slots ───────────────────────────────────────────────
// headline  — short punchy (1-8 words), promo / luxury templates
// quote     — customer review voice (10-25 words), testimonial templates
// subtext   — secondary descriptor (3-8 words), supporting line
export type CopySlotType = "headline" | "quote" | "subtext";

export type CopySlot = {
  id: string;
  lang: Language;
  slotType: CopySlotType;
  text: string;
  angle?: Angle;        // headline slots only
  attribution?: string; // quote slots only — "— Jane D., Verified Buyer"
  wordCount?: number;   // pre-computed word count for length-aware matching
};

export type CopyPool = {
  imageId: string;
  // All copy for this image, all languages, all slot types.
  // Typical count: 8 headline + 2 quote + 2 subtext per language = 48 slots total.
  slots: CopySlot[];
};

// ── Format ─────────────────────────────────────────────────
export type Format = "4:5" | "1:1" | "9:16";

export const FORMAT_DIMS: Record<Format, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

// ── Family ──────────────────────────────────────────────────
// A family is the creative concept (e.g. "promo", "testimonial").
// AI knows about families. Styles are a pure rendering concern.
export type FamilyId = "testimonial" | "minimal" | "luxury" | "ai";

export type FamilyDefinition = {
  id: FamilyId;
  name: string;           // Display: "Promo", "Testimonial", "Minimal"
  aiDescription: string;  // Used in AI prompt when real AI is integrated
};

// ── Template (style) ─────────────────────────────────────────
// A style is a visual/structural variant within a family.
// Each style has its own build() function and themeDefaults.
export type TemplateId =
  | "quote_card" | "star_review"
  | "luxury_editorial_left" | "luxury_soft_frame_open"
  | "switch_grid_3x2_no_text"
  | "ai_surprise";

export type TemplateTheme = {
  fontHeadline: string;
  fontSize: number;
  color: string;
  bg: string;
  radius: number;
  shadow: boolean;
};

export type TemplateDefinition = {
  id: TemplateId;
  familyId: FamilyId;    // which family this style belongs to
  name: string;
  supportedZones: ZoneId[];
  themeDefaults: TemplateTheme;
  maxLines: number;
  // Ordered list of slot types this template renders.
  // First entry = "primary" slot (cycled by New Headline button).
  copySlots: CopySlotType[];
  preferredHeadlineLength?: "short" | "medium" | "long"; // for length-aware slot matching
};

// ── AdSpec (contract between AI + renderer) ─────────────────
export type AdSpec = {
  id: string;
  imageId: string;
  format: Format;
  lang: Language;
  familyId: FamilyId;      // which family was selected
  templateId: TemplateId;  // which style was picked within the family
  zoneId: ZoneId;
  primarySlotId: string;   // ID of the primary CopySlot (for regenerate cycling)
  copy: {
    headline?: string;
    quote?: string;
    subtext?: string;
    attribution?: string;  // only when a quote slot is used
  };
  theme: TemplateTheme;
  renderMeta: { w: number; h: number };
  surpriseSpec?: SurpriseSpec; // only present on ai_surprise renders
};

// ── AI Style Pool ────────────────────────────────────────────
// Generated per image by the AI image API (fal.ai / OpenAI).
// Empty until real AI is connected — infrastructure ready.
export type AIStyleVariant = {
  id: string;
  name: string;
  layout: {
    type: string;                      // "grid_3x2" | "split" | "overlay" etc.
    config: Record<string, unknown>;   // layout-specific params for the build fn
  };
  copySlots: CopySlotType[];
  reusable: boolean;
  applicability: {
    scope: "universal" | "conditional" | "this-image-only";
    condition?: string;                // e.g. "works on hand/nail close-ups"
  };
  estimatedCostUsd: number;
};

export type AIStylePool = {
  imageId: string;
  variants: AIStyleVariant[];
};

// ── Surprise Me ─────────────────────────────────────────────
// Returned by Claude Haiku vision call — fresh per click (never cached).
// Random seeds in the prompt guarantee variety even for the same image.
export type SurpriseSpec = {
  // ── Composition ──────────────────────────────────────────────
  layout:
    | "top_bottom"     // image top 60%, solid color panel below
    | "split_left"     // image left 55%, text panel right 45%
    | "split_right"    // text panel left 45%, image right 55%
    | "full_overlay"   // image full-bleed, semi-transparent overlay
    | "bottom_bar"     // image full-bleed, solid color bar at very bottom
    | "color_block"    // bold solid color block left 55%, image right 45%
    | "frame_overlay"  // full-bleed image, thick SVG frame, text over image
    | "magazine"       // image top 45%, editorial text zone with decorative letter below
    | "postcard"       // full-bleed bg image + centered paper card with headline + image window
    | "vertical_text"; // left: image, right: solid panel, headline letters straddle split with image clipped inside (raw SVG)

  // ── Palette ───────────────────────────────────────────────────
  bgColor: string;          // hex — text panel / canvas background
  textColor: string;        // hex — primary text color
  accentColor: string;      // hex — accent elements, decorations
  overlayOpacity: number;   // 0–1; used by full_overlay layout
  imageOpacity?: number;    // 0.3–1.0 — mute/tint the product photo

  // ── Typography — headline ─────────────────────────────────────
  font: "serif" | "sans" | "bebas"; // Playfair Display | Inter | Bebas Neue
  fontWeight: 300 | 400 | 700 | 900;
  letterSpacingKey: "tight" | "normal" | "wide" | "ultra";
  textTransform: "none" | "uppercase";
  textAlign: "left" | "center" | "right";
  headlineScale: "small" | "medium" | "large" | "huge";
  headlineRotation?: number;   // −4 to 4 — subtle editorial slant on headline

  // ── Typography — subtext (can differ from headline font) ──────
  subtextFont?: "serif" | "sans" | "bebas"; // defaults to "sans" if omitted

  // ── Accent (small decoration just before the headline) ────────
  accent: "line" | "bar" | "dot" | "circle" | "none";

  // ── Label (short tag above the headline) ─────────────────────
  label?: string;              // e.g. "NEW", "EXCLUSIVE", "SS25", "LIMITED"
  labelStyle?: "tag" | "outlined" | "plain"; // tag=colored bg, outlined=border, plain=text only
  labelRotation?: number;      // −15 to 15 degrees

  // ── Callout (bold badge overlaid on the canvas) ───────────────
  calloutText?: string;        // e.g. "50% OFF", "#1", "2024", "SALE"
  calloutPosition?: "top_right" | "top_left" | "bottom_right" | "bottom_left";

  // ── Decoration (larger structural visual element) ─────────────
  decoration?: "none" | "corner_lines" | "side_stripe" | "geometric_block" | "diagonal_cut";

  // ── Copy ──────────────────────────────────────────────────────
  en: { headline: string; subtext: string };
  de: { headline: string; subtext: string };
  preferredHeadlineLength?: "short" | "medium" | "long"; // for length-aware slot matching
};

// ── Render result ───────────────────────────────────────────
export type RenderResult = {
  id: string;
  adSpecId: string;
  imageId: string;         // denormalized for quick lookup
  familyId: string;        // denormalized — for badge display
  templateId: string;      // denormalized — regen can rotate without parsing
  primarySlotId: string;   // denormalized — regen can pick next slot
  pngUrl: string;
  approved: boolean;
  replacedBy: string | null;
  createdAt: string;
};
