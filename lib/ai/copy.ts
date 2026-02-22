import type { CopyPool, CopySlot, Language } from "@/lib/types";
import { newId } from "@/lib/ids";
import { read as readStorage } from "@/lib/storage";
import path from "path";

/**
 * Mock copy generator — returns typed slots per language:
 *   9 headline slots (benefit×2, curiosity, urgency, emotional, aspirational×2, story, contrast)
 *   3 quote slots   (customer review voice + attribution)
 *   8 subtext slots (angle-matched short descriptors — one per headline angle)
 *   × 4 languages = 80 slots total
 *
 * Subtext slots carry the same angle as their matching headline, so the
 * renderer can pair them deterministically (same angle = same tone).
 *
 * Later: replace internals with real AI (Claude/GPT vision).
 * Contract stays the same: imageId in → CopyPool out.
 */
export async function generateCopyPool(imageId: string): Promise<CopyPool> {
  // Load image from storage — ready for real AI vision call
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = ext === "jpg" ? "jpeg" : ext;
  const imageBase64 = `data:image/${mimeType};base64,${imageBuffer.toString("base64")}`;

  // REAL AI: replace the pools below with a Claude/GPT vision call, e.g.:
  // const slots = await callAI({ imageBase64, slotTypes: ["headline","quote","subtext"], languages: [...] });
  // return { imageId, slots };
  void imageBase64; // remove this line when wiring real AI

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 300));

  // ── Headline slots (short punchy 1-8 words) ─────────────────────────────
  const headlinePool: Record<Language, { angle: string; text: string }[]> = {
    en: [
      { angle: "benefit",      text: "Salon look in 5 minutes" },
      { angle: "benefit",      text: "No glue, no mess, no stress" },
      { angle: "curiosity",    text: "What if nails lasted 2 weeks?" },
      { angle: "urgency",      text: "Limited drop — grab yours" },
      { angle: "emotional",    text: "You deserve nails that turn heads" },
      { angle: "aspirational", text: "Effortlessly you." },
      { angle: "aspirational", text: "Crafted for the discerning few." },
      { angle: "story",        text: "She stopped getting manicures. Here's why." },
      { angle: "contrast",     text: "Salon price. Home speed." },
    ],
    de: [
      { angle: "benefit",      text: "Salon-Look in 5 Minuten" },
      { angle: "benefit",      text: "Kein Kleber, kein Chaos, kein Stress" },
      { angle: "curiosity",    text: "Was, wenn Nägel 2 Wochen halten?" },
      { angle: "urgency",      text: "Limitierte Edition — jetzt sichern" },
      { angle: "emotional",    text: "Du verdienst Nägel, die Blicke fangen" },
      { angle: "aspirational", text: "Mühelose Eleganz." },
      { angle: "aspirational", text: "Für anspruchsvolle Geschmäcker." },
      { angle: "story",        text: "Sie hörte auf, zum Nagelstudio zu gehen. Das ist der Grund." },
      { angle: "contrast",     text: "Salon-Qualität. Heimvorteil." },
    ],
    fr: [
      { angle: "benefit",      text: "Look salon en 5 minutes" },
      { angle: "benefit",      text: "Sans colle, sans désordre, sans stress" },
      { angle: "curiosity",    text: "Et si vos ongles duraient 2 semaines ?" },
      { angle: "urgency",      text: "Édition limitée — commandez vite" },
      { angle: "emotional",    text: "Vous méritez des ongles qui font tourner les têtes" },
      { angle: "aspirational", text: "L'élégance, naturellement." },
      { angle: "aspirational", text: "Pour celles qui savent." },
      { angle: "story",        text: "Elle a arrêté les manucures. Voici pourquoi." },
      { angle: "contrast",     text: "Prix salon. Rapidité maison." },
    ],
    es: [
      { angle: "benefit",      text: "Look de salón en 5 minutos" },
      { angle: "benefit",      text: "Sin pegamento, sin desorden, sin estrés" },
      { angle: "curiosity",    text: "¿Y si las uñas duraran 2 semanas?" },
      { angle: "urgency",      text: "Edición limitada — consigue la tuya" },
      { angle: "emotional",    text: "Mereces uñas que roben miradas" },
      { angle: "aspirational", text: "Elegancia sin esfuerzo." },
      { angle: "aspirational", text: "Para las que lo saben." },
      { angle: "story",        text: "Dejó de ir a la manicura. Esto es lo que pasó." },
      { angle: "contrast",     text: "Precio de salón. Velocidad en casa." },
    ],
  };

  // ── Quote slots (customer review voice, 10-25 words) ────────────────────
  const quotePool: Record<Language, { text: string; attribution: string }[]> = {
    en: [
      {
        text: "I literally threw away my nail kit after using these. Zero chipping, zero hassle, zero regrets.",
        attribution: "— Emma R., Verified Buyer",
      },
      {
        text: "My manicurist was shocked these aren't gel. Two weeks in and they still look perfect.",
        attribution: "— Sophie M., Verified Buyer",
      },
      {
        text: "I've tried every press-on brand out there. Nothing comes close to this quality.",
        attribution: "— Jade L., Verified Buyer",
      },
    ],
    de: [
      {
        text: "Ich habe mein Nagelset weggeworfen, nachdem ich diese benutzt habe. Kein Absplittern, kein Aufwand, keine Reue.",
        attribution: "— Emma R., Verifizierte Käuferin",
      },
      {
        text: "Meine Nageldesignerin war schockiert, dass das kein Gel ist. Zwei Wochen später sehen sie noch perfekt aus.",
        attribution: "— Sophie M., Verifizierte Käuferin",
      },
      {
        text: "Ich habe jede Marke ausprobiert. Nichts kommt an diese Qualität heran.",
        attribution: "— Jade L., Verifizierte Käuferin",
      },
    ],
    fr: [
      {
        text: "J'ai littéralement jeté ma trousse à ongles. Zéro écaillage, zéro tracas, zéro regret.",
        attribution: "— Emma R., Acheteuse vérifiée",
      },
      {
        text: "Ma manucure était choquée que ce ne soit pas du gel. Deux semaines plus tard, toujours parfait.",
        attribution: "— Sophie M., Acheteuse vérifiée",
      },
      {
        text: "J'ai essayé toutes les marques. Rien n'égale cette qualité.",
        attribution: "— Jade L., Acheteuse vérifiée",
      },
    ],
    es: [
      {
        text: "Literalmente tiré mi kit de uñas después de usarlas. Sin astillas, sin complicaciones, sin arrepentimientos.",
        attribution: "— Emma R., Compradora verificada",
      },
      {
        text: "Mi manicurista no podía creer que no fueran gel. Dos semanas después y siguen perfectas.",
        attribution: "— Sophie M., Compradora verificada",
      },
      {
        text: "He probado todas las marcas. Nada se acerca a esta calidad.",
        attribution: "— Jade L., Compradora verificada",
      },
    ],
  };

  // ── Subtext slots (3-8 words, angle-matched to headline pool) ───────────
  // Each entry carries the same angle as its paired headline so the renderer
  // can request "subtext matching the primary slot's angle" deterministically.
  const subtextPool: Record<Language, { angle: string; text: string }[]> = {
    en: [
      { angle: "benefit",      text: "Professional results at home" },
      { angle: "curiosity",    text: "See what you've been missing" },
      { angle: "urgency",      text: "Limited time · Limited stock" },
      { angle: "emotional",    text: "Because you deserve the best" },
      { angle: "aspirational", text: "Luxury Collection" },
      { angle: "aspirational", text: "For the discerning few" },
      { angle: "story",        text: "Her secret. Now yours." },
      { angle: "contrast",     text: "Salon quality. Home price." },
    ],
    de: [
      { angle: "benefit",      text: "Professionelle Ergebnisse zu Hause" },
      { angle: "curiosity",    text: "Entdecke, was du verpasst hast" },
      { angle: "urgency",      text: "Limitiert · Jetzt sichern" },
      { angle: "emotional",    text: "Weil du das Beste verdienst" },
      { angle: "aspirational", text: "Luxuskollektion" },
      { angle: "aspirational", text: "Für anspruchsvolle Geschmäcker" },
      { angle: "story",        text: "Ihr Geheimnis. Jetzt deins." },
      { angle: "contrast",     text: "Salon-Qualität. Heimvorteil." },
    ],
    fr: [
      { angle: "benefit",      text: "Résultats professionnels à domicile" },
      { angle: "curiosity",    text: "Découvrez ce que vous manquiez" },
      { angle: "urgency",      text: "Limité · Commandez vite" },
      { angle: "emotional",    text: "Parce que vous méritez le meilleur" },
      { angle: "aspirational", text: "Collection Luxe" },
      { angle: "aspirational", text: "Pour celles qui savent" },
      { angle: "story",        text: "Son secret. Maintenant le vôtre." },
      { angle: "contrast",     text: "Qualité salon. Prix maison." },
    ],
    es: [
      { angle: "benefit",      text: "Resultados profesionales en casa" },
      { angle: "curiosity",    text: "Descubre lo que te has perdido" },
      { angle: "urgency",      text: "Limitado · Consigue el tuyo" },
      { angle: "emotional",    text: "Porque mereces lo mejor" },
      { angle: "aspirational", text: "Colección de Lujo" },
      { angle: "aspirational", text: "Para las que lo saben" },
      { angle: "story",        text: "Su secreto. Ahora el tuyo." },
      { angle: "contrast",     text: "Calidad salón. Precio de casa." },
    ],
  };

  const slots: CopySlot[] = [];

  for (const lang of Object.keys(headlinePool) as Language[]) {
    // Headline slots
    for (const entry of headlinePool[lang]) {
      slots.push({
        id: newId("sl"),
        lang,
        slotType: "headline",
        text: entry.text,
        angle: entry.angle as CopySlot["angle"],
      });
    }

    // Quote slots
    for (const entry of quotePool[lang]) {
      slots.push({
        id: newId("sl"),
        lang,
        slotType: "quote",
        text: entry.text,
        attribution: entry.attribution,
      });
    }

    // Subtext slots — angle-tagged for matched pairing
    for (const entry of subtextPool[lang]) {
      slots.push({
        id: newId("sl"),
        lang,
        slotType: "subtext",
        text: entry.text,
        angle: entry.angle as CopySlot["angle"],
      });
    }
  }

  return { imageId, slots };
}
