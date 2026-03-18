# Translate Approved Ads Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users translate all approved EN ads into one or more target languages (SV, EL, FR, ES), producing identical-layout translated ads that appear in collapsible language groups in the left panel for individual review and approval.

**Architecture:** A single `POST /api/translate` route fetches all approved results, calls Claude Haiku once per target language to batch-translate every (headline, subtext) pair with cultural adaptation, then re-renders each ad using the exact same AdSpec (same template, positions, crop, brand name, font) with only the copy replaced. Translated ads are stored as regular render results and surfaced in the left panel under collapsible language group headers. The entire language config lives in one file so adding a new language is a single-line change.

**Tech Stack:** Next.js 14 App Router, TypeScript, Anthropic Claude Haiku (claude-haiku-4-5-20251001), Turso SQLite via @libsql/client, existing renderAd() from lib/render/renderAd.ts

---

## File Structure

| Action | File | What changes |
|--------|------|-------------|
| Create | `lib/languages.ts` | Single source of truth for translation target languages |
| Modify | `lib/types.ts` | Extend Language union: add "sv" and "el" |
| Create | `lib/ai/translate.ts` | Claude Haiku batch translation function |
| Modify | `lib/db.ts` | Add getApprovedResults() helper |
| Create | `app/api/translate/route.ts` | POST endpoint: fetch approved -> translate -> render -> return |
| Modify | `app/page.tsx` | Types, state, handleTranslate, left panel groups, Translate button, detail view |

---

## Chunk 1: Foundation

### Task 1: Language config

**Files:**
- Create: `lib/languages.ts`

- [ ] **Step 1: Create `lib/languages.ts`**

```ts
// To add a new language: add one entry to TRANSLATION_TARGETS. Nothing else changes.
export type TranslationLangCode = "sv" | "el" | "fr" | "es";

export const TRANSLATION_TARGETS: {
  code: TranslationLangCode;
  label: string;  // shown in UI e.g. "SE"
  name: string;   // full name for AI prompt e.g. "Swedish"
}[] = [
  { code: "sv", label: "SE", name: "Swedish" },
  { code: "el", label: "GR", name: "Greek" },
  { code: "fr", label: "FR", name: "French" },
  { code: "es", label: "ES", name: "Spanish" },
];
```

- [ ] **Step 2: Commit**
```bash
git add lib/languages.ts && git commit -m "feat: add translation language config"
```

---

### Task 2: Extend Language type

**Files:**
- Modify: `lib/types.ts` (line 37)
- Modify: `app/page.tsx` (line 89)

- [ ] **Step 1: In `lib/types.ts`, change:**
```ts
export type Language = "en" | "de" | "fr" | "es";
```
to:
```ts
export type Language = "en" | "de" | "fr" | "es" | "sv" | "el";
```

- [ ] **Step 2: In `app/page.tsx` line 89, change:**
```ts
type Language = "en" | "de" | "fr" | "es";
```
to:
```ts
type Language = "en" | "de" | "fr" | "es" | "sv" | "el";
```

- [ ] **Step 3: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add lib/types.ts app/page.tsx && git commit -m "feat: extend Language type with sv and el"
```

---

### Task 3: AI translation module

**Files:**
- Create: `lib/ai/translate.ts`

Single Claude Haiku call per target language. All approved ads batched in one prompt.
Prompt explicitly asks for cultural adaptation -- not word-for-word. Falls back to originals on error.

- [ ] **Step 1: Create `lib/ai/translate.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";

export type TranslateItem = {
  index: number;
  headline: string;
  subtext: string;
};

export type TranslateResult = {
  index: number;
  headline: string;
  subtext: string;
};

/**
 * Translates an array of (headline, subtext) pairs into targetLang.
 * Cultural adaptation -- NOT word-for-word.
 * Single Claude Haiku call regardless of item count.
 * Falls back to original text on failure.
 */
