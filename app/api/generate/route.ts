import { NextRequest, NextResponse } from "next/server";
import { generateSurpriseSpec, generateSurpriseSpecFromReference } from "@/lib/ai/aiSurprise";
import {
  getImage,
  insertImage,
  insertAdSpec,
  insertRenderResult,
  getSavedAIStyles,
  getGlobalPersonaHeadlines,
  getPersonaQuote,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { getAllFamilies, getStylesForFamily, getTemplate } from "@/lib/templates";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, FamilyId, Language, Format, TemplateId, ZoneId, SurpriseSpec } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";
import sharp from "sharp";
import { read as readStorage } from "@/lib/storage";
import { sampleBrandZoneBrightness } from "@/lib/imageUtils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageId,
      imageUrl,
      imageWidth,
      imageHeight,
      familyIds,
      forceTemplateId,
      surpriseMe,
      savedSurpriseSpecId,
      forceSurpriseSpec,
      referenceImageBase64,
      referenceImageMimeType,
      lang = "en",
      format = "4:5",
      showBrand = false,
      scenePersonaId,
      personaId,
      cropX,
      cropY,
      headline,
      headlineYOverride,
      splitSecondImageId,
      splitDividerX,
      splitProductPanX,
      splitSecondPanX,
      splitSwapped,
    } = body as {
      imageId: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      familyIds?: FamilyId[];
      forceTemplateId?: string;
      surpriseMe?: boolean;
      savedSurpriseSpecId?: string;  // reuse saved layout without AI call
      forceSurpriseSpec?: SurpriseSpec; // use provided spec directly — no AI, no DB lookup
      referenceImageBase64?: string;    // base64 reference ad — triggers style-transfer spec generation
      referenceImageMimeType?: string;
      lang?: Language;
      format?: Format;
      showBrand?: boolean;
      scenePersonaId?: string;
      personaId?: string;
      cropX?: number;
      cropY?: number;
      headline?: string;
      headlineYOverride?: number;
      splitSecondImageId?: string;
      splitDividerX?: number;
      splitProductPanX?: number;
      splitSecondPanX?: number;
      splitSwapped?: boolean;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    let image = await getImage(imageId);
    if (!image) {
      // SQLite was reset (cold start) — re-seed from client-provided values
      if (!imageUrl) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      await insertImage({
        id: imageId,
        filename: imageId + ".png",
        url: imageUrl,
        width: imageWidth ?? 0,
        height: imageHeight ?? 0,
      });
      image = await getImage(imageId)!;
    }

    // ── Surprise Me path ────────────────────────────────────────────────────
    // Two sub-modes:
    //   surpriseMe=true          → fresh AI call (Haiku vision + random seeds)
    //   savedSurpriseSpecId=xxx  → reuse saved layout spec, pick copy from CopyPool
    if (surpriseMe || savedSurpriseSpecId || forceSurpriseSpec) {
      // safeZones no longer used — user controls crop position

      // 2. Get or generate the SurpriseSpec
      let surprise: SurpriseSpec;
      if (forceSurpriseSpec) {
        // Use provided spec directly — no AI call, no DB lookup (used for layout preview)
        surprise = forceSurpriseSpec;
        // Use global persona headline if available
        const personaHls = personaId
          ? await getGlobalPersonaHeadlines(personaId, lang)
          : [];
        const FALLBACK_HEADLINE = "The nails made for you";
        const chosenHeadline = headline ?? personaHls[0]?.headline ?? FALLBACK_HEADLINE;
        const subtext = surprise.en.subtext;
        surprise = { ...surprise, en: { headline: chosenHeadline, subtext }, de: { headline: chosenHeadline, subtext } };
      } else if (savedSurpriseSpecId) {
        // Reuse a previously saved layout — no AI call
        const allSaved = await getSavedAIStyles();
        const saved = allSaved.find((s) => s.id === savedSurpriseSpecId);
        if (!saved?.surprise_spec) {
          return NextResponse.json({ error: "Saved surprise style not found" }, { status: 404 });
        }
        surprise = JSON.parse(saved.surprise_spec) as SurpriseSpec;
        // Use global persona headline if available
        const personaHlsSaved = personaId
          ? await getGlobalPersonaHeadlines(personaId, lang)
          : [];
        const FALLBACK_HEADLINE = "The nails made for you";
        const chosenHeadline = headline ?? personaHlsSaved[0]?.headline ?? FALLBACK_HEADLINE;
        const subtext = surprise.en.subtext;
        surprise = { ...surprise, en: { headline: chosenHeadline, subtext }, de: { headline: chosenHeadline, subtext } };
      } else if (referenceImageBase64) {
        // Style-transfer: generate spec inspired by a reference ad image
        const refMime = (referenceImageMimeType ?? "jpeg") as "jpeg" | "png" | "gif" | "webp";
        surprise = await generateSurpriseSpecFromReference(imageId, referenceImageBase64, refMime);
      } else {
        // Fresh AI call
        surprise = await generateSurpriseSpec(imageId);
      }

      // 4. Auto-detect text color for clean_headline: sample brightness of the text zone
      if (surprise.layout === 'clean_headline') {
        const brightness = await sampleZoneBrightness(imageId);
        const textColor = brightness <= 128 ? '#FFFFFF' : '#1a1a1a';
        surprise = { ...surprise, textColor, accentColor: textColor };
      }

      // 4. Build AdSpec
      const dims = FORMAT_DIMS[format];
      const langCopy = lang === "de" ? surprise.de : surprise.en;
      const zoneId = "A" as ZoneId;

      const spec: AdSpec = {
        id: newId("as"),
        imageId,
        format,
        lang,
        familyId: "ai",
        templateId: "ai_surprise",
        zoneId,
        primarySlotId: newId("surprise"),
        copy: {
          headline: langCopy.headline,
          subtext:  langCopy.subtext,
        },
        theme: {
          fontHeadline: surprise.font === "sans" ? "Inter" : "Playfair Display",
          fontSize: 90,
          color: surprise.textColor,
          bg:    surprise.bgColor,
          radius: 0,
          shadow: false,
        },
        surpriseSpec: surprise,
        renderMeta: dims,
        showBrand,
        headlineYOverride: surprise.headlineYOverride ?? 0.1484,
        ...(cropX !== undefined ? { cropX } : {}),
      };

      await insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
      const { pngUrl, renderResultId, cssSubjectPos } = await renderAd(spec);
      await insertRenderResult({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        familyId: "ai",
        templateId: "ai_surprise",
        primarySlotId: spec.primarySlotId,
        pngUrl,
      });

      // subjectPos: use the CSS-equivalent of the sharp crop computed inside renderAd
      return NextResponse.json({
        results: [{
          id: renderResultId,
          adSpecId: spec.id,
          imageId: spec.imageId,
          familyId: "ai",
          templateId: "ai_surprise",
          primarySlotId: spec.primarySlotId,
          format: spec.format,
          pngUrl,
          approved: false,
          createdAt: new Date().toISOString(),
          headlineText: spec.copy.headline,
          headlineFontScale: spec.surpriseSpec?.headlineFontScale ?? 1.0,
          subjectPos: cssSubjectPos,
          attribution: spec.copy.attribution,
          headlineColor: spec.headlineColor ?? spec.surpriseSpec?.textColor ?? spec.theme?.color,
        }],
      });
    }
    // ── End Surprise Me path ─────────────────────────────────────────────────

    // safeZones no longer used — user controls crop position

    // forceTemplateId: exact template overrides all family logic
    const forcedTemplate = forceTemplateId
      ? getTemplate(forceTemplateId as TemplateId)
      : null;

    // use provided familyIds, or forceTemplate's family, or all registered families
    const families: FamilyId[] = forcedTemplate
      ? [forcedTemplate.familyId]
      : (familyIds?.length ? familyIds : getAllFamilies().map((f) => f.id));

    // 2. Get global persona headlines + quote
    const FALLBACK_HEADLINE = "The nails made for you";
    const FALLBACK_QUOTE = "These nails changed my routine.";
    const personaHls = personaId
      ? await getGlobalPersonaHeadlines(personaId, lang)
      : [];
    const personaQuote = personaId ? await getPersonaQuote(personaId, lang) : null;

    // 3. Create AdSpecs — 1 per family (random style picked per family)
    const dims = FORMAT_DIMS[format];
    const specs: AdSpec[] = [];

    let specIndex = 0;
    for (const familyId of families) {
      let stylesToUse = getStylesForFamily(familyId);
      if (forcedTemplate) {
        stylesToUse = [forcedTemplate];
      }

      for (const style of stylesToUse) {
        const zoneId = "A" as ZoneId;

        const toneRow = personaHls[specIndex % (personaHls.length || 1)];
        const primarySlotId = personaId
          ? (personaId + ":" + (toneRow?.tone ?? "default"))
          : "default";
        const copy: AdSpec["copy"] = {};
        for (const slotType of style.copySlots) {
          if (slotType === "quote") {
            copy.quote = personaQuote?.text ?? FALLBACK_QUOTE;
            if (personaQuote?.attribution) copy.attribution = personaQuote.attribution;
          } else if (slotType === "headline") {
            copy[slotType] = headline ?? toneRow?.headline ?? FALLBACK_HEADLINE;
          }
        }

        const spec: AdSpec = {
          id: newId("as"),
          imageId,
          format,
          lang,
          familyId,
          templateId: style.id,
          zoneId,
          primarySlotId,
          copy,
          theme: style.themeDefaults,
          renderMeta: dims,
          showBrand,
          headlineYOverride: headlineYOverride ?? 0.1484,
          ...(scenePersonaId ? { scenePersonaId } : {}),
          ...(personaId ? { personaId } : {}),
          ...(cropX !== undefined ? { cropX } : {}),
          ...(cropY !== undefined ? { cropY } : {}),
          ...(splitSecondImageId ? { splitSecondImageId } : {}),
          ...(splitDividerX !== undefined ? { splitDividerX } : {}),
          ...(splitProductPanX !== undefined ? { splitProductPanX } : {}),
          ...(splitSecondPanX !== undefined ? { splitSecondPanX } : {}),
          ...(splitSwapped !== undefined ? { splitSwapped } : {}),
          brandColor: showBrand ? (await sampleBrandZoneBrightness(imageId) <= 128 ? '#FFFFFF' : '#1a1a1a') : undefined,
        };

        specs.push(spec);
        specIndex++;
      }
    }

    // 4. Render each AdSpec → PNG
    const results = [];
    for (const spec of specs) {
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

      results.push({
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
        headlineColor: spec.headlineColor ?? spec.surpriseSpec?.textColor ?? spec.theme?.color,
        subjectPos: cssSubjectPos,

      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}



/**
 * Sample the average perceived brightness of the image in the clean_headline text zone.
 * Zone is proportional: x 9.26-90.74%, y 20.05-79.95% (from 1080x1920 reference).
 * Returns a value 0-255. Below 128 = dark background → white text.
 */
async function sampleZoneBrightness(imageId: string): Promise<number> {
  try {
    const img = await getImage(imageId);
    if (!img) return 255;
    const buf = await readStorage('uploads', img.url);
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1080;
    const ih = meta.height ?? 1920;
    const left   = Math.round(iw * 0.0926);
    const top    = Math.round(ih * 0.2005);
    const width  = Math.round(iw * 0.8148);
    const height = Math.round(ih * 0.5990); // zone height ~1150px
    const { data } = await sharp(buf)
      .extract({ left, top, width, height })
      .resize(64, 64, { fit: 'fill' }) // downsample for speed
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    const channels = data.length / (64 * 64);
    for (let i = 0; i < data.length; i += channels) {
      // Perceived luminance
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (64 * 64);
  } catch {
    return 255; // safe default: assume light bg
  }
}
