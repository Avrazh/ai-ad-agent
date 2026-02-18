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
import type { AdSpec, SafeZones, CopyPool, Language, Format, Headline } from "@/lib/types";
import { FORMAT_DIMS } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resultIds, lang, format } = body as {
      resultIds: string[];
      lang?: Language;
      format?: Format;
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
      const oldResult = getRenderResult(resultId);
      if (!oldResult) continue;

      const oldSpecRow = getAdSpec(oldResult.ad_spec_id);
      if (!oldSpecRow) continue;
      const oldSpec: AdSpec = JSON.parse(oldSpecRow.data);

      // 2. Load stored data (never generate new ones)
      const safeZonesJson = getSafeZones(oldSpec.imageId);
      const copyPoolJson = getCopyPool(oldSpec.imageId);
      if (!safeZonesJson || !copyPoolJson) continue;
      const safeZones: SafeZones = JSON.parse(safeZonesJson);
      const copyPool: CopyPool = JSON.parse(copyPoolJson);

      // 3. Determine new values
      const newLang = lang ?? oldSpec.lang;
      const newFormat = format ?? oldSpec.format;
      const newDims = FORMAT_DIMS[newFormat];

      // 4. Find headline for new language (try matching same angle)
      let newHeadlineId = oldSpec.headlineId;
      let newHeadlineText = oldSpec.headlineText;

      if (lang && lang !== oldSpec.lang) {
        const currentHeadline = copyPool.headlines.find(
          (h: Headline) => h.id === oldSpec.headlineId
        );
        const targetAngle = currentHeadline?.angle;

        const newLangHeadlines = copyPool.headlines.filter(
          (h: Headline) => h.lang === newLang
        );

        let pick: Headline | undefined;
        if (targetAngle) {
          pick = newLangHeadlines.find((h: Headline) => h.angle === targetAngle);
        }
        if (!pick && newLangHeadlines.length > 0) {
          pick = newLangHeadlines[0];
        }
        if (pick) {
          newHeadlineId = pick.id;
          newHeadlineText = pick.text;
        }
      }

      // 5. Build new AdSpec
      const template = getTemplate(oldSpec.templateId);
      const newSpec: AdSpec = {
        id: newId("as"),
        imageId: oldSpec.imageId,
        format: newFormat,
        lang: newLang,
        familyId: oldSpec.familyId,
        templateId: oldSpec.templateId,
        zoneId: oldSpec.zoneId,
        headlineId: newHeadlineId,
        headlineText: newHeadlineText,
        theme: template.themeDefaults,
        renderMeta: newDims,
      };

      // 6. Store + render + link
      insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));
      const { pngUrl, renderResultId } = await renderAd(newSpec, safeZones);
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

      results.push({
        replacedId: resultId,
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
