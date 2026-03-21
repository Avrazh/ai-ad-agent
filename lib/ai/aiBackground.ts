import OpenAI from "openai";
import type { Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

const MODEL_IMAGE = "gpt-image-1";

// gpt-image-1 supported sizes mapped to our formats
const FORMAT_TO_SIZE: Record<Format, "1024x1024" | "1024x1536" | "1536x1024"> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "9:16": "1024x1536",
};

const BACKGROUND_ARCHETYPES = [
  {
    name: "marble luxury",
    description: "Cold white marble surface with soft grey veining and subtle reflections, clean editorial luxury, high-end beauty product photography backdrop",
  },
  {
    name: "golden hour outdoor",
    description: "Warm golden hour sunlight, blurred lush garden background, soft bokeh of green leaves and flowers, dreamy lifestyle beauty atmosphere",
  },
  {
    name: "dark moody studio",
    description: "Deep charcoal or near-black background, dramatic single-source side lighting casting strong shadows, high contrast editorial beauty feel",
  },
  {
    name: "pastel flat lay",
    description: "Soft pastel surface (pink, cream, or lavender), scattered dried petals or ribbon as small props, overhead flat lay angle, soft diffused light",
  },
  {
    name: "urban editorial",
    description: "Cool grey concrete or stone texture, subtle industrial graphic feel, clean hard lines, cold tones — street fashion energy",
  },
  {
    name: "silk and fabric",
    description: "Draped silk or satin fabric with rich soft folds, luxurious tactile quality, warm or jewel-toned backdrop, sensuous and editorial",
  },
  {
    name: "minimalist white",
    description: "Pure white or off-white background, single crisp soft shadow, clean commercial product photography, very minimal and airy",
  },
  {
    name: "neon night",
    description: "Very dark background washed with colored neon light (pink, purple, or electric blue glow), high energy nightlife aesthetic, soft bokeh light effects",
  },
  {
    name: "wood and nature",
    description: "Warm wood grain surface, dried flowers or eucalyptus sprigs, organic earthy textures, soft diffused natural light, calm and grounded",
  },
  {
    name: "glassy reflection",
    description: "Glossy glass or mirror surface with sharp reflections and soft depth, sleek and minimal, high-end product shot aesthetic",
  },
];

const COMPOSITION_STYLES = [
  "off-center placement — subject pushed to one side, generous negative space on the other",
  "diagonal composition — leading lines and elements arranged along a diagonal axis",
  "layered depth — distinct foreground, midground, and background elements creating depth",
  "foreground/background separation — blurred foreground element frames a sharp background scene",
  "asymmetric balance — unequal visual weight on each side, balanced by contrast or color",
];

export type PersonaContext = {
  name: string;
  visualWorld: string;
  nailPreference: string;
  motivation: string;
};

/**
 * Generates a photorealistic background using gpt-image-1.
 * One of 10 archetypes is picked randomly each call for visual variety.
 * Persona context shapes the color palette and mood within the archetype.
 * Returns a PNG Buffer — the caller composites the product image on top.
 */
export async function generateAIBackground(
  format: Format,
  persona?: PersonaContext,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client = new OpenAI({ apiKey });
  const imageSize = FORMAT_TO_SIZE[format];
  const archetype = BACKGROUND_ARCHETYPES[Math.floor(Math.random() * BACKGROUND_ARCHETYPES.length)];

  const personaLine = persona
    ? `Color palette and mood should fit this persona: ${persona.name} — ${persona.visualWorld}.`
    : `Color palette and mood should feel luxurious and aspirational.`;

  const compositionStyle = COMPOSITION_STYLES[Math.floor(Math.random() * COMPOSITION_STYLES.length)];

  const prompt = `Photorealistic beauty editorial scene. Style: "${archetype.name}" — ${archetype.description}. ${personaLine}

Create a full ad composition where the product is integrated naturally into the scene. Leave a clearly open area for a product overlay — do not place anything in the center of the frame.

Use this composition style: ${compositionStyle}

Reserve clear empty space for a product overlay, with matching lighting and perspective so the product will feel naturally placed.

No people, no hands, no products, no text, no logos, no watermarks. High-end editorial quality.`;

  console.log(`[ai-style] Archetype: "${archetype.name}"`);

  const imageResponse = await client.images.generate({
    model: MODEL_IMAGE,
    prompt,
    n: 1,
    size: imageSize,
    quality: "low",
  });

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return Buffer.from(b64, "base64");
}
