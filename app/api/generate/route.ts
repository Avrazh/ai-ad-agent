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
import { getTemplate } from "@/lib/templates";
import "@/lib/templates"; // ensure templates are registered
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import type { SafeZones, CopyPool, AdSpec, TemplateId, Angle } from "@/lib/types";

const FORMAT_W = 1080;
const FORMAT_H = 1350;
const ADS_PER_GENERATE = 4;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageId, templateIds } = body as {
      imageId: string;
      templateIds: TemplateId[];
    };

    if (!imageId) {
      return NextResponse.json({ error: "imageId required" }, { status: 400 });
    }

    const image = getImage(imageId);
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const templates = templateIds?.length
      ? templateIds
      : (["boxed_text", "chat_bubble"] as TemplateId[]);

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

    // 3. Create AdSpecs — spread across templates and angles
    const specs: AdSpec[] = [];
    const usedHeadlineIds = new Set<string>();
    const angles: Angle[] = ["benefit", "curiosity", "urgency"];

    for (let i = 0; i < ADS_PER_GENERATE; i++) {
      const templateId = templates[i % templates.length];
      const template = getTemplate(templateId);

      // Pick a compatible zone
      const zoneId =
        template.supportedZones[i % template.supportedZones.length];

      // Pick a headline — spread across angles, never repeat
      const targetAngle = i < angles.length ? angles[i] : undefined;
      const headline = pickHeadline(copyPool, usedHeadlineIds, targetAngle);
      usedHeadlineIds.add(headline.id);

      const spec: AdSpec = {
        id: newId("as"),
        imageId,
        format: "4:5",
        templateId,
        zoneId,
        headlineId: headline.id,
        headlineText: headline.text,
        theme: template.themeDefaults,
        renderMeta: { w: FORMAT_W, h: FORMAT_H },
      };

      specs.push(spec);
    }

    // 4. Render each AdSpec → PNG
    const results = [];
    for (const spec of specs) {
      // Store AdSpec
      insertAdSpec(spec.id, spec.imageId, JSON.stringify(spec));

      // Render
      const { pngUrl, renderResultId } = await renderAd(spec, safeZones);

      // Store RenderResult
      insertRenderResult({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        templateId: spec.templateId,
        headlineId: spec.headlineId,
        pngUrl,
      });

      results.push({
        id: renderResultId,
        adSpecId: spec.id,
        imageId: spec.imageId,
        templateId: spec.templateId,
        headlineId: spec.headlineId,
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
  pool: CopyPool,
  usedIds: Set<string>,
  preferredAngle?: Angle
) {
  // Try to find an unused headline matching the preferred angle
  if (preferredAngle) {
    const match = pool.headlines.find(
      (h) => h.angle === preferredAngle && !usedIds.has(h.id)
    );
    if (match) return match;
  }

  // Fall back to any unused headline
  const unused = pool.headlines.find((h) => !usedIds.has(h.id));
  if (unused) return unused;

  // All used — pick random
  return pool.headlines[Math.floor(Math.random() * pool.headlines.length)];
}
