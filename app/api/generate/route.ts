import { NextRequest, NextResponse } from "next/server";
import { analyzeSafeZones } from "@/lib/ai/analyze";
import { generateCopyPool } from "@/lib/ai/copy";
import {
  getImage,
  getSafeZones,
  upsertSafeZones,
  getCopyPool,
  upsertCopyPool,
  insertAdSpec,
  insertRenderResult,
} from "@/lib/db";
import "@/lib/templates"; // ensure templates + families registered
import { pickRandomStyle, getAllFamilies, getStylesForFamily } from "@/lib/templates";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { SafeZones, CopyPool, AdSpec, FamilyId, Angle, Language, Format, Headline } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageId,
      familyIds,
      lang = "en",
      format = "4:5",
      showAllStyles = false,
    } = body as {
      imageId: string;
      familyIds: FamilyId[];
      lang?: Language;
      format?: Format;
      showAllStyles?: boolean;
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    const image = getImage(imageId);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Default to all registered families if none specified
    const families: FamilyId[] = familyIds?.length
      ? familyIds
      : getAllFamilies().map((f) => f.id);

    // 1. Get or create SafeZones (AI call — cached per imageId)
    let safeZones: SafeZones;
    const cachedZones = getSafeZones(imageId);
    if (cachedZones) {
      safeZones = JSON.parse(cachedZones);
    } else {
      safeZones = await analyzeSafeZones(imageId);
      upsertSafeZones(imageId, JSON.stringify(safeZones));
    }

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
    const langHeadlines = copyPool.headlines.filter((h) => h.lang === lang);
    const specs: AdSpec[] = [];
    const usedHeadlineIds = new Set<string>();
    const angles: Angle[] = ["benefit", "curiosity", "urgency", "emotional"];

    let specIndex = 0;
    for (const familyId of families) {
      const stylesToUse = showAllStyles
        ? getStylesForFamily(familyId)
        : [pickRandomStyle(familyId)];

      for (const style of stylesToUse) {
        // Pick a compatible zone
        const zoneId = style.supportedZones[specIndex % style.supportedZones.length];

        // Pick a headline — luxury always gets aspirational; others spread across angles
        const targetAngle: Angle | undefined = familyId === "luxury"
          ? "aspirational"
          : (specIndex < angles.length ? angles[specIndex] : undefined);
        const headline = pickHeadline(langHeadlines, usedHeadlineIds, targetAngle);
        usedHeadlineIds.add(headline.id);

        const spec: AdSpec = {
          id: newId("as"),
          imageId,
          format,
          lang,
          familyId,
          templateId: style.id,
          zoneId,
          headlineId: headline.id,
          headlineText: headline.text,
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
        headlineId: spec.headlineId,
        pngUrl,
      });

      results.push({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        familyId: spec.familyId,
        templateId: spec.templateId,
        headlineId: spec.headlineId,
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

function pickHeadline(
  headlines: Headline[],
  usedIds: Set<string>,
  preferredAngle?: Angle
) {
  // Try to find an unused headline matching the preferred angle
  if (preferredAngle) {
    const match = headlines.find(
      (h) => h.angle === preferredAngle && !usedIds.has(h.id)
    );
    if (match) return match;
  }

  // Fall back to any unused headline
  const unused = headlines.find((h) => !usedIds.has(h.id));
  if (unused) return unused;

  // All used — pick random
  return headlines[Math.floor(Math.random() * headlines.length)];
}
