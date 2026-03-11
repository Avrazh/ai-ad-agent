import { NextRequest, NextResponse } from "next/server";
import { analyzeSafeZones } from "@/lib/ai/analyze";
import { generateCopyPool } from "@/lib/ai/copy";
import { generateSurpriseSpec, generateSurpriseSpecFromReference } from "@/lib/ai/aiSurprise";
import {
  getImage,
  insertImage,
  getSafeZones,
  upsertSafeZones,
  getCopyPool,
  upsertCopyPool,
  insertAdSpec,
  insertRenderResult,
  getSavedAIStyles,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { getAllFamilies, getStylesForFamily, getTemplate } from "@/lib/templates";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { SafeZones, CopyPool, CopySlot, AdSpec, FamilyId, Angle, Language, Format, TemplateId, ZoneId, SurpriseSpec } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";
import sharp from "sharp";
import { read as readStorage } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageId,
      imageUrl,
      imageWidth,
      imageHeight,
      familyIds,
      forceTemplateId,
      surpriseMe,
      savedSurpriseSpecId,
      forceSurpriseSpec,
      referenceImageBase64,
      referenceImageMimeType,
      lang = "en",
      format = "4:5",
      showBrand = false,
    } = body as {
      imageId: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      familyIds?: FamilyId[];
      forceTemplateId?: string;
      surpriseMe?: boolean;
      savedSurpriseSpecId?: string;  // reuse saved layout without AI call
      forceSurpriseSpec?: SurpriseSpec; // use provided spec directly — no AI, no DB lookup
      referenceImageBase64?: string;    // base64 reference ad — triggers style-transfer spec generation
      referenceImageMimeType?: string;
      lang?: Language;
      format?: Format;
      showBrand?: boolean;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    let image = await getImage(imageId);
    if (!image) {
      // SQLite was reset (cold start) — re-seed from client-provided values
      if (!imageUrl) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      await insertImage({
        id: imageId,
        filename: imageId + ".png",
        url: imageUrl,
        width: imageWidth ?? 0,
        height: imageHeight ?? 0,
      });
      image = await getImage(imageId)!;
    }

    // ── Surprise Me path ────────────────────────────────────────────────────
    // Two sub-modes:
    //   surpriseMe=true          → fresh AI call (Haiku vision + random seeds)
    //   savedSurpriseSpecId=xxx  → reuse saved layout spec, pick copy from CopyPool
    if (surpriseMe || savedSurpriseSpecId || forceSurpriseSpec) {
      // 1. Ensure SafeZones exist (needed by renderAd even though ai_surprise ignores zonePx)
      let safeZones: SafeZones;
      const cachedZones = await getSafeZones(imageId);
      if (cachedZones) {
        safeZones = JSON.parse(cachedZones);
      } else {
        safeZones = await analyzeSafeZones(imageId);
        await upsertSafeZones(imageId, JSON.stringify(safeZones));
      }

      // 2. Ensure CopyPool exists (so "New Headline" works after a surprise render)
      let copyPool: CopyPool | null = null;
      const cachedCopy = await getCopyPool(imageId);
      if (cachedCopy) {
        copyPool = JSON.parse(cachedCopy);
      } else {
        copyPool = await generateCopyPool(imageId);
        await upsertCopyPool(imageId, JSON.stringify(copyPool));
      }

      // 3. Get or generate the SurpriseSpec
      let surprise: SurpriseSpec;
      if (forceSurpriseSpec) {
        // Use provided spec directly — no AI call, no DB lookup (used for layout preview)
        surprise = forceSurpriseSpec;
        // Replace copy with copy from the current image's pool
        const langSlots = copyPool?.slots.filter((s) => s.lang === lang) ?? [];
        const headlineSlots = langSlots.filter((s) => s.slotType === "headline");
        const tempUsed = new Set<string>();
        const hlSlot = pickSlot(headlineSlots, tempUsed, "aspirational", surprise.preferredHeadlineLength)
          ?? pickSlot(headlineSlots, tempUsed, undefined, surprise.preferredHeadlineLength);
        const stSlot = langSlots.find((s) => s.slotType === "subtext");
        const headline = hlSlot?.text ?? surprise.en.headline;
        const subtext  = stSlot?.text ?? surprise.en.subtext;
        surprise = { ...surprise, en: { headline, subtext }, de: { headline, subtext } };
      } else if (savedSurpriseSpecId) {
        // Reuse a previously saved layout — no AI call
        const allSaved = await getSavedAIStyles();
        const saved = allSaved.find((s) => s.id === savedSurpriseSpecId);
        if (!saved?.surprise_spec) {
          return NextResponse.json({ error: "Saved surprise style not found" }, { status: 404 });
        }
        surprise = JSON.parse(saved.surprise_spec) as SurpriseSpec;
        // Replace copy with copy from the current image's pool
        const langSlots = copyPool?.slots.filter((s) => s.lang === lang) ?? [];
        const hlSlot = langSlots.find((s) => s.slotType === "headline" && s.angle === "aspirational")
          ?? langSlots.find((s) => s.slotType === "headline");
        const stSlot = langSlots.find((s) => s.slotType === "subtext");
        const headline = hlSlot?.text ?? surprise.en.headline;
        const subtext  = stSlot?.text ?? surprise.en.subtext;
        surprise = { ...surprise, en: { headline, subtext }, de: { headline, subtext } };
      } else if (referenceImageBase64) {
        // Style-transfer: generate spec inspired by a reference ad image
        const refMime = (referenceImageMimeType ?? "jpeg") as "jpeg" | "png" | "gif" | "webp";
        surprise = await generateSurpriseSpecFromReference(imageId, referenceImageBase64, refMime);
      } else {
        // Fresh AI call
        surprise = await generateSurpriseSpec(imageId);
      }

      // 4. Auto-detect text color for clean_headline: sample brightness of the text zone
      if (surprise.layout === 'clean_headline') {
        const brightness = await sampleZoneBrightness(imageId);
        const textColor = brightness <= 128 ? '#FFFFFF' : '#1a1a1a';
        surprise = { ...surprise, textColor, accentColor: textColor };
      }

      // 4. Build AdSpec
      const dims = FORMAT_DIMS[format];
      const langCopy = lang === "de" ? surprise.de : surprise.en;
      const zoneId = pickBestZone(safeZones, ["A", "B", "C"]);

      const spec: AdSpec = {
        id: newId("as"),
        imageId,
        format,
        lang,
        familyId: "ai",
        templateId: "ai_surprise",
        zoneId,
        primarySlotId: newId("surprise"),
        copy: {
          headline: langCopy.headline,
          subtext:  langCopy.subtext,
        },
        theme: {
          fontHeadline: surprise.font === "sans" ? "Inter" : "Playfair Display",
          fontSize: 90,
          color: surprise.textColor,
          bg:    surprise.bgColor,
          radius: 0,
          shadow: false,
        },
        surpriseSpec: surprise,
        renderMeta: dims,
        showBrand,
      };

      await insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
      const { pngUrl, renderResultId } = await renderAd(spec, safeZones);
      await insertRenderResult({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        familyId: "ai",
        templateId: "ai_surprise",
        primarySlotId: spec.primarySlotId,
        pngUrl,
      });

      return NextResponse.json({
        results: [{
          id: renderResultId,
          adSpecId: spec.id,
          imageId: spec.imageId,
          familyId: "ai",
          templateId: "ai_surprise",
          primarySlotId: spec.primarySlotId,
          format: spec.format,
          pngUrl,
          approved: false,
          createdAt: new Date().toISOString(),
        }],
      });
    }
    // ── End Surprise Me path ─────────────────────────────────────────────────

    // 1. Get or create SafeZones (AI call — cached per imageId)
    let safeZones: SafeZones;
    const cachedZones = await getSafeZones(imageId);
    if (cachedZones) {
      safeZones = JSON.parse(cachedZones);
    } else {
      safeZones = await analyzeSafeZones(imageId);
      await upsertSafeZones(imageId, JSON.stringify(safeZones));
    }

    // forceTemplateId: exact template overrides all family logic
    const forcedTemplate = forceTemplateId
      ? getTemplate(forceTemplateId as TemplateId)
      : null;

    // use provided familyIds, or forceTemplate's family, or all registered families
    const families: FamilyId[] = forcedTemplate
      ? [forcedTemplate.familyId]
      : (familyIds?.length ? familyIds : getAllFamilies().map((f) => f.id));

    // 2. Get or create CopyPool (AI call — cached per imageId)
    let copyPool: CopyPool;
    const cachedCopy = await getCopyPool(imageId);
    if (cachedCopy) {
      copyPool = JSON.parse(cachedCopy);
    } else {
      copyPool = await generateCopyPool(imageId);
      await upsertCopyPool(imageId, JSON.stringify(copyPool));
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
      }

      for (const style of stylesToUse) {
        const zoneId = pickBestZone(safeZones, style.supportedZones);

        const copy: AdSpec["copy"] = {};
        let primarySlotId = "";
        let primarySlot: CopySlot | undefined;

        for (let i = 0; i < style.copySlots.length; i++) {
          const slotType = style.copySlots[i];
          const typeSlots = langSlots.filter((s) => s.slotType === slotType);

          if (i === 0) {
            // Primary slot — angle-aware + length-aware pick
            const targetAngle: Angle | undefined =
              familyId === "luxury"
                ? "aspirational"
                : slotType === "headline"
                  ? (specIndex < headlineAngles.length ? headlineAngles[specIndex] : undefined)
                  : undefined;
            const preferredLength = slotType === "headline" ? style.preferredHeadlineLength : undefined;
            const slot = pickSlot(typeSlots, usedSlotIds, targetAngle, preferredLength);
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
          showBrand,
          brandColor: showBrand ? (await sampleBrandZoneBrightness(imageId) <= 128 ? '#FFFFFF' : '#1a1a1a') : undefined,
        };

        specs.push(spec);
        specIndex++;
      }
    }

    // 4. Render each AdSpec → PNG
    const results = [];
    for (const spec of specs) {
      await insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));
      const { pngUrl, renderResultId } = await renderAd(spec, safeZones);
      await insertRenderResult({
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

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

export function pickBestZone(
  safeZones: SafeZones,
  supportedZones: string[],
  preferDifferentFrom?: string
): ZoneId {
  const candidates = safeZones.zones.filter((z) => supportedZones.includes(z.id));
  if (!candidates.length) return supportedZones[0] as ZoneId;

  const scored = candidates.map((z) => ({
    id: z.id,
    overlap: safeZones.avoidRegions.some((r) => rectsOverlap(z.rect, r)) ? 1 : 0,
  }));

  // Shuffle before sorting so equal-scored zones are picked at random (stable sort
  // would always favour whichever zone appears first in the array — usually A).
  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }

  const sorted = scored.sort((a, b) => {
    if (a.id === preferDifferentFrom) return 1;
    if (b.id === preferDifferentFrom) return -1;
    return a.overlap - b.overlap;
  });
  return sorted[0].id as ZoneId;
}

function lengthTag(slot: CopySlot): "short" | "medium" | "long" {
  const wc = slot.wordCount ?? slot.text.trim().split(/\s+/).filter(Boolean).length;
  return wc <= 4 ? "short" : wc <= 7 ? "medium" : "long";
}

function pickSlot(
  slots: CopySlot[],
  usedIds: Set<string>,
  preferredAngle?: Angle,
  preferredLength?: "short" | "medium" | "long"
): CopySlot | undefined {
  if (!slots.length) return undefined;

  // 1. Unused + angle match + length match
  if (preferredAngle && preferredLength) {
    const match = slots.find(
      (s) => s.angle === preferredAngle && !usedIds.has(s.id) && lengthTag(s) === preferredLength
    );
    if (match) return match;
  }

  // 2. Unused + angle match
  if (preferredAngle) {
    const match = slots.find(
      (s) => s.angle === preferredAngle && !usedIds.has(s.id)
    );
    if (match) return match;
  }

  // 3. Unused + length match
  if (preferredLength) {
    const match = slots.find(
      (s) => !usedIds.has(s.id) && lengthTag(s) === preferredLength
    );
    if (match) return match;
  }

  // 4. Any unused slot
  const unused = slots.find((s) => !usedIds.has(s.id));
  if (unused) return unused;

  // 5. All used — angle match
  if (preferredAngle) {
    const angleMatch = slots.find((s) => s.angle === preferredAngle);
    if (angleMatch) return angleMatch;
  }

  // 6. All used — length match
  if (preferredLength) {
    const lenMatch = slots.find((s) => lengthTag(s) === preferredLength);
    if (lenMatch) return lenMatch;
  }

  // 7. Random
  return slots[Math.floor(Math.random() * slots.length)];
}

/**
 * Sample the average perceived brightness of the image in the clean_headline text zone.
 * Zone is proportional: x 9.26-90.74%, y 20.05-79.95% (from 1080x1920 reference).
 * Returns a value 0-255. Below 128 = dark background → white text.
 */
async function sampleZoneBrightness(imageId: string): Promise<number> {
  try {
    const img = await getImage(imageId);
    if (!img) return 255;
    const buf = await readStorage('uploads', img.url);
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1080;
    const ih = meta.height ?? 1920;
    const left   = Math.round(iw * 0.0926);
    const top    = Math.round(ih * 0.2005);
    const width  = Math.round(iw * 0.8148);
    const height = Math.round(ih * 0.5990); // zone height ~1150px
    const { data } = await sharp(buf)
      .extract({ left, top, width, height })
      .resize(64, 64, { fit: 'fill' }) // downsample for speed
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    const channels = data.length / (64 * 64);
    for (let i = 0; i < data.length; i += channels) {
      // Perceived luminance
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (64 * 64);
  } catch {
    return 255; // safe default: assume light bg
  }
}

/**
 * Sample brightness at the brand name zone (bottom of safe zone, y 78-86%).
 */
export async function sampleBrandZoneBrightness(imageId: string): Promise<number> {
  try {
    const img = await getImage(imageId);
    if (!img) return 255;
    const buf = await readStorage('uploads', img.url);
    const meta = await sharp(buf).metadata();
    const iw = meta.width ?? 1080;
    const ih = meta.height ?? 1920;
    const left   = Math.round(iw * 0.05);
    const top    = Math.round(ih * 0.78);
    const width  = Math.round(iw * 0.90);
    const height = Math.round(ih * 0.08);
    const { data } = await sharp(buf)
      .extract({ left, top, width, height })
      .resize(64, 16, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    const channels = data.length / (64 * 16);
    for (let i = 0; i < data.length; i += channels) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return sum / (64 * 16);
  } catch {
    return 255;
  }
}
