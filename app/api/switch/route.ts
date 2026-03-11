// HARD RULE: This route MUST NEVER import from '@/lib/ai/'.
// It only reads STORED SafeZones + CopyPool from SQLite.
// If this file ever imports from 'lib/ai/', it's a bug.

import { NextRequest, NextResponse } from "next/server";
import { sampleBrandZoneBrightness } from "@/app/api/generate/route";
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
import type { AdSpec, SafeZones, CopyPool, CopySlot, Language, Format } from "@/lib/types";
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

      // 2. Load stored data (never generate new ones)
      const safeZonesJson = await getSafeZones(oldSpec.imageId);
      const copyPoolJson = await getCopyPool(oldSpec.imageId);
      if (!safeZonesJson || !copyPoolJson) continue;
      const safeZones: SafeZones = JSON.parse(safeZonesJson);
      const copyPool: CopyPool = JSON.parse(copyPoolJson);

      // 3. Determine new values
      const newLang = lang ?? oldSpec.lang;
      const newFormat = format ?? oldSpec.format;
      const newDims = FORMAT_DIMS[newFormat];

      // 4. Rebuild copy for new language (angle-matched)
      let newPrimarySlotId = oldSpec.primarySlotId;
      let newCopy = { ...oldSpec.copy };
      let newSurpriseSpec = oldSpec.surpriseSpec;

      if (lang && lang !== oldSpec.lang) {
        if (oldSpec.surpriseSpec) {
          // ai_surprise: copy lives in surpriseSpec.en / .de — swap language bucket
          const langCopy = newLang === "de" ? oldSpec.surpriseSpec.de : oldSpec.surpriseSpec.en;
          newCopy = { headline: langCopy.headline, subtext: langCopy.subtext };
          // Also try to pull from CopyPool for richer copy (same pattern as generate route)
          const langSlots = copyPool.slots.filter((s: CopySlot) => s.lang === newLang);
          const headlineSlots = langSlots.filter((s: CopySlot) => s.slotType === "headline");
          const hlSlot = headlineSlots.find((s: CopySlot) => s.angle === "aspirational")
            ?? headlineSlots[0];
          const stSlot = langSlots.find((s: CopySlot) => s.slotType === "subtext");
          if (hlSlot) newCopy.headline = hlSlot.text;
          if (stSlot) newCopy.subtext = stSlot.text;
          // Keep surpriseSpec in sync with the displayed copy
          newSurpriseSpec = {
            ...oldSpec.surpriseSpec,
            en: newLang === "en" ? { headline: newCopy.headline ?? oldSpec.surpriseSpec.en.headline, subtext: newCopy.subtext ?? oldSpec.surpriseSpec.en.subtext } : oldSpec.surpriseSpec.en,
            de: newLang === "de" ? { headline: newCopy.headline ?? oldSpec.surpriseSpec.de.headline, subtext: newCopy.subtext ?? oldSpec.surpriseSpec.de.subtext } : oldSpec.surpriseSpec.de,
          };
        } else {
          const template = getTemplate(oldSpec.templateId);
          const langSlots = copyPool.slots.filter((s: CopySlot) => s.lang === newLang);
          const oldPrimary = copyPool.slots.find((s: CopySlot) => s.id === oldSpec.primarySlotId);
          const targetAngle = oldPrimary?.angle;

          newCopy = {};
          let primarySlot: CopySlot | undefined;

          for (let i = 0; i < template.copySlots.length; i++) {
            const slotType = template.copySlots[i];
            const typeSlots = langSlots.filter((s: CopySlot) => s.slotType === slotType);

            if (i === 0) {
              // Primary slot — try to match same angle in new language
              let pick: CopySlot | undefined;
              if (targetAngle) {
                pick = typeSlots.find((s: CopySlot) => s.angle === targetAngle);
              }
              pick = pick ?? typeSlots[0];
              if (pick) {
                newPrimarySlotId = pick.id;
                primarySlot = pick;
                newCopy[slotType] = pick.text;
                if (pick.attribution) newCopy.attribution = pick.attribution;
              }
            } else {
              // Secondary slots — match the new primary's angle for tonal consistency
              const matchAngle = primarySlot?.angle;
              const slot = (matchAngle
                ? typeSlots.find((s: CopySlot) => s.angle === matchAngle)
                : null) ?? typeSlots[0];
              if (slot) {
                newCopy[slotType] = slot.text;
                if (slot.attribution) newCopy.attribution = slot.attribution;
              }
            }
          }
        }
      }

      // 5. Build new AdSpec
      const newSpec: AdSpec = {
        id: newId("as"),
        imageId: oldSpec.imageId,
        format: newFormat,
        lang: newLang,
        familyId: oldSpec.familyId,
        templateId: oldSpec.templateId,
        zoneId: oldSpec.zoneId,
        primarySlotId: newPrimarySlotId,
        copy: newCopy,
        theme: oldSpec.theme,   // preserve custom colors (important for ai_surprise)
        renderMeta: newDims,
        ...(newSurpriseSpec ? { surpriseSpec: newSurpriseSpec } : {}),
        showBrand: showBrand !== undefined ? showBrand : oldSpec.showBrand,
        brandColor: showBrand !== undefined
          ? (showBrand ? (await sampleBrandZoneBrightness(oldSpec.imageId) <= 128 ? '#FFFFFF' : '#1a1a1a') : undefined)
          : oldSpec.brandColor,
      };

      // 6. Store + render + link
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
