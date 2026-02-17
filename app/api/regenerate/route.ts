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
import { getTemplate } from "@/lib/templates";
import "@/lib/templates"; // ensure templates registered
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { AdSpec, SafeZones, CopyPool, TemplateId } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultId, mode } = body as {
      resultId: string;
      mode: "headline" | "template" | "both";
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

    if (mode === "template" || mode === "both") {
      // Swap to the other template
      newTemplateId =
        oldSpec.templateId === "boxed_text" ? "chat_bubble" : "boxed_text";

      // Pick a different zone
      const template = getTemplate(newTemplateId);
      const otherZones = template.supportedZones.filter(
        (z) => z !== oldSpec.zoneId
      );
      newZoneId =
        otherZones[Math.floor(Math.random() * otherZones.length)] ??
        oldSpec.zoneId;
    }

    if (mode === "headline" || mode === "both") {
      // Pick a different headline, rotating across angles
      const candidates = copyPool.headlines.filter(
        (h) => h.id !== oldSpec.headlineId
      );
      if (candidates.length > 0) {
        // Try to pick a different angle first
        const currentAngle = copyPool.headlines.find(
          (h) => h.id === oldSpec.headlineId
        )?.angle;
        const differentAngle = candidates.filter(
          (h) => h.angle !== currentAngle
        );
        const pick =
          differentAngle.length > 0
            ? differentAngle[
                Math.floor(Math.random() * differentAngle.length)
              ]
            : candidates[Math.floor(Math.random() * candidates.length)];
        newHeadlineId = pick.id;
        newHeadlineText = pick.text;
      }
    }

    const newTemplate = getTemplate(newTemplateId);

    const newSpec: AdSpec = {
      id: newId("as"),
      imageId: oldSpec.imageId,
      format: oldSpec.format,
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
        templateId: newSpec.templateId,
        headlineId: newSpec.headlineId,
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
