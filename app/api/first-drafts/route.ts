import { NextRequest, NextResponse } from "next/server";
import { getGlobalPersonaHeadlines, getPersonaQuote } from "@/lib/db";
import "@/lib/templates";
import type { Language, Format } from "@/lib/types";
import { LAYOUT_PREVIEWS } from "@/lib/layoutPresets";
import type { SurpriseSpec } from "@/lib/types";

export const maxDuration = 30;

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
      lang = "en",
      format = "9:16",
      personaId,
      excludeTemplateIds = [],
    } = body as {
      imageId: string;
      lang?: Language;
      format?: Format;
      personaId?: string;
      excludeTemplateIds?: string[];
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    // Pick 3 diverse styles
    const availableTestimonial = TESTIMONIAL_TEMPLATES.filter(t => !excludeTemplateIds.includes(t));
    const testimonialId = availableTestimonial.length > 0 ? pickRandom(availableTestimonial) : pickRandom(TESTIMONIAL_TEMPLATES);

    const availableLuxury = LUXURY_TEMPLATES.filter(t => !excludeTemplateIds.includes(t));
    const luxuryId = availableLuxury.length > 0 ? pickRandom(availableLuxury) : pickRandom(LUXURY_TEMPLATES);

    const usedLayouts = excludeTemplateIds;
    const availableLayouts = LAYOUT_PREVIEWS.filter(p => !usedLayouts.includes(p.layout));
    const layoutPreset = availableLayouts.length > 0 ? pickRandom(availableLayouts) : pickRandom(LAYOUT_PREVIEWS);

    // Fetch copy
    const FALLBACK_HEADLINE = "Made for you";
    const FALLBACK_QUOTE = "This changed my routine completely.";

    const personaHls = personaId ? await getGlobalPersonaHeadlines(personaId, lang) : [];
    const personaQuote = personaId ? await getPersonaQuote(personaId, lang) : null;

    const headline = personaHls[0]?.headline ?? FALLBACK_HEADLINE;
    const quote = personaQuote?.text ?? FALLBACK_QUOTE;
    const attribution = personaQuote?.attribution ?? "— Verified customer";

    // Build layout SurpriseSpec with persona headline
    const surprise = layoutPreset.spec as SurpriseSpec;
    const layoutSurprise: SurpriseSpec = {
      ...surprise,
      en: { headline, subtext: surprise.en.subtext },
      de: { headline, subtext: surprise.de.subtext },
    };

    return NextResponse.json({
      drafts: [
        {
          familyId: "testimonial",
          templateId: testimonialId,
          headline: quote,
          quote,
          attribution,
          surpriseSpec: undefined,
        },
        {
          familyId: "luxury",
          templateId: luxuryId,
          headline,
          surpriseSpec: undefined,
        },
        {
          familyId: "ai",
          templateId: "ai_surprise",
          headline,
          surpriseSpec: layoutSurprise,
        },
      ],
    });
  } catch (err) {
    console.error("First drafts error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "First drafts failed" },
      { status: 500 }
    );
  }
}