export async function translateCopy(
  items: TranslateItem[],
  targetLangCode: string,
  targetLangName: string
): Promise<TranslateResult[]> {
  const fallback = items.map((i) => ({ index: i.index, headline: i.headline, subtext: i.subtext }));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || process.env.SKIP_AI === "true") return fallback;

  const itemsJson = JSON.stringify(
    items.map((i) => ({ index: i.index, headline: i.headline, subtext: i.subtext }))
  );

  const prompt = [
    `You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).`,
    `Translate the following ad copy into ${targetLangName} (language code: ${targetLangCode}).`,
    ``,
    `Rules:`,
    `- Cultural adaptation, NOT word-for-word translation`,
    `- Keep the same emotional tone and punch as the original`,
    `- Keep similar length -- translated text should fit the same visual space`,
    `- No emojis`,
    `- If subtext is empty string "", keep it as ""`,
    ``,
    `Return ONLY raw JSON array, same structure as input, with translated headline and subtext:`,
    `[{"index":0,"headline":"...","subtext":"..."},{"index":1,"headline":"...","subtext":"..."}]`,
    ``,
    `Items to translate:`,
    itemsJson,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () => client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
      `translate-${targetLangCode}`
    );
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
    const parsed = JSON.parse(text) as TranslateResult[];
    console.log(`[translate] ${parsed.length} items -> ${targetLangName}`);
    return parsed;
  } catch (err) {
    console.error(`[translate] Failed for ${targetLangCode} -- using originals:`, err);
    return fallback;
  }
}
```

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add lib/ai/translate.ts && git commit -m "feat: add Claude Haiku batch translation module"
```

---
## Chunk 2: Backend

### Task 4: DB helper getApprovedResults

**Files:**
- Modify: `lib/db.ts` (add before `setApproval` around line 555)

- [ ] **Step 1: Add `getApprovedResults` to `lib/db.ts` before the `setApproval` function:**

```ts
export async function getApprovedResults(): Promise<
  { resultId: string; imageId: string; pngUrl: string; spec: import("@/lib/types").AdSpec }[]
> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute(`
    SELECT r.id as result_id, r.image_id, r.png_url, s.data as spec_data
    FROM render_results r
    JOIN ad_specs s ON r.ad_spec_id = s.id
    WHERE r.approved = 1 AND r.replaced_by IS NULL
    ORDER BY r.created_at ASC
  `);
  return result.rows.map((row) => ({
    resultId: row.result_id as string,
    imageId: row.image_id as string,
    pngUrl: row.png_url as string,
    spec: JSON.parse(row.spec_data as string) as import("@/lib/types").AdSpec,
  }));
}
```

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add lib/db.ts && git commit -m "feat: add getApprovedResults DB helper"
```

---

### Task 5: API route POST /api/translate

**Files:**
- Create: `app/api/translate/route.ts`

This route: (1) reads `{ languages: string[] }` from body, (2) fetches all approved results via `getApprovedResults()`, (3) for each target language calls Claude Haiku once to batch-translate, (4) for each result clones AdSpec with translated copy and same everything else, renders, saves, (5) returns `{ translations: [{ lang, results[] }] }`.

IMPORTANT: Calls `renderAd()` directly -- never calls other API routes via HTTP.

- [ ] **Step 1: Create `app/api/translate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getApprovedResults, insertAdSpec, insertRenderResult } from "@/lib/db";
import { translateCopy } from "@/lib/ai/translate";
import { TRANSLATION_TARGETS, type TranslationLangCode } from "@/lib/languages";
import { renderAd } from "@/lib/render/renderAd";
import { newId } from "@/lib/ids";
import "@/lib/templates"; // ensure templates registered

