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

export type Headline = {
  id: string;
  angle: Angle;
  lang: Language;
  text: string;
};

export type CopyPool = {
  imageId: string;
  headlines: Headline[];  // 24 total: 6 per language (2 benefit, 1 curiosity, 1 urgency, 1 emotional, 2 aspirational each)
  ctas: string[];
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
export type FamilyId = "promo" | "testimonial" | "minimal" | "luxury";

export type FamilyDefinition = {
  id: FamilyId;
  name: string;           // Display: "Promo", "Testimonial", "Minimal"
  aiDescription: string;  // Used in AI prompt when real AI is integrated
};

// ── Template (style) ─────────────────────────────────────────
// A style is a visual/structural variant within a family.
// Each style has its own build() function and themeDefaults.
export type TemplateId =
  | "boxed_text" | "quote_card" | "star_review"
  | "luxury_minimal_center" | "luxury_editorial_left" | "luxury_soft_frame" | "luxury_soft_frame_open";

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
  headlineId: string;      // ref into CopyPool
  headlineText: string;    // resolved text (stored for fast access)
  theme: TemplateTheme;
  renderMeta: { w: number; h: number };
};

// ── Render result ───────────────────────────────────────────
export type RenderResult = {
  id: string;
  adSpecId: string;
  imageId: string;         // denormalized for quick lookup
  familyId: string;        // denormalized — for badge display
  templateId: string;      // denormalized — regen can rotate without parsing
  headlineId: string;      // denormalized — regen can pick next headline
  pngUrl: string;
  approved: boolean;
  replacedBy: string | null;
  createdAt: string;
};
