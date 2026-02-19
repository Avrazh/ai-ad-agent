import type { CopyPool, Headline, Language } from "@/lib/types";
import { newId } from "@/lib/ids";
import { read as readStorage } from "@/lib/storage";
import path from "path";

/**
 * Mock copy generator — returns 32 headlines (8 per language × 4 languages).
 * Later: replace internals with real AI (Claude/GPT vision).
 * Contract stays the same: imageId in → CopyPool out.
 *
 * Image is loaded as base64 and ready to pass to real AI —
 * see "REAL AI" comment below.
 */
export async function generateCopyPool(imageId: string): Promise<CopyPool> {
  // Load image from storage — ready for real AI vision call
  const { getImage } = await import("@/lib/db");
  const img = getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const imageBase64 = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`;

  // REAL AI: replace the pool below with a Claude/GPT vision call, e.g.:
  // const headlines = await callAI({ imageBase64, angles: [...], languages: [...] });
  // return { imageId, headlines, ctas: [...] };
  void imageBase64; // remove this line when wiring real AI

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 300));

  const pool: Record<Language, { benefit: string[]; curiosity: string[]; urgency: string[]; emotional: string[]; aspirational: string[]; story: string[]; contrast: string[] }> = {
    en: {
      benefit: [
        "Salon look in 5 minutes",
        "No glue, no mess, no stress",
      ],
      curiosity: [
        "What if nails lasted 2 weeks?",
      ],
      urgency: [
        "Limited drop — grab yours",
      ],
      emotional: [
        "You deserve nails that turn heads",
      ],
      aspirational: [
        "Effortlessly you.",
        "Crafted for the discerning few.",
      ],
      story: [
        "She stopped getting manicures. Here's why.",
      ],
      contrast: [
        "Salon price. Home speed.",
      ],
    },
    de: {
      benefit: [
        "Salon-Look in 5 Minuten",
        "Kein Kleber, kein Chaos, kein Stress",
      ],
      curiosity: [
        "Was, wenn Nägel 2 Wochen halten?",
      ],
      urgency: [
        "Limitierte Edition — jetzt sichern",
      ],
      emotional: [
        "Du verdienst Nägel, die Blicke fangen",
      ],
      aspirational: [
        "Mühelose Eleganz.",
        "Für anspruchsvolle Geschmäcker.",
      ],
      story: [
        "Sie hörte auf, zum Nagelstudio zu gehen. Das ist der Grund.",
      ],
      contrast: [
        "Salon-Qualität. Heimvorteil.",
      ],
    },
    fr: {
      benefit: [
        "Look salon en 5 minutes",
        "Sans colle, sans désordre, sans stress",
      ],
      curiosity: [
        "Et si vos ongles duraient 2 semaines ?",
      ],
      urgency: [
        "Édition limitée — commandez vite",
      ],
      emotional: [
        "Vous méritez des ongles qui font tourner les têtes",
      ],
      aspirational: [
        "L'élégance, naturellement.",
        "Pour celles qui savent.",
      ],
      story: [
        "Elle a arrêté les manucures. Voici pourquoi.",
      ],
      contrast: [
        "Prix salon. Rapidité maison.",
      ],
    },
    es: {
      benefit: [
        "Look de salón en 5 minutos",
        "Sin pegamento, sin desorden, sin estrés",
      ],
      curiosity: [
        "¿Y si las uñas duraran 2 semanas?",
      ],
      urgency: [
        "Edición limitada — consigue la tuya",
      ],
      emotional: [
        "Mereces uñas que roben miradas",
      ],
      aspirational: [
        "Elegancia sin esfuerzo.",
        "Para las que lo saben.",
      ],
      story: [
        "Dejó de ir a la manicura. Esto es lo que pasó.",
      ],
      contrast: [
        "Precio de salón. Velocidad en casa.",
      ],
    },
  };

  const headlines: Headline[] = [];

  for (const lang of Object.keys(pool) as Language[]) {
    const p = pool[lang];
    for (const text of p.benefit) {
      headlines.push({ id: newId("hl"), angle: "benefit", lang, text });
    }
    for (const text of p.curiosity) {
      headlines.push({ id: newId("hl"), angle: "curiosity", lang, text });
    }
    for (const text of p.urgency) {
      headlines.push({ id: newId("hl"), angle: "urgency", lang, text });
    }
    for (const text of p.emotional) {
      headlines.push({ id: newId("hl"), angle: "emotional", lang, text });
    }
    for (const text of p.aspirational) {
      headlines.push({ id: newId("hl"), angle: "aspirational", lang, text });
    }
    for (const text of p.story) {
      headlines.push({ id: newId("hl"), angle: "story", lang, text });
    }
    for (const text of p.contrast) {
      headlines.push({ id: newId("hl"), angle: "contrast", lang, text });
    }
  }

  return {
    imageId,
    headlines,
    ctas: ["Shop Now", "Get Yours", "Try It"],
  };
}
