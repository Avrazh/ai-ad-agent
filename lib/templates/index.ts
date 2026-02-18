// Register families first
import { registerFamily } from "./familyRegistry";

registerFamily({
  id: "promo",
  name: "Promo",
  aiDescription: "Bold promotional overlays that highlight offers and product benefits",
});
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

// Import all styles to trigger registration
import "./boxedText";
import "./chatBubble";
import "./quoteCard";
import "./starReview";
import "./messageBubble";
import "./luxuryMinimalCenter";
import "./luxuryEditorialLeft";
import "./luxurySoftFrame";
import "./luxurySoftFrameOpen";

export { getTemplate, getAllTemplates, getTemplateIds, getStylesForFamily } from "./registry";
export { registerFamily, getFamily, getAllFamilies, pickRandomStyle, pickDifferentStyle } from "./familyRegistry";
