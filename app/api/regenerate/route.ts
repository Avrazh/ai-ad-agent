// HARD RULE: This route MUST NEVER import from '@/lib/ai/'.
// It only reads STORED SafeZones + CopyPool from SQLite.
// If this file ever imports from 'lib/ai/', it's a bug.

import { NextRequest, NextResponse } from "next/server";
import {
  getRenderResult,
  getAdSpec,
  getSafeZones,
  getCopyPool,
  insertAdSpec,
  insertRenderResult,
  markReplaced,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { getTemplate, pickDifferentStyle } from "@/lib/templates";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, SafeZones, CopyPool } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultId, mode } = body as {
      resultId: string;
      mode: "headline" | "style";
    };

    if (!resultId || !mode) {
      return NextResponse.json(
        { error: "resultId and mode required" },
        { status: 400 }
      );
    }

    // 1. Load existing result + AdSpec
    const oldResult = getRenderResult(resultId);
    if (!oldResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    const oldSpecRow = getAdSpec(oldResult.ad_spec_id);
    if (!oldSpecRow) {
      return NextResponse.json({ error: "AdSpec not found" }, { status: 404 });
    }
    const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

    // 2. Load STORED CopyPool + SafeZones (never generate new ones)
    const safeZonesJson = getSafeZones(oldSpec.imageId);
    const copyPoolJson = getCopyPool(oldSpec.imageId);
    if (!safeZonesJson || !copyPoolJson) {
      return NextResponse.json(
        { error: "No stored AI data found — generate first" },
        { status: 400 }
      );
    }
    const safeZones: SafeZones = JSON.parse(safeZonesJson);
    const copyPool: CopyPool = JSON.parse(copyPoolJson);

    // 3. Build new spec based on mode
    let newTemplateId = oldSpec.templateId;
    let newZoneId = oldSpec.zoneId;
    let newHeadlineId = oldSpec.headlineId;
    let newHeadlineText = oldSpec.headlineText;

    if (mode === "style") {
      // Pick a different style within the same family, keep headline
      const newStyle = pickDifferentStyle(oldSpec.familyId, oldSpec.templateId);
      newTemplateId = newStyle.id;
      // Pick a zone from the new style
      const otherZones = newStyle.supportedZones.filter((z: string) => z !== oldSpec.zoneId);
      newZoneId =
        otherZones.length > 0
          ? otherZones[Math.floor(Math.random() * otherZones.length)]
          : newStyle.supportedZones[0];
    }

    if (mode === "headline") {
      // Pick a different headline in the same language, prefer a different angle
      const langHeadlines = copyPool.headlines.filter(
        (h) => h.lang === (oldSpec.lang ?? "en")
      );
      const candidates = langHeadlines.filter((h) => h.id !== oldSpec.headlineId);
      if (candidates.length > 0) {
        const currentAngle = langHeadlines.find((h) => h.id === oldSpec.headlineId)?.angle;
        const differentAngle = candidates.filter((h) => h.angle !== currentAngle);
        const pick =
          differentAngle.length > 0
            ? differentAngle[Math.floor(Math.random() * differentAngle.length)]
            : candidates[Math.floor(Math.random() * candidates.length)];
        newHeadlineId = pick.id;
        newHeadlineText = pick.text;
      }
      // Also randomize zone (keep same style)
      const currentTemplate = getTemplate(oldSpec.templateId);
      const otherZones = currentTemplate.supportedZones.filter((z) => z !== oldSpec.zoneId);
      if (otherZones.length > 0) {
        newZoneId = otherZones[Math.floor(Math.random() * otherZones.length)];
      }
    }

    const newTemplate = getTemplate(newTemplateId);

    const newSpec: AdSpec = {
      id: newId("as"),
      imageId: oldSpec.imageId,
      format: oldSpec.format,
      lang: oldSpec.lang ?? "en",
      familyId: oldSpec.familyId,
      templateId: newTemplateId,
      zoneId: newZoneId,
      headlineId: newHeadlineId,
      headlineText: newHeadlineText,
      theme: newTemplate.themeDefaults,
      renderMeta: oldSpec.renderMeta,
    };

    // 4. Store new AdSpec
    insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));

    // 5. Render new PNG
    const { pngUrl, renderResultId } = await renderAd(newSpec, safeZones);

    // 6. Store new result, mark old as replaced
    insertRenderResult({
      id: renderResultId,
      adSpecId: newSpec.id,
      imageId: newSpec.imageId,
      familyId: newSpec.familyId,
      templateId: newSpec.templateId,
      headlineId: newSpec.headlineId,
      pngUrl,
    });
    markReplaced(resultId, renderResultId);

    return NextResponse.json({
      result: {
        id: renderResultId,
        adSpecId: newSpec.id,
        imageId: newSpec.imageId,
        familyId: newSpec.familyId,
        templateId: newSpec.templateId,
        headlineId: newSpec.headlineId,
        format: newSpec.format,
        pngUrl,
        approved: false,
        createdAt: new Date().toISOString(),
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
