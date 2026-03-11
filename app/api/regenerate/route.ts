// HARD RULE: This route MUST NEVER import from '@/lib/ai/'.
// It only reads STORED SafeZones + CopyPool from SQLite.
// If this file ever imports from 'lib/ai/', it's a bug.

import { NextRequest, NextResponse } from "next/server";
import { pickBestZone } from "@/app/api/generate/route";
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

    // 2. Load STORED CopyPool + SafeZones (never generate new ones)
    const safeZonesJson = await getSafeZones(oldSpec.imageId);
    const copyPoolJson = await getCopyPool(oldSpec.imageId);
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
      newZoneId = pickBestZone(safeZones, newStyle.supportedZones, oldSpec.zoneId);

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
      // Pick a different primary slot in the same language
      const currentTemplate = getTemplate(oldSpec.templateId);
      const primarySlotType = currentTemplate.copySlots[0] ?? "headline";
      const langPrimarySlots = langSlots.filter(
        (s: CopySlot) => s.slotType === primarySlotType
      );

      // "Your own" headline: user supplied text — bypass slot picker
      if (angle === "own" && customHeadline) {
        newPrimarySlotId = "own";
        newCopy = { ...oldSpec.copy, [primarySlotType]: customHeadline };
        delete newCopy.subtext;
      } else {
      let newPrimary: CopySlot | undefined;
      if (angle) {
        // Tone stage: user requested a specific angle — pick a slot of that angle,
        // prefer one different from current; wrap around if all used.
        const angleSlots = langPrimarySlots.filter((s: CopySlot) => s.angle === angle);
        const different = angleSlots.filter((s: CopySlot) => s.id !== oldSpec.primarySlotId);
        newPrimary =
          different.length > 0
            ? different[Math.floor(Math.random() * different.length)]
            : angleSlots[Math.floor(Math.random() * angleSlots.length)];
      } else {
        // Default "New Headline": prefer a different angle from current
        const candidates = langPrimarySlots.filter((s: CopySlot) => s.id !== oldSpec.primarySlotId);
        if (candidates.length > 0) {
          const currentSlot = langPrimarySlots.find((s: CopySlot) => s.id === oldSpec.primarySlotId);
          const currentAngle = currentSlot?.angle;
          const differentAngle = candidates.filter((s: CopySlot) => s.angle !== currentAngle);
          newPrimary =
            differentAngle.length > 0
              ? differentAngle[Math.floor(Math.random() * differentAngle.length)]
              : candidates[Math.floor(Math.random() * candidates.length)];
        }
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

      // Pick best zone (keep same style, prefer different from current)
        newZoneId = pickBestZone(safeZones, currentTemplate.supportedZones, oldSpec.zoneId);
      } // end else (not "own")
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
      brandColor: oldSpec.brandColor,
    };

    // 4. Store new AdSpec
    await insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));

    // 5. Render new PNG
    const { pngUrl, renderResultId } = await renderAd(newSpec, safeZones);

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
