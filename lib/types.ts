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

export type Angle = "benefit" | "curiosity" | "urgency";

export type Headline = {
  id: string;
  angle: Angle;
  text: string;
};

export type CopyPool = {
  imageId: string;
  headlines: Headline[];  // 10 total: 4 benefit, 3 curiosity, 3 urgency
  ctas: string[];
};

// ── Template ────────────────────────────────────────────────
export type TemplateId = "boxed_text" | "chat_bubble";

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
  name: string;
  supportedZones: ZoneId[];
  themeDefaults: TemplateTheme;
  maxLines: number;
};

// ── AdSpec (contract between AI + renderer) ─────────────────
export type AdSpec = {
  id: string;
  imageId: string;
  format: "4:5";
  templateId: TemplateId;
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
  templateId: string;      // denormalized — regen can rotate without parsing
  headlineId: string;      // denormalized — regen can pick next headline
  pngUrl: string;
  approved: boolean;
  replacedBy: string | null;
  createdAt: string;
};
