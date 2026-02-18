import type { CopyPool, Headline, Language } from "@/lib/types";
import { newId } from "@/lib/ids";

/**
 * Mock copy generator — returns 20 headlines (5 per language × 4 languages).
 * Later: replace internals with real AI (Claude/GPT).
 * Contract stays the same: imageId in → CopyPool out.
 */
export async function generateCopyPool(imageId: string): Promise<CopyPool> {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 300));

  const pool: Record<Language, { benefit: string[]; curiosity: string[]; urgency: string[]; emotional: string[]; aspirational: string[] }> = {
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
  }

  return {
    imageId,
    headlines,
    ctas: ["Shop Now", "Get Yours", "Try It"],
  };
}
