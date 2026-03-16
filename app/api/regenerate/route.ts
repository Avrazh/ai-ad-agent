// HARD RULE: This route MUST NEVER import from '@/lib/ai/'.
// It only reads STORED SafeZones + CopyPool from SQLite.
// If this file ever imports from 'lib/ai/', it's a bug.

import { NextRequest, NextResponse } from "next/server";
import {
  getRenderResult,
  getAdSpec,
  getGlobalPersonaHeadlines,
  insertAdSpec,
  insertRenderResult,
  markReplaced,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { getTemplate, pickDifferentStyle } from "@/lib/templates";
import { renderAd, getCachedSubjectPos } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultId, mode, angle, customHeadline } = body as {
      resultId: string;
      mode: "headline" | "style";
      angle?: string; // specific tone angle requested from the UI Tone stage
      customHeadline?: string; // user-typed headline for angle="own"
    };

    if (!resultId || !mode) {
      return NextResponse.json(
        { error: "resultId and mode required" },
        { status: 400 }
      );
    }

    // 1. Load existing result + AdSpec
    const oldResult = await getRenderResult(resultId);
    if (!oldResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const oldSpecRow = await getAdSpec(oldResult.ad_spec_id);
    if (!oldSpecRow) {
      return NextResponse.json({ error: "AdSpec not found" }, { status: 404 });
    }
    const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

    // 2. Load persona headlines
    const lang = oldSpec.lang ?? "en";
    const personaHls = oldSpec.personaId
      ? await getGlobalPersonaHeadlines(oldSpec.personaId, lang)
      : [];

    // 3. Build new spec based on mode
    let newTemplateId = oldSpec.templateId;
    let newZoneId = oldSpec.zoneId;
    let newPrimarySlotId = oldSpec.primarySlotId;
    let newCopy = { ...oldSpec.copy };

    if (mode === "style") {
      const newStyle = pickDifferentStyle(oldSpec.familyId, oldSpec.templateId);
      newTemplateId = newStyle.id;
      newZoneId = "A";
      newPrimarySlotId = oldSpec.primarySlotId;
      newCopy = { ...oldSpec.copy };
    }

    if (mode === "headline") {
      const currentTemplate = getTemplate(oldSpec.templateId);
      const primarySlotType = currentTemplate.copySlots[0] ?? "headline";

      if (angle === "own" && customHeadline) {
        newPrimarySlotId = "own";
        newCopy = { ...oldSpec.copy, [primarySlotType]: customHeadline };
        delete newCopy.subtext;
      } else {
        const currentTone = oldSpec.primarySlotId?.split(":")[1];
        const nextRow = personaHls.find((r) => r.tone !== currentTone) ?? personaHls[0];
        if (nextRow) {
          newPrimarySlotId = oldSpec.personaId
            ? (oldSpec.personaId + ":" + nextRow.tone)
            : "default";
          newCopy = { ...oldSpec.copy, [primarySlotType]: nextRow.headline };
          delete newCopy.subtext;
        }
        newZoneId = "A";
      }
    }

    const newTemplate = getTemplate(newTemplateId);

    const newSpec: AdSpec = {
      id: newId("as"),
      imageId: oldSpec.imageId,
      format: oldSpec.format,
      lang,
      familyId: oldSpec.familyId,
      templateId: newTemplateId,
      zoneId: newZoneId,
      primarySlotId: newPrimarySlotId,
      copy: newCopy,
      // Preserve AI-generated theme + surpriseSpec when regenerating a surprise ad
      theme: oldSpec.surpriseSpec ? oldSpec.theme : newTemplate.themeDefaults,
      ...(oldSpec.surpriseSpec && newTemplateId === "ai_surprise"
        ? { surpriseSpec: oldSpec.surpriseSpec }
        : {}),
      renderMeta: oldSpec.renderMeta,
      showBrand: oldSpec.showBrand,
      ...(oldSpec.cropX !== undefined ? { cropX: oldSpec.cropX } : {}),
      brandColor: oldSpec.brandColor,
      ...(oldSpec.scenePersonaId ? { scenePersonaId: oldSpec.scenePersonaId } : {}),
    };

    // 4. Store new AdSpec
    await insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));

    // 5. For headline-only changes: skip Puppeteer re-render — headline is rendered
    // as a CSS overlay by LiveAdCanvas, so the PNG is not needed for the UI preview.
    // Reuse the existing PNG; style changes still trigger a full re-render.
    const renderResultId = newId("rr");
    let pngUrl: string;
    let subjectPos: string;

    if (mode === "headline") {
      pngUrl = oldResult.png_url;
      subjectPos = getCachedSubjectPos(newSpec.imageId, newSpec.renderMeta.w, newSpec.renderMeta.h, newSpec.cropX) ?? "50% 50%";
    } else {
      const rendered = await renderAd(newSpec);
      pngUrl = rendered.pngUrl;
      subjectPos = rendered.cssSubjectPos;
    }

    // 6. Store new result, mark old as replaced
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
        attribution: newSpec.copy.attribution,
        subjectPos,
      },
      replacedId: resultId,
    });
  } catch (err) {
    console.error("Regenerate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 500 }
    );
  }
}
