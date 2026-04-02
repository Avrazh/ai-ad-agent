// HARD RULE: This route MUST NEVER import from '@/lib/ai/'.
// It only reads stored AdSpec data from SQLite.
// If this file ever imports from 'lib/ai/', it's a bug.

import { NextRequest, NextResponse } from "next/server";
import { sampleBrandZoneBrightness } from "@/lib/imageUtils";
import {
  getRenderResult,
  getAdSpec,
  insertAdSpec,
  insertRenderResult,
  markReplaced,
} from "@/lib/db";
import { getTemplate } from "@/lib/templates";
import "@/lib/templates"; // ensure templates registered
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, Language, Format } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultIds, lang, format, showBrand } = body as {
      resultIds: string[];
      lang?: Language;
      format?: Format;
      showBrand?: boolean;
    };

    if (!resultIds?.length) {
      return NextResponse.json({ error: "resultIds required" }, { status: 400 });
    }
    if (!lang && !format) {
      return NextResponse.json(
        { error: "lang or format required" },
        { status: 400 }
      );
    }

    const results: { replacedId: string; result: Record<string, unknown> }[] = [];

    for (const resultId of resultIds) {
      // 1. Load old result + spec
      const oldResult = await getRenderResult(resultId);
      if (!oldResult) continue;

      const oldSpecRow = await getAdSpec(oldResult.ad_spec_id);
      if (!oldSpecRow) continue;
      const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

      // 2. Determine new values
      const newLang = lang ?? oldSpec.lang;
      const newFormat = format ?? oldSpec.format;
      const newDims = FORMAT_DIMS[newFormat];

      // 3. For lang switch on ai_surprise: swap copy from surpriseSpec buckets
      let newCopy = { ...oldSpec.copy };
      let newSurpriseSpec = oldSpec.surpriseSpec;

      if (lang && lang !== oldSpec.lang && oldSpec.surpriseSpec) {
        const langCopy = newLang === "de" ? oldSpec.surpriseSpec.de : oldSpec.surpriseSpec.en;
        newCopy = { headline: langCopy.headline, subtext: langCopy.subtext };
        newSurpriseSpec = {
          ...oldSpec.surpriseSpec,
          en: newLang === "en"
            ? { headline: newCopy.headline ?? oldSpec.surpriseSpec.en.headline, subtext: newCopy.subtext ?? oldSpec.surpriseSpec.en.subtext }
            : oldSpec.surpriseSpec.en,
          de: newLang === "de"
            ? { headline: newCopy.headline ?? oldSpec.surpriseSpec.de.headline, subtext: newCopy.subtext ?? oldSpec.surpriseSpec.de.subtext }
            : oldSpec.surpriseSpec.de,
        };
      }
      // For non-surprise layouts: headline stays unchanged — it is independent state

      // 4. Build new AdSpec — preserve cropX and headline position
      const newSpec: AdSpec = {
        id: newId("as"),
        imageId: oldSpec.imageId,
        format: newFormat,
        lang: newLang,
        familyId: oldSpec.familyId,
        templateId: oldSpec.templateId,
        zoneId: oldSpec.zoneId,
        primarySlotId: oldSpec.primarySlotId,
        copy: newCopy,
        theme: oldSpec.theme,
        renderMeta: newDims,
        ...(newSurpriseSpec ? { surpriseSpec: newSurpriseSpec } : {}),
        showBrand: showBrand !== undefined ? showBrand : oldSpec.showBrand,
        brandColor: showBrand !== undefined
          ? (showBrand ? (await sampleBrandZoneBrightness(oldSpec.imageId) <= 128 ? "#FFFFFF" : "#1a1a1a") : undefined)
          : oldSpec.brandColor,
        ...(oldSpec.headlineYOverride !== undefined ? { headlineYOverride: oldSpec.headlineYOverride } : {}),
        ...(oldSpec.brandNameY !== undefined ? { brandNameY: oldSpec.brandNameY } : {}),
        ...(oldSpec.brandNameFontScale !== undefined ? { brandNameFontScale: oldSpec.brandNameFontScale } : {}),
        ...(oldSpec.cropX !== undefined ? { cropX: oldSpec.cropX } : {}),
        ...(oldSpec.cropY !== undefined ? { cropY: oldSpec.cropY } : {}),
        ...(oldSpec.personaId ? { personaId: oldSpec.personaId } : {}),
      };

      // 5. Store + render + link
      await insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));
      const { pngUrl, renderResultId, cssSubjectPos } = await renderAd(newSpec);
      await insertRenderResult({
        id: renderResultId,
        adSpecId: newSpec.id,
        imageId: newSpec.imageId,
        familyId: newSpec.familyId,
        templateId: newSpec.templateId,
        primarySlotId: newSpec.primarySlotId,
        pngUrl,
      });
      await markReplaced(resultId, renderResultId);

      results.push({
        replacedId: resultId,
        result: {
          id: renderResultId,
          adSpecId: newSpec.id,
          imageId: newSpec.imageId,
          familyId: newSpec.familyId,
          templateId: newSpec.templateId,
          primarySlotId: newSpec.primarySlotId,
          format: newSpec.format,
          pngUrl,
          approved: false,
          createdAt: new Date().toISOString(),
          headlineText: newSpec.copy.headline ?? newSpec.copy.quote,
          headlineFontScale: newSpec.surpriseSpec?.headlineFontScale ?? 1.0,
          headlineYOverride: newSpec.headlineYOverride,
          brandNameY: newSpec.brandNameY,
          brandNameFontScale: newSpec.brandNameFontScale,
          attribution: newSpec.copy.attribution,
          subjectPos: cssSubjectPos,
        },
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Switch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Switch failed" },
      { status: 500 }
    );
  }
}