export async function POST(req: NextRequest) {
  try {
    const { languages } = await req.json() as { languages: string[] };
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

    const approved = await getApprovedResults();
    if (approved.length === 0) {
      return NextResponse.json({ error: "no approved results to translate" }, { status: 400 });
    }

    const batch = approved.map((a, i) => ({
      index: i,
      headline: a.spec.copy.headline ?? a.spec.copy.quote ?? "",
      subtext: a.spec.copy.subtext ?? "",
    }));

    type TranslatedResultItem = {
      id: string; imageId: string; pngUrl: string; adSpecId: string;
      familyId: string; templateId: string; primarySlotId: string; lang: string;
      headlineText: string; headlineYOverride?: number; headlineFontScale?: number;
      brandNameY?: number; brandNameFontScale?: number; subjectPos: string;
      approved: boolean; sourceResultId: string;
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
          id: renderResultId, adSpecId: newSpec.id, imageId: newSpec.imageId,
          familyId: newSpec.familyId, templateId: newSpec.templateId,
          primarySlotId: newSpec.primarySlotId, pngUrl,
        });

        langResults.push({
          id: renderResultId, imageId: newSpec.imageId, pngUrl, adSpecId: newSpec.id,
          familyId: newSpec.familyId, templateId: newSpec.templateId,
          primarySlotId: newSpec.primarySlotId, lang: langCode,
          headlineText: t.headline, headlineYOverride: newSpec.headlineYOverride,
          headlineFontScale: newSpec.surpriseSpec?.headlineFontScale ?? 1.0,
          brandNameY: newSpec.brandNameY, brandNameFontScale: newSpec.brandNameFontScale,
          subjectPos: cssSubjectPos, approved: false, sourceResultId: item.resultId,
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
```

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/api/translate/route.ts && git commit -m "feat: add POST /api/translate route"
```

---
## Chunk 3: UI

### Task 6: Add TranslatedItem type and state to page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `TranslatedItem` type after `RenderResultItem` type (around line 31):**

```ts
type TranslatedItem = {
  id: string;
  adSpecId: string;
  imageId: string;
  familyId: string;
  templateId: string;
  primarySlotId: string;
  lang: string;
  pngUrl: string;
  headlineText?: string;
  headlineYOverride?: number;
  headlineFontScale?: number;
  brandNameY?: number;
  brandNameFontScale?: number;
  subjectPos?: string;
  approved: boolean;
  sourceResultId: string;
};
```

- [ ] **Step 2: Add import at top of file (after existing imports):**
```ts
import { TRANSLATION_TARGETS } from "@/lib/languages";
```

- [ ] **Step 3: Add state variables inside `Home()` after `addPersonaLoading` (around line 246):**

```ts
const [translatedItems, setTranslatedItems] = useState<TranslatedItem[]>([]);
const [selectedTranslatedItemId, setSelectedTranslatedItemId] = useState<string | null>(null);
const [translatePickerOpen, setTranslatePickerOpen] = useState(false);
const [translateLoading, setTranslateLoading] = useState(false);
const [translateSelectedLangs, setTranslateSelectedLangs] = useState<Set<string>>(new Set());
const [expandedLangGroups, setExpandedLangGroups] = useState<Set<string>>(new Set(["en"]));
const translatePickerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Add `handleTranslate` after `handleDownloadAll` (around line 965):**

```ts
const handleTranslate = useCallback(async () => {
  if (translateSelectedLangs.size === 0) return;
  setTranslateLoading(true);
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languages: [...translateSelectedLangs] }),
    });
    if (!res.ok) throw new Error("Translation failed");
    const data = await res.json() as {
      translations: { lang: string; results: TranslatedItem[] }[];
    };
    const newItems: TranslatedItem[] = data.translations.flatMap((t) => t.results);
    setTranslatedItems((prev) => {
      const incoming = new Set(newItems.map((i) => `${i.sourceResultId}:${i.lang}`));
      const kept = prev.filter((i) => !incoming.has(`${i.sourceResultId}:${i.lang}`));
      return [...kept, ...newItems];
    });
    setExpandedLangGroups((prev) => {
      const next = new Set(prev);
      for (const lang of translateSelectedLangs) next.add(lang);
      return next;
    });
    setTranslatePickerOpen(false);
    setTranslateSelectedLangs(new Set());
  } catch (err) {
    console.error("[translate]", err);
  } finally {
    setTranslateLoading(false);
  }
}, [translateSelectedLangs]);
```

- [ ] **Step 5: Add `handleApproveTranslated` after `handleApprove` (around line 900):**

```ts
const handleApproveTranslated = useCallback(
  async (itemId: string, approved: boolean) => {
    try {
      await fetch("/api/approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: itemId, approved }),
      });
      setTranslatedItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, approved } : i))
      );
    } catch { /* silent */ }
  },
  []
);
```

- [ ] **Step 6: Add outside-click useEffect (near other useEffects):**

```ts
useEffect(() => {
  if (!translatePickerOpen) return;
  function onClickOutside(e: MouseEvent) {
    if (translatePickerRef.current && !translatePickerRef.current.contains(e.target as Node)) {
      setTranslatePickerOpen(false);
    }
  }
  document.addEventListener("mousedown", onClickOutside);
  return () => document.removeEventListener("mousedown", onClickOutside);
}, [translatePickerOpen]);
```

- [ ] **Step 7: Add `selectedTranslatedItem` derived variable after `visibleQueueItems` (around line 999):**

```ts
const selectedTranslatedItem = translatedItems.find((i) => i.id === selectedTranslatedItemId) ?? null;
```

- [ ] **Step 8: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 9: Commit**
```bash
git add app/page.tsx && git commit -m "feat: add translate state, handlers, derived vars"
```

---
### Task 7: Restructure left panel into language groups

**Files:**
- Modify: `app/page.tsx` (queue list around lines 1326-1400)

The existing queue list is wrapped in an "EN" collapsible group. EN header only shows when translated groups exist. Translated groups appear below.

- [ ] **Step 1: Replace the entire `<div className="flex-1 overflow-y-auto min-h-0">` block (around line 1327) with:**

```tsx
{/* Queue list -- grouped by language */}
<div className="flex-1 overflow-y-auto min-h-0">

  {/* EN group */}
  {visibleQueueItems.length > 0 && (
    <div>
      {translatedItems.length > 0 && (
        <button
          onClick={() => setExpandedLangGroups((prev) => {
            const next = new Set(prev);
            if (next.has("en")) next.delete("en"); else next.add("en");
            return next;
          })}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition"
        >
          <span>EN</span>
          <svg className={"h-3 w-3 transition-transform " + (expandedLangGroups.has("en") ? "rotate-0" : "-rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {(expandedLangGroups.has("en") || translatedItems.length === 0) && (
        <div>
          {visibleQueueItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSelectedItemId(item.id); setSelectedTranslatedItemId(null); }}
              className={
                "w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-2 " +
                (selectedItemId === item.id && !selectedTranslatedItemId
                  ? "bg-indigo-500/[0.08] border-indigo-500/60"
                  : "hover:bg-white/[0.03] border-transparent")
              }
            >
              <StatusIcon status={item.status} />
              <img src={item.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-white/10" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px]">
                  {item.status === "uploading" && <span className="text-indigo-400">Uploading...</span>}
                  {item.status === "generating" && <span className="text-indigo-400">Generating...</span>}
                  {item.status === "analyzed" && !item.result && <span className="text-indigo-300/60">Ready · pick a style</span>}
                  {item.status === "error" && <span className="text-red-400 truncate block">{item.error ?? "Error"}</span>}
                  {(item.status === "done" || item.status === "analyzed") && item.result && (
                    <span className="text-gray-600">
                      {FAMILY_LABELS[item.usedFamilyId ?? (item.result.familyId as FamilyId)] ?? item.result.familyId}{" "}· {item.result.format}
                    </span>
                  )}
                </p>
              </div>
              {item.approved && (
                <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )}

  {/* Translated language groups */}
  {TRANSLATION_TARGETS.filter((t) => translatedItems.some((i) => i.lang === t.code)).map((langConfig) => {
    const langItems = translatedItems.filter((i) => i.lang === langConfig.code);
    const isExpanded = expandedLangGroups.has(langConfig.code);
    return (
      <div key={langConfig.code}>
        <button
          onClick={() => setExpandedLangGroups((prev) => {
            const next = new Set(prev);
            if (next.has(langConfig.code)) next.delete(langConfig.code); else next.add(langConfig.code);
            return next;
          })}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition border-t border-white/[0.06]"
        >
          <span className="flex items-center gap-2">
            {langConfig.label}
            <span className="text-gray-700 normal-case font-normal">{langItems.length} ads</span>
          </span>
          <svg className={"h-3 w-3 transition-transform " + (isExpanded ? "rotate-0" : "-rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isExpanded && (
          <div>
            {langItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedTranslatedItemId(item.id); setSelectedItemId(null); }}
                className={
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-2 " +
                  (selectedTranslatedItemId === item.id
                    ? "bg-indigo-500/[0.08] border-indigo-500/60"
                    : "hover:bg-white/[0.03] border-transparent")
                }
              >
                <img src={item.pngUrl} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0 border border-white/10" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-600 truncate">{item.headlineText ?? "--"}</p>
                  <p className="text-[10px] text-gray-700 mt-0.5">{item.templateId.replace(/_/g, " ")}</p>
                </div>
                {item.approved && (
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/page.tsx && git commit -m "feat: restructure left panel into collapsible language groups"
```

---
### Task 8: Translate button in the stage bar

**Files:**
- Modify: `app/page.tsx` (after Crop section, before AI Style, around line 1668)

- [ ] **Step 1: Find the two closing divs that end the Crop section and the AI Style comment:**
```tsx
                </div>
                </div>

                {/* AI Style section */}
```

Insert between the `</div></div>` and the AI Style comment:

```tsx
                {/* Stage: Translate */}
                {approvedCount > 0 && (
                  <div ref={translatePickerRef} className="relative flex flex-col justify-center gap-1.5 px-5 border-r-2 border-l-2 border-white/[0.08] shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Translate</span>
                    <div className="flex items-center">
                      <button
                        onClick={() => setTranslatePickerOpen((o) => !o)}
                        disabled={translateLoading}
                        className={"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition disabled:opacity-40 " + (translatePickerOpen ? pillActive : pillInactive)}
                      >
                        {translateLoading ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                        )}
                        <span>{translateLoading ? "Translating..." : "Translate"}</span>
                      </button>
                    </div>
                    {translatePickerOpen && (
                      <div className="absolute top-full left-0 z-50 mt-2 w-52 rounded-xl border border-white/[0.10] bg-[#141414] shadow-2xl p-3 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Select languages</p>
                        {TRANSLATION_TARGETS.map((lang) => (
                          <label key={lang.code} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={translateSelectedLangs.has(lang.code)}
                              onChange={(e) => setTranslateSelectedLangs((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(lang.code); else next.delete(lang.code);
                                return next;
                              })}
                              className="rounded border-white/20 bg-white/[0.06] text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-gray-300 group-hover:text-white transition">
                              {lang.label} -- {lang.name}
                            </span>
                          </label>
                        ))}
                        <button
                          onClick={handleTranslate}
                          disabled={translateSelectedLangs.size === 0 || translateLoading}
                          className="mt-1 w-full rounded-md px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition"
                        >
                          {translateLoading ? "Translating..." : `Translate (${translateSelectedLangs.size})`}
                        </button>
                        <button
                          onClick={() => { setTranslatePickerOpen(false); setTranslateSelectedLangs(new Set()); }}
                          className="text-[11px] text-gray-600 hover:text-gray-400 text-center transition"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
```

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add app/page.tsx && git commit -m "feat: add Translate button with language picker to stage bar"
```

---
### Task 9: Translated item detail view in right panel

**Files:**
- Modify: `app/page.tsx` (right panel around line 1427)

- [ ] **Step 1: Find the right panel ternary starting with `{!selectedItem ? (`**

Change from:
```tsx
      {!selectedItem ? (
        <div className="flex-1 flex items-center justify-center">
```

To (add selectedTranslatedItem branch before the existing two branches, keeping both existing branches unchanged):
```tsx
      {selectedTranslatedItem ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                {TRANSLATION_TARGETS.find((t) => t.code === selectedTranslatedItem.lang)?.label ?? selectedTranslatedItem.lang}
              </span>
              <span className="text-xs text-gray-700">. Translated</span>
            </div>
            <button
              onClick={() => handleApproveTranslated(selectedTranslatedItem.id, !selectedTranslatedItem.approved)}
              className={
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border transition " +
                (selectedTranslatedItem.approved
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                  : "bg-white/[0.06] border-white/20 text-gray-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-400")
              }
            >
              {selectedTranslatedItem.approved ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Approved
                </>
              ) : "Approve"}
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            <img
              src={selectedTranslatedItem.pngUrl}
              alt="Translated ad"
              className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
              style={{ aspectRatio: "9/16" }}
            />
          </div>
          <div className="shrink-0 border-t border-white/[0.06] px-6 py-3">
            <p className="text-xs text-gray-600 truncate">
              <span className="text-gray-500 font-medium">Headline: </span>
              {selectedTranslatedItem.headlineText ?? "--"}
            </p>
          </div>
        </div>
      ) : !selectedItem ? (
        <div className="flex-1 flex items-center justify-center">
```

NOTE: Only add the `selectedTranslatedItem ?` branch. Keep `!selectedItem` and the existing detail view exactly as they are in the original file.

- [ ] **Step 2: Verify:** `npx tsc --noEmit` -- expected: no errors.

- [ ] **Step 3: Manual smoke test:**
  1. Upload image, generate ad, approve it
  2. "Translate" section appears in stage bar after Crop
  3. Click Translate -> check FR -> click "Translate (1)" -> spinner shown
  4. FR group appears in left panel below EN
  5. Click a FR ad -> right panel shows translated ad + Approve button
  6. Approve it -> checkmark shows in left panel
  7. Collapse/expand EN and FR groups

- [ ] **Step 4: Commit**
```bash
git add app/page.tsx && git commit -m "feat: add translated item detail view to right panel"
```

---

### Task 10: Push branch and open PR

- [ ] **Step 1: Ensure all commits are on feature branch (not master):**
```bash
git log --oneline -10
git branch
```

- [ ] **Step 2: Push and create PR:**
```bash
git push -u origin feature/translate-approved
gh pr create --title "feat: translate approved ads to SE, GR, FR, ES" --body "Adds one-click translation of all approved EN ads into target languages. Translated ads appear in collapsible language groups in the left panel for individual review and approval. Claude Haiku performs culturally adapted translation in a single batch call per language. Adding a new language requires a single line in lib/languages.ts."
```

---

## Summary

| File | Type | Purpose |
|------|------|---------|
| `lib/languages.ts` | NEW | Language config -- add new languages here only |
| `lib/ai/translate.ts` | NEW | Claude Haiku batch translation |
| `app/api/translate/route.ts` | NEW | API endpoint |
| `lib/types.ts` | MODIFY | Language type: add sv, el |
| `lib/db.ts` | MODIFY | getApprovedResults() |
| `app/page.tsx` | MODIFY | Types, state, handlers, left panel, stage bar, detail view |

**To add a new language in the future:** add one line to `lib/languages.ts`. Done.