import { NextRequest, NextResponse } from "next/server";
import { analyzeSafeZones } from "@/lib/ai/analyze";
import { generateCopyPool } from "@/lib/ai/copy";
import {
  getImage,
  insertImage,
  getSafeZones,
  upsertSafeZones,
  getCopyPool,
  upsertCopyPool,
  insertAdSpec,
  insertRenderResult,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { getAllFamilies, getStylesForFamily, getTemplate } from "@/lib/templates";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { SafeZones, CopyPool, CopySlot, AdSpec, FamilyId, Angle, Language, Format, TemplateId } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageId,
      imageUrl,
      imageWidth,
      imageHeight,
      familyIds,
      autoFamily = false,
      excludeStyleIds = [],
      forceTemplateId,
      lang = "en",
      format = "4:5",
    } = body as {
      imageId: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      familyIds?: FamilyId[];
      autoFamily?: boolean;
      excludeStyleIds?: string[];
      forceTemplateId?: string;
      lang?: Language;
      format?: Format;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    let image = getImage(imageId);
    if (!image) {
      // SQLite was reset (cold start) — re-seed from client-provided values
      if (!imageUrl) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      insertImage({
        id: imageId,
        filename: imageId + ".png",
        url: imageUrl,
        width: imageWidth ?? 0,
        height: imageHeight ?? 0,
      });
      image = getImage(imageId)!;
    }

    // 1. Get or create SafeZones (AI call — cached per imageId)
    let safeZones: SafeZones;
    const cachedZones = getSafeZones(imageId);
    if (cachedZones) {
      safeZones = JSON.parse(cachedZones);
    } else {
      safeZones = await analyzeSafeZones(imageId);
      upsertSafeZones(imageId, JSON.stringify(safeZones));
    }

    // forceTemplateId: exact template overrides all family/diversity logic
    const forcedTemplate = forceTemplateId
      ? getTemplate(forceTemplateId as TemplateId)
      : null;

    // autoFamily: AI picks 1 family from safeZones.recommendedFamily → 1 result
    // manual: use provided familyIds (or all registered families as fallback)
    const families: FamilyId[] = forcedTemplate
      ? [forcedTemplate.familyId]
      : autoFamily
        ? [safeZones.recommendedFamily ?? "promo"]
        : (familyIds?.length ? familyIds : getAllFamilies().map((f) => f.id));

    // 2. Get or create CopyPool (AI call — cached per imageId)
    let copyPool: CopyPool;
    const cachedCopy = getCopyPool(imageId);
    if (cachedCopy) {
      copyPool = JSON.parse(cachedCopy);
    } else {
      copyPool = await generateCopyPool(imageId);
      upsertCopyPool(imageId, JSON.stringify(copyPool));
    }

    // 3. Create AdSpecs — 1 per family (random style picked per family)
    const dims = FORMAT_DIMS[format];
    const langSlots = copyPool.slots.filter((s) => s.lang === lang);
    const specs: AdSpec[] = [];
    const usedSlotIds = new Set<string>();
    const headlineAngles: Angle[] = ["benefit", "curiosity", "urgency", "emotional"];

    let specIndex = 0;
    for (const familyId of families) {
      let stylesToUse = getStylesForFamily(familyId);
      if (forcedTemplate) {
        stylesToUse = [forcedTemplate];
      } else if (autoFamily) {
        const available = stylesToUse.filter((s) => !excludeStyleIds.includes(s.id));
        stylesToUse = available.length > 0 ? [available[0]] : [stylesToUse[Math.floor(Math.random() * stylesToUse.length)]];
      }

      for (const style of stylesToUse) {
        const zoneId = style.supportedZones[specIndex % style.supportedZones.length];

        const copy: AdSpec["copy"] = {};
        let primarySlotId = "";
        let primarySlot: CopySlot | undefined;

        for (let i = 0; i < style.copySlots.length; i++) {
          const slotType = style.copySlots[i];
          const typeSlots = langSlots.filter((s) => s.slotType === slotType);

          if (i === 0) {
            // Primary slot — angle-aware pick
            const targetAngle: Angle | undefined =
              familyId === "luxury"
                ? "aspirational"
                : slotType === "headline"
                  ? (specIndex < headlineAngles.length ? headlineAngles[specIndex] : undefined)
                  : undefined;
            const slot = pickSlot(typeSlots, usedSlotIds, targetAngle);
            if (slot) {
              primarySlotId = slot.id;
              primarySlot = slot;
              usedSlotIds.add(slot.id);
              copy[slotType] = slot.text;
              if (slot.attribution) copy.attribution = slot.attribution;
            }
          } else {
            // Secondary slots — match the primary slot's angle for tonal consistency
            const targetAngle = primarySlot?.angle;
            const slot = pickSlot(typeSlots, usedSlotIds, targetAngle);
            if (slot) {
              copy[slotType] = slot.text;
              if (slot.attribution) copy.attribution = slot.attribution;
            }
          }
        }

        const spec: AdSpec = {
          id: newId("as"),
          imageId,
          format,
          lang,
          familyId,
          templateId: style.id,
          zoneId,
          primarySlotId,
          copy,
          theme: style.themeDefaults,
          renderMeta: dims,
        };

        specs.push(spec);
        specIndex++;
      }
    }

    // 4. Render each AdSpec → PNG
    const results = [];
    for (const spec of specs) {
      insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
      const { pngUrl, renderResultId } = await renderAd(spec, safeZones);
      insertRenderResult({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        familyId: spec.familyId,
        templateId: spec.templateId,
        primarySlotId: spec.primarySlotId,
        pngUrl,
      });

      results.push({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        familyId: spec.familyId,
        templateId: spec.templateId,
        primarySlotId: spec.primarySlotId,
        format: spec.format,
        pngUrl,
        approved: false,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

function pickSlot(
  slots: CopySlot[],
  usedIds: Set<string>,
  preferredAngle?: Angle
): CopySlot | undefined {
  if (!slots.length) return undefined;

  // 1. Unused slot matching preferred angle
  if (preferredAngle) {
    const match = slots.find(
      (s) => s.angle === preferredAngle && !usedIds.has(s.id)
    );
    if (match) return match;
  }

  // 2. Any unused slot
  const unused = slots.find((s) => !usedIds.has(s.id));
  if (unused) return unused;

  // 3. All used — prefer angle match, then random
  if (preferredAngle) {
    const angleMatch = slots.find((s) => s.angle === preferredAngle);
    if (angleMatch) return angleMatch;
  }
  return slots[Math.floor(Math.random() * slots.length)];
}
