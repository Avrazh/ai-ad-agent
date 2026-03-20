import { NextRequest, NextResponse } from "next/server";
import { getApprovedResults, insertAdSpec, insertRenderResult } from "@/lib/db";
import { translateCopy } from "@/lib/ai/translate";
import { TRANSLATION_TARGETS, type TranslationLangCode } from "@/lib/languages";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import "@/lib/templates"; // ensure templates registered

export async function POST(req: NextRequest) {
  try {
    const { languages } = (await req.json()) as { languages: string[] };
    if (!Array.isArray(languages) || languages.length === 0) {
      return NextResponse.json({ error: "languages array required" }, { status: 400 });
    }

    const validCodes = TRANSLATION_TARGETS.map((t) => t.code);
    const targetLangs = languages.filter((l): l is TranslationLangCode =>
      validCodes.includes(l as TranslationLangCode)
    );
    if (targetLangs.length === 0) {
      return NextResponse.json({ error: "no valid language codes" }, { status: 400 });
    }

    // Only translate EN originals — skip already-translated results so approving
    // a translated ad doesn't feed it back into the next translate run.
    const approved = (await getApprovedResults()).filter(
      (a) => !a.spec.lang || a.spec.lang === "en"
    );
    if (approved.length === 0) {
      return NextResponse.json({ error: "no approved results to translate" }, { status: 400 });
    }

    const batch = approved.map((a, i) => ({
      index: i,
      headline: a.spec.copy.headline ?? a.spec.copy.quote ?? "",
      subtext: a.spec.copy.subtext ?? "",
    }));

    type TranslatedResultItem = {
      id: string;
      imageId: string;
      pngUrl: string;
      adSpecId: string;
      familyId: string;
      templateId: string;
      primarySlotId: string;
      lang: string;
      headlineText: string;
      headlineYOverride?: number;
      headlineFontScale?: number;
      brandNameY?: number;
      brandNameFontScale?: number;
      subjectPos: string;
      headlineColor?: string;
      approved: boolean;
      sourceResultId: string;
    };

    const output: { lang: string; results: TranslatedResultItem[] }[] = [];

    for (const langCode of targetLangs) {
      const langConfig = TRANSLATION_TARGETS.find((t) => t.code === langCode)!;
      console.log(`[translate] Starting ${langConfig.name} (${approved.length} ads)`);

      const translated = await translateCopy(batch, langCode, langConfig.name);
      const langResults: TranslatedResultItem[] = [];

      for (let i = 0; i < approved.length; i++) {
        const item = approved[i];
        const t = translated.find((r) => r.index === i);
        if (!t) continue;

        const newSpec = {
          ...item.spec,
          id: newId("as"),
          lang: langCode,
          copy: {
            ...item.spec.copy,
            ...(item.spec.copy.headline !== undefined ? { headline: t.headline } : {}),
            ...(item.spec.copy.quote !== undefined ? { quote: t.headline } : {}),
            ...(item.spec.copy.subtext !== undefined ? { subtext: t.subtext || undefined } : {}),
          },
        };

        await insertAdSpec(newSpec.id, newSpec.imageId, JSON.stringify(newSpec));
        const { pngUrl, renderResultId, cssSubjectPos } = await renderAd(newSpec);
        await insertRenderResult({
          id: renderResultId,
          adSpecId: newSpec.id,
          imageId: newSpec.imageId,
          familyId: newSpec.familyId,
          templateId: newSpec.templateId,
          primarySlotId: newSpec.primarySlotId,
          pngUrl,
        });

        langResults.push({
          id: renderResultId,
          imageId: newSpec.imageId,
          pngUrl,
          adSpecId: newSpec.id,
          familyId: newSpec.familyId,
          templateId: newSpec.templateId,
          primarySlotId: newSpec.primarySlotId,
          lang: langCode,
          headlineText: t.headline,
          headlineYOverride: newSpec.headlineYOverride,
          headlineFontScale: newSpec.surpriseSpec?.headlineFontScale ?? 1.0,
          brandNameY: newSpec.brandNameY,
          brandNameFontScale: newSpec.brandNameFontScale,
          subjectPos: cssSubjectPos,
          // Carry headlineColor explicitly so the canvas initializes with the right color.
          // Falls back to surpriseSpec.textColor (e.g. "#ffffff" for clean_headline) so
          // the approve bake always produces the correct text color.
          headlineColor: newSpec.headlineColor ?? newSpec.surpriseSpec?.textColor,
          approved: false,
          sourceResultId: item.resultId,
        });
      }

      output.push({ lang: langCode, results: langResults });
      console.log(`[translate] ${langConfig.name}: ${langResults.length} ads rendered`);
    }

    return NextResponse.json({ translations: output });
  } catch (err) {
    console.error("[translate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Translation failed" },
      { status: 500 }
    );
  }
}
