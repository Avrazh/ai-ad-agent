import { NextRequest, NextResponse } from "next/server";
import { getImage, insertImage, insertAdSpec, insertRenderResult, getGlobalPersonaHeadlines, getPersonaQuote } from "@/lib/db";
import "@/lib/templates";
import { definition as quoteCardDef } from "@/lib/templates/quoteCard";
import { definition as starReviewDef } from "@/lib/templates/starReview";
import { definition as luxuryEditorialDef } from "@/lib/templates/luxuryEditorialLeft";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, Language, Format, ZoneId, SurpriseSpec } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";
import { LAYOUT_PREVIEWS } from "@/lib/layoutPresets";

export const maxDuration = 120;

const TESTIMONIAL_TEMPLATES = ["quote_card", "star_review"];
const LUXURY_TEMPLATES = ["luxury_editorial_left"];

const TEMPLATE_THEMES: Record<string, any> = {
  quote_card: quoteCardDef.themeDefaults,
  star_review: starReviewDef.themeDefaults,
  luxury_editorial_left: luxuryEditorialDef.themeDefaults,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageId, imageUrl, lang = "en", format = "9:16", personaId, cropX, excludeTemplateIds = [], headlines = [], allPersonaHeadlines = [], limit } = body as { imageId: string; imageUrl?: string; lang?: Language; format?: Format; personaId?: string; cropX?: number; excludeTemplateIds?: string[]; headlines?: string[]; allPersonaHeadlines?: Array<{ personaId: string; headline: string }>; limit?: number; };
    if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });
    let image = await getImage(imageId);
    if (!image) {
      if (!imageUrl) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      await insertImage({ id: imageId, filename: imageId + ".png", url: imageUrl, width: 0, height: 0 });
      image = await getImage(imageId);
    }
    const FALLBACK_HEADLINE = "Made for you";
    const FALLBACK_QUOTE = "This changed my routine completely.";
    const personaHls = personaId ? await getGlobalPersonaHeadlines(personaId, lang) : [];
    const personaQuote = personaId ? await getPersonaQuote(personaId, lang) : null;
    const clientHeadlines = (headlines as string[]).filter(Boolean);
    type TaggedHeadline = { headline: string; personaId: string | null };
    const taggedPool: TaggedHeadline[] = (allPersonaHeadlines as Array<{ personaId: string; headline: string }>).length > 0 ? (allPersonaHeadlines as Array<{ personaId: string; headline: string }>).filter(h => h.headline) : clientHeadlines.length > 0 ? clientHeadlines.map(h => ({ headline: h, personaId: personaId ?? null })) : personaHls.map(h => ({ headline: h.headline, personaId: personaId ?? null }));
    const usedHeadlines: string[] = [];
    function pickFresh(): TaggedHeadline {
      const pool = taggedPool.filter(h => !usedHeadlines.includes(h.headline));
      const src = pool.length > 0 ? pool : taggedPool;
      const picked = src.length > 0 ? src[Math.floor(Math.random() * src.length)] : { headline: FALLBACK_HEADLINE, personaId: null };
      usedHeadlines.push(picked.headline);
      return picked;
    }
    const quote = personaQuote?.text ?? FALLBACK_QUOTE;
    const attribution = personaQuote?.attribution ?? "\u2014 Verified customer";
    const dims = FORMAT_DIMS[format as Format] ?? FORMAT_DIMS["9:16"];
    const zoneId = "A" as ZoneId;
    const primarySlotId = personaId ? (personaId + ":" + "default") : "default";
    type Entry = { spec: AdSpec; surpriseSpec?: SurpriseSpec; pickedPersonaId: string | null; layoutVariant?: string };
    const testimonialEntries: Entry[] = TESTIMONIAL_TEMPLATES.filter(t => !excludeTemplateIds.includes(t)).map(tid => ({ spec: { id: newId("as"), imageId, format: format as Format, lang: lang as Language, familyId: "testimonial", templateId: tid as AdSpec["templateId"], zoneId, primarySlotId, copy: { quote, ...(attribution ? { attribution } : {}) }, theme: TEMPLATE_THEMES[tid] ?? { fontHeadline: "Playfair Display", fontSize: 90, color: "#FFFFFF", bg: "#000000", radius: 0, shadow: false }, renderMeta: dims, headlineYOverride: 0.1484, ...(cropX !== undefined ? { cropX } : {}) } as AdSpec, pickedPersonaId: personaId ?? null }));
    const luxuryEntries: Entry[] = LUXURY_TEMPLATES.filter(t => !excludeTemplateIds.includes(t)).map(tid => { const picked = pickFresh(); return { spec: { id: newId("as"), imageId, format: format as Format, lang: lang as Language, familyId: "luxury", templateId: tid as AdSpec["templateId"], zoneId, primarySlotId, copy: { headline: picked.headline }, theme: TEMPLATE_THEMES[tid] ?? { fontHeadline: "Playfair Display", fontSize: 90, color: "#FFFFFF", bg: "#000000", radius: 0, shadow: false }, renderMeta: dims, headlineYOverride: 0.1484, ...(cropX !== undefined ? { cropX } : {}) } as AdSpec, pickedPersonaId: picked.personaId }; });
    const layoutEntries: Entry[] = LAYOUT_PREVIEWS.filter(p => !excludeTemplateIds.includes(p.layout)).map(preset => { const picked = pickFresh(); const surprise = preset.spec as SurpriseSpec; const ls: SurpriseSpec = { ...surprise, en: { headline: picked.headline, subtext: surprise.en.subtext }, de: { headline: picked.headline, subtext: surprise.de.subtext } }; return { spec: { id: newId("as"), imageId, format: format as Format, lang: lang as Language, familyId: "ai", templateId: "ai_surprise", zoneId, primarySlotId: newId("surprise"), copy: { headline: picked.headline, subtext: (lang === "de" ? ls.de : ls.en).subtext }, theme: { fontHeadline: surprise.font === "sans" ? "Inter" : "Playfair Display", fontSize: 90, color: surprise.textColor, bg: surprise.bgColor, radius: 0, shadow: false }, surpriseSpec: ls, renderMeta: dims, headlineYOverride: surprise.headlineYOverride ?? 0.1484, ...(cropX !== undefined ? { cropX } : {}) } as AdSpec, surpriseSpec: ls, pickedPersonaId: picked.personaId, layoutVariant: preset.layout }; });
    const allEntries: Entry[] = [...testimonialEntries, ...luxuryEntries, ...layoutEntries];
    const selectedEntries = limit ? allEntries.sort(() => Math.random() - 0.5).slice(0, limit) : allEntries;
    const renders = await Promise.all(selectedEntries.map(e => renderSpecToResult(e.spec, e.surpriseSpec)));
    return NextResponse.json({ results: renders.map((r, i) => ({ ...r, pickedPersonaId: selectedEntries[i].pickedPersonaId, ...(selectedEntries[i].layoutVariant ? { layoutVariant: selectedEntries[i].layoutVariant } : {}) })) });
  } catch (err) {
    console.error("First drafts error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "First drafts failed" }, { status: 500 });
  }
}

async function renderSpecToResult(spec: AdSpec, surpriseSpec?: SurpriseSpec) {
  await insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
  const { pngUrl, renderResultId, cssSubjectPos } = await renderAd(spec);
  await insertRenderResult({ id: renderResultId, adSpecId: spec.id, imageId: spec.imageId, familyId: spec.familyId, templateId: spec.templateId, primarySlotId: spec.primarySlotId, pngUrl });
  return { id: renderResultId, adSpecId: spec.id, imageId: spec.imageId, familyId: spec.familyId, templateId: spec.templateId, primarySlotId: spec.primarySlotId, format: spec.format, pngUrl, approved: false, createdAt: new Date().toISOString(), headlineText: spec.copy.headline ?? spec.copy.quote, headlineFontScale: surpriseSpec?.headlineFontScale ?? 1.0, headlineYOverride: spec.headlineYOverride, attribution: spec.copy.attribution, subjectPos: cssSubjectPos, headlineColor: spec.headlineColor ?? surpriseSpec?.textColor ?? spec.theme?.color };
}

