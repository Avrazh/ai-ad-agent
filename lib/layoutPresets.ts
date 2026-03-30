// Extracted from app/page.tsx so the /api/first-drafts route can import without
// pulling in React / client-only code.

export type SurpriseLayout =
  | "split_right" | "full_overlay"
  | "bottom_bar" | "frame_overlay" | "postcard"
  | "vertical_text" | "clean_headline";

export type SurpriseSpecPreset = {
  layout: SurpriseLayout;
  bgColor: string; textColor: string; accentColor: string;
  overlayOpacity: number;
  font: "serif" | "sans" | "bebas";
  fontWeight: 300 | 400 | 700 | 900;
  letterSpacingKey: "tight" | "normal" | "wide" | "ultra";
  textTransform: "none" | "uppercase";
  textAlign: "left" | "center" | "right";
  headlineScale: "small" | "medium" | "large" | "huge";
  accent: "line" | "bar" | "dot" | "circle" | "none";
  preferredHeadlineLength?: "short" | "medium" | "long";
  headlineYOverride?: number;
  en: { headline: string; subtext: string };
  de: { headline: string; subtext: string };
};

export const LAYOUT_PREVIEWS: { layout: SurpriseLayout; label: string; spec: SurpriseSpecPreset }[] = [
  {
    layout: "split_right", label: "Split Right",
    spec: { layout: "split_right", bgColor: "#F5EDD6", textColor: "#2A1F14", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 400, letterSpacingKey: "ultra", textTransform: "none", textAlign: "right", headlineScale: "large", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "full_overlay", label: "Full Overlay",
    spec: { layout: "full_overlay", bgColor: "#000000", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.55, font: "sans", fontWeight: 400, letterSpacingKey: "normal", textTransform: "none", textAlign: "left", headlineScale: "large", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "bottom_bar", label: "Bottom Bar",
    spec: { layout: "bottom_bar", bgColor: "#1A1A1A", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.6, font: "bebas", fontWeight: 900, letterSpacingKey: "tight", textTransform: "uppercase", textAlign: "center", headlineScale: "huge", accent: "none", preferredHeadlineLength: "short", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "frame_overlay", label: "Frame",
    spec: { layout: "frame_overlay", bgColor: "#0D0D0D", textColor: "#F5F0E8", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 300, letterSpacingKey: "ultra", textTransform: "none", textAlign: "left", headlineScale: "medium", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "postcard", label: "Postcard",
    spec: { layout: "postcard", bgColor: "#F2EFE9", textColor: "#141414", accentColor: "#141414", overlayOpacity: 0.45, font: "serif", fontWeight: 700, letterSpacingKey: "tight", textTransform: "none", textAlign: "left", headlineScale: "medium", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "vertical_text", label: "Letters",
    spec: { layout: "vertical_text", bgColor: "#FFFFFF", textColor: "#1A1A1A", accentColor: "#1A1A1A", overlayOpacity: 0, font: "bebas", fontWeight: 400, letterSpacingKey: "normal", textTransform: "uppercase", textAlign: "left", headlineScale: "medium", accent: "none", preferredHeadlineLength: "short", en: { headline: "GLOW", subtext: "Collection" }, de: { headline: "GLANZ", subtext: "Kollektion" } },
  },
  {
    layout: "clean_headline", label: "Headline",
    spec: { layout: "clean_headline", bgColor: "#000000", textColor: "#ffffff", accentColor: "#ffffff", overlayOpacity: 0, font: "serif", fontWeight: 400, letterSpacingKey: "normal", textTransform: "none", textAlign: "center", headlineScale: "large", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "" }, de: { headline: "Vorschau", subtext: "" } },
  },
];
