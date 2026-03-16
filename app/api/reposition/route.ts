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

export async function POST(req: NextRequest) {
  try {
    const { resultId, headlineYOverride, headlineFontScale, brandNameY, brandNameFontScale } = await req.json() as {
      resultId: string;
      headlineYOverride: number;
      headlineFontScale?: number;
      brandNameY?: number;
      brandNameFontScale?: number;
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
      ...(brandNameY !== undefined ? { brandNameY } : {}),
      ...(brandNameFontScale !== undefined ? { brandNameFontScale } : {}),
      ...(oldSpec.surpriseSpec ? {
        surpriseSpec: {
          ...oldSpec.surpriseSpec,
          headlineYOverride,
          headlineFontScale: fontScale,
        },
      } : {}),
    };

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
        subjectPos,
      },
    });
  } catch (err) {
    console.error("[reposition]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
