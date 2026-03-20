import { NextRequest, NextResponse } from "next/server";
import {
  getRenderResult,
  getAdSpec,
  insertAdSpec,
  insertRenderResult,
  markReplaced,
} from "@/lib/db";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec } from "@/lib/types";
import { sampleBrandZoneBrightness } from "@/lib/imageUtils";

export async function POST(req: NextRequest) {
  try {
    const { resultId, headlineYOverride, headlineFontScale, brandNameY, brandNameFontScale, headlineFont, showBrand, headlineColor, brandColor, headlineOverride, splitSecondImageId, splitDividerX, splitProductPanX, splitSecondPanX, splitSwapped, textBoxes, hideHeadline } = await req.json() as {
      resultId: string;
      headlineYOverride: number;
      headlineFontScale?: number;
      brandNameY?: number;
      brandNameFontScale?: number;
      headlineFont?: string;
      showBrand?: boolean;
      headlineColor?: string;
      brandColor?: string;
      headlineOverride?: string;
      splitSecondImageId?: string;
      splitDividerX?: number;
      splitProductPanX?: number;
      splitSecondPanX?: number;
      splitSwapped?: boolean;
      textBoxes?: import("@/lib/types").TextBox[];
      hideHeadline?: boolean;
    };
    if (!resultId || headlineYOverride === undefined) {
      return NextResponse.json({ error: "resultId and headlineYOverride required" }, { status: 400 });
    }

    const oldResult = await getRenderResult(resultId);
    if (!oldResult) return NextResponse.json({ error: "Result not found" }, { status: 404 });
    const oldSpecRow = await getAdSpec(oldResult.ad_spec_id);
    if (!oldSpecRow) return NextResponse.json({ error: "AdSpec not found" }, { status: 404 });
    const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

    const fontScale = headlineFontScale ?? oldSpec.surpriseSpec?.headlineFontScale ?? 1.0;
    const newSpecId = newId("sp");
    const newSpec: AdSpec = {
      ...oldSpec,
      id: newSpecId,
      headlineYOverride,
      headlineFontScale: fontScale,
      ...(brandNameY !== undefined ? { brandNameY } : {}),
      ...(brandNameFontScale !== undefined ? { brandNameFontScale } : {}),
      ...(showBrand !== undefined ? { showBrand } : {}),
      ...(headlineFont !== undefined ? { headlineFont } : {}),
      ...(headlineFont === undefined && oldSpec.headlineFont ? { headlineFont: oldSpec.headlineFont } : {}),
      ...(oldSpec.surpriseSpec ? {
        surpriseSpec: {
          ...oldSpec.surpriseSpec,
          headlineYOverride,
          headlineFontScale: fontScale,
        },
      } : {}),
      ...(headlineColor !== undefined ? { headlineColor } : {}),
      ...(splitSecondImageId !== undefined ? { splitSecondImageId } : {}),
      ...(splitDividerX !== undefined ? { splitDividerX } : {}),
      ...(splitProductPanX !== undefined ? { splitProductPanX } : {}),
      ...(splitSecondPanX !== undefined ? { splitSecondPanX } : {}),
      ...(splitSwapped !== undefined ? { splitSwapped } : {}),
      ...(textBoxes !== undefined ? { textBoxes } : {}),
      ...(hideHeadline !== undefined ? { hideHeadline } : {}),
    };

    if (headlineOverride !== undefined) {
      newSpec.copy = { ...newSpec.copy, headline: headlineOverride };
    }

    // Use explicit brand color if provided, otherwise re-sample at the dragged Y position
    if (brandColor !== undefined) {
      newSpec.brandColor = brandColor;
    } else if (brandNameY !== undefined && newSpec.showBrand) {
      const brightness = await sampleBrandZoneBrightness(newSpec.imageId, brandNameY);
      newSpec.brandColor = brightness <= 128 ? '#FFFFFF' : '#1a1a1a';
    }

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

    const subjectPos = cssSubjectPos;

    return NextResponse.json({
      ok: true,
      result: {
        id: renderResultId,
        adSpecId: newSpec.id,
        pngUrl,
        templateId: newSpec.templateId,
        familyId: newSpec.familyId,
        lang: newSpec.lang,
        format: newSpec.format,
        headlineText: newSpec.copy.headline,
        headlineFontScale: fontScale,
        headlineYOverride: headlineYOverride,
        brandNameY: newSpec.brandNameY,
        brandNameFontScale: newSpec.brandNameFontScale,
        headlineColor: newSpec.headlineColor,
        brandColor: newSpec.brandColor,
        textBoxes: newSpec.textBoxes,
        hideHeadline: newSpec.hideHeadline,
        subjectPos,
      },
    });
  } catch (err) {
    console.error("[reposition]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
