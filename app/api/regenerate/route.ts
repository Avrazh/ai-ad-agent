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
import type { AdSpec, SafeZones, CopyPool, CopySlot } from "@/lib/types";

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

    const lang = oldSpec.lang ?? "en";
    const langSlots = copyPool.slots.filter((s: CopySlot) => s.lang === lang);

    // 3. Build new spec based on mode
    let newTemplateId = oldSpec.templateId;
    let newZoneId = oldSpec.zoneId;
    let newPrimarySlotId = oldSpec.primarySlotId;
    let newCopy = { ...oldSpec.copy };

    if (mode === "style") {
      // Pick a different style within the same family, keep copy if slot types match
      const newStyle = pickDifferentStyle(oldSpec.familyId, oldSpec.templateId);
      newTemplateId = newStyle.id;
      const otherZones = newStyle.supportedZones.filter((z: string) => z !== oldSpec.zoneId);
      newZoneId =
        otherZones.length > 0
          ? otherZones[Math.floor(Math.random() * otherZones.length)]
          : newStyle.supportedZones[0];

      // Rebuild copy for the new template's slot types
      newCopy = {};
      newPrimarySlotId = oldSpec.primarySlotId;
      let primarySlot: CopySlot | undefined;

      for (let i = 0; i < newStyle.copySlots.length; i++) {
        const slotType = newStyle.copySlots[i];
        const typeSlots = langSlots.filter((s: CopySlot) => s.slotType === slotType);

        if (i === 0) {
          // Keep same primary slot if its type matches; otherwise pick new one
          const existing = typeSlots.find((s: CopySlot) => s.id === oldSpec.primarySlotId);
          const slot = existing ?? typeSlots[0];
          if (slot) {
            newPrimarySlotId = slot.id;
            primarySlot = slot;
            newCopy[slotType] = slot.text;
            if (slot.attribution) newCopy.attribution = slot.attribution;
          }
        } else {
          // Secondary slots — match primary slot's angle for tonal consistency
          const targetAngle = primarySlot?.angle;
          const slot = (targetAngle
            ? typeSlots.find((s: CopySlot) => s.angle === targetAngle)
            : null) ?? typeSlots[0];
          if (slot) {
            newCopy[slotType] = slot.text;
            if (slot.attribution) newCopy.attribution = slot.attribution;
          }
        }
      }
    }

    if (mode === "headline") {
      // Pick a different primary slot in the same language, prefer a different angle
      const currentTemplate = getTemplate(oldSpec.templateId);
      const primarySlotType = currentTemplate.copySlots[0] ?? "headline";
      const langPrimarySlots = langSlots.filter(
        (s: CopySlot) => s.slotType === primarySlotType
      );
      const candidates = langPrimarySlots.filter((s: CopySlot) => s.id !== oldSpec.primarySlotId);

      let newPrimary: CopySlot | undefined;
      if (candidates.length > 0) {
        const currentSlot = langPrimarySlots.find((s: CopySlot) => s.id === oldSpec.primarySlotId);
        const currentAngle = currentSlot?.angle;
        const differentAngle = candidates.filter((s: CopySlot) => s.angle !== currentAngle);
        newPrimary =
          differentAngle.length > 0
            ? differentAngle[Math.floor(Math.random() * differentAngle.length)]
            : candidates[Math.floor(Math.random() * candidates.length)];
      }

      if (newPrimary) {
        newPrimarySlotId = newPrimary.id;
        newCopy = { ...oldSpec.copy, [primarySlotType]: newPrimary.text };
        if (newPrimary.attribution) newCopy.attribution = newPrimary.attribution;
        else delete newCopy.attribution;

        // Re-pick secondary slots to match the new primary's angle
        for (let i = 1; i < currentTemplate.copySlots.length; i++) {
          const slotType = currentTemplate.copySlots[i];
          const typeSlots = langSlots.filter((s: CopySlot) => s.slotType === slotType);
          const targetAngle = newPrimary.angle;
          const slot = (targetAngle
            ? typeSlots.find((s: CopySlot) => s.angle === targetAngle)
            : null) ?? typeSlots[0];
          if (slot) {
            newCopy[slotType] = slot.text;
            if (slot.attribution) newCopy.attribution = slot.attribution;
          }
        }
      }

      // Also randomize zone (keep same style)
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
      lang,
      familyId: oldSpec.familyId,
      templateId: newTemplateId,
      zoneId: newZoneId,
      primarySlotId: newPrimarySlotId,
      copy: newCopy,
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
      primarySlotId: newSpec.primarySlotId,
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
        primarySlotId: newSpec.primarySlotId,
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
