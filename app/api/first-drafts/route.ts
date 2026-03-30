import { NextRequest, NextResponse } from "next/server";
import {
  getImage,
  insertImage,
  insertAdSpec,
  insertRenderResult,
  getGlobalPersonaHeadlines,
  getPersonaQuote,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, Language, Format, ZoneId, SurpriseSpec } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";
import { LAYOUT_PREVIEWS } from "@/lib/layoutPresets";

export const maxDuration = 60;

const TESTIMONIAL_TEMPLATES = ["quote_card", "star_review"];
const LUXURY_TEMPLATES = ["luxury_editorial_left", "luxury_soft_frame_open"];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageId,
      imageUrl,
      lang = "en",
      format = "9:16",
      personaId,
      cropX,
      excludeTemplateIds = [],
    } = body as {
      imageId: string;
      imageUrl?: string;
      lang?: Language;
      format?: Format;
      personaId?: string;
      cropX?: number;
      excludeTemplateIds?: string[];
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    let image = await getImage(imageId);
    if (!image) {
      if (!imageUrl) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      await insertImage({
        id: imageId,
        filename: imageId + ".png",
        url: imageUrl,
        width: 0,
        height: 0,
      });
      image = await getImage(imageId);
    }

    // Pick 3 diverse styles
    // 1. Random testimonial (avoid excludeTemplateIds)
    const availableTestimonial = TESTIMONIAL_TEMPLATES.filter(t => !excludeTemplateIds.includes(t));
    const testimonialId = availableTestimonial.length > 0
      ? pickRandom(availableTestimonial)
      : pickRandom(TESTIMONIAL_TEMPLATES);

    // 2. Random luxury (avoid excludeTemplateIds)
    const availableLuxury = LUXURY_TEMPLATES.filter(t => !excludeTemplateIds.includes(t));
    const luxuryId = availableLuxury.length > 0
      ? pickRandom(availableLuxury)
      : pickRandom(LUXURY_TEMPLATES);

    // 3. Random layout preset (avoid already-used layout names from excludeTemplateIds context)
    const usedLayouts = excludeTemplateIds;
    const availableLayouts = LAYOUT_PREVIEWS.filter(p => !usedLayouts.includes(p.layout));
    const layoutPreset = availableLayouts.length > 0
      ? pickRandom(availableLayouts)
      : pickRandom(LAYOUT_PREVIEWS);

    // Resolve persona copy
    const FALLBACK_HEADLINE = "The nails made for you";
    const FALLBACK_QUOTE = "These nails changed my routine.";
    const personaHls = personaId ? await getGlobalPersonaHeadlines(personaId, lang) : [];
    const personaQuote = personaId ? await getPersonaQuote(personaId, lang) : null;

    const dims = FORMAT_DIMS[format as Format] ?? FORMAT_DIMS["9:16"];
    const zoneId = "A" as ZoneId;
    const primarySlotId = personaId
      ? (personaId + ":" + (personaHls[0]?.tone ?? "default"))
      : "default";

    // Build testimonial AdSpec
    const testimonialSpec: AdSpec = {
      id: newId("as"),
      imageId,
      format: format as Format,
      lang: lang as Language,
      familyId: "testimonial",
      templateId: testimonialId as AdSpec["templateId"],
      zoneId,
      primarySlotId,
      copy: {
        quote: personaQuote?.text ?? FALLBACK_QUOTE,
        ...(personaQuote?.attribution ? { attribution: personaQuote.attribution } : {}),
      },
      theme: {
        fontHeadline: "Playfair Display",
        fontSize: 90,
        color: "#FFFFFF",
        bg: "#000000",
        radius: 0,
        shadow: false,
      },
      renderMeta: dims,
      headlineYOverride: 0.1484,
      ...(cropX !== undefined ? { cropX } : {}),
    };

    // Build luxury AdSpec
    const luxuryHeadline = personaHls[0]?.headline ?? FALLBACK_HEADLINE;
    const luxurySpec: AdSpec = {
      id: newId("as"),
      imageId,
      format: format as Format,
      lang: lang as Language,
      familyId: "luxury",
      templateId: luxuryId as AdSpec["templateId"],
      zoneId,
      primarySlotId,
      copy: {
        headline: luxuryHeadline,
      },
      theme: {
        fontHeadline: "Playfair Display",
        fontSize: 90,
        color: "#FFFFFF",
        bg: "#000000",
        radius: 0,
        shadow: false,
      },
      renderMeta: dims,
      headlineYOverride: 0.1484,
      ...(cropX !== undefined ? { cropX } : {}),
    };

    // Build layout (ai_surprise) AdSpec
    const surprise = layoutPreset.spec as SurpriseSpec;
    const langCopy = (lang as Language) === "de" ? surprise.de : surprise.en;
    const chosenHeadline = personaHls[0]?.headline ?? FALLBACK_HEADLINE;
    const layoutSurprise: SurpriseSpec = {
      ...surprise,
      en: { headline: chosenHeadline, subtext: surprise.en.subtext },
      de: { headline: chosenHeadline, subtext: surprise.de.subtext },
    };
    const layoutCopy = lang === "de" ? layoutSurprise.de : layoutSurprise.en;

    const layoutSpec: AdSpec = {
      id: newId("as"),
      imageId,
      format: format as Format,
      lang: lang as Language,
      familyId: "ai",
      templateId: "ai_surprise",
      zoneId,
      primarySlotId: newId("surprise"),
      copy: {
        headline: layoutCopy.headline,
        subtext: layoutCopy.subtext,
      },
      theme: {
        fontHeadline: surprise.font === "sans" ? "Inter" : "Playfair Display",
        fontSize: 90,
        color: surprise.textColor,
        bg: surprise.bgColor,
        radius: 0,
        shadow: false,
      },
      surpriseSpec: layoutSurprise,
      renderMeta: dims,
      headlineYOverride: surprise.headlineYOverride ?? 0.1484,
      ...(cropX !== undefined ? { cropX } : {}),
    };

    // Render all 3 in parallel
    const [testimonialRender, luxuryRender, layoutRender] = await Promise.all([
      renderSpecToResult(testimonialSpec),
      renderSpecToResult(luxurySpec),
      renderSpecToResult(layoutSpec),
    ]);

    return NextResponse.json({
      results: [testimonialRender, luxuryRender, layoutRender],
    });
  } catch (err) {
    console.error("First drafts error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "First drafts failed" },
      { status: 500 }
    );
  }
}

async function renderSpecToResult(spec: AdSpec) {
  await insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
  const { pngUrl, renderResultId, cssSubjectPos } = await renderAd(spec);
  await insertRenderResult({
    id: renderResultId,
    adSpecId: spec.id,
    imageId: spec.imageId,
    familyId: spec.familyId,
    templateId: spec.templateId,
    primarySlotId: spec.primarySlotId,
    pngUrl,
  });
  return {
    id: renderResultId,
    adSpecId: spec.id,
    imageId: spec.imageId,
    familyId: spec.familyId,
    templateId: spec.templateId,
    primarySlotId: spec.primarySlotId,
    format: spec.format,
    pngUrl,
    approved: false,
    createdAt: new Date().toISOString(),
    headlineText: spec.copy.headline ?? spec.copy.quote,
    headlineFontScale: spec.surpriseSpec?.headlineFontScale ?? 1.0,
    headlineYOverride: spec.headlineYOverride,
    attribution: spec.copy.attribution,
    subjectPos: cssSubjectPos,
  };
}
