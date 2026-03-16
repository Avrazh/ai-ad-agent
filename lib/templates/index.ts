// Register families first
import { registerFamily } from "./familyRegistry";

registerFamily({
  id: "testimonial",
  name: "Testimonial",
  aiDescription: "Customer quote styles that build trust through social proof",
});
registerFamily({
  id: "minimal",
  name: "Minimal",
  aiDescription: "Clean, understated layouts that let the product speak for itself",
});
registerFamily({
  id: "luxury",
  name: "Luxury Editorial",
  aiDescription: "Aspirational, minimal luxury copy — short, refined, no aggressive hooks, no emojis",
});
registerFamily({
  id: "ai",
  name: "AI Style",
  aiDescription: "AI-generated visual treatments — image manipulation, graphic overlays, no text",
});

// Import all styles to trigger registration
import "./quoteCard";
import "./starReview";
import "./luxuryEditorialLeft";
import "./luxurySoftFrameOpen";
import "./gridSwitchLayout";
import "./aiSurprise";
import "./splitScene";

export { getTemplate, getAllTemplates, getTemplateIds, getStylesForFamily } from "./registry";
export { registerFamily, getFamily, getAllFamilies, pickRandomStyle, pickDifferentStyle } from "./familyRegistry";
