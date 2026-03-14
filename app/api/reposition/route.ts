import { NextRequest, NextResponse } from "next/server";
import {
  getRenderResult,
  getAdSpec,
  getSafeZones,
  insertAdSpec,
  insertRenderResult,
  markReplaced,
} from "@/lib/db";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, SafeZones } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { resultId, headlineYOverride } = await req.json() as { resultId: string; headlineYOverride: number };
    if (!resultId || headlineYOverride === undefined) {
      return NextResponse.json({ error: "resultId and headlineYOverride required" }, { status: 400 });
    }

    // Load existing result + spec
    const oldResult = await getRenderResult(resultId);
    if (!oldResult) return NextResponse.json({ error: "Result not found" }, { status: 404 });
    const oldSpecRow = await getAdSpec(oldResult.ad_spec_id);
    if (!oldSpecRow) return NextResponse.json({ error: "AdSpec not found" }, { status: 404 });
    const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

    // Load safe zones (no AI calls)
    const zonesJson = await getSafeZones(oldSpec.imageId);
    if (!zonesJson) return NextResponse.json({ error: "Safe zones not found" }, { status: 404 });
    const safeZones: SafeZones = JSON.parse(zonesJson);

    // Clone spec with override
    const newSpecId = newId("sp");
    const newSpec: AdSpec = {
      ...oldSpec,
      id: newSpecId,
      headlineYOverride,
      ...(oldSpec.surpriseSpec ? { surpriseSpec: { ...oldSpec.surpriseSpec, headlineYOverride } } : {}),
    };

    await insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));
    const { pngUrl, renderResultId } = await renderAd(newSpec, safeZones);
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
      },
    });
  } catch (err) {
    console.error("[reposition]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
