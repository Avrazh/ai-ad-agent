# Translate Approved Ads Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to culturally adapt all approved ads into multiple languages, with draggable translated headlines shown as overlays over the original PNG - final render only on Approve.

**Architecture:** New `lib/ai/translateHeadlines.ts` sends approved headlines to Claude Haiku for cultural adaptation (not literal translation). New `POST /api/translate` endpoint. `page.tsx` gets a Translate button that opens a language picker modal, creates draft QueueItems reusing original PNGs with translated overlay text. On Approve, `/api/regenerate` is called with a new `langOverride` param so the final AdSpec records the correct language.

**Tech Stack:** Next.js 14 App Router, TypeScript, React useState/useCallback, Anthropic SDK (claude-haiku-4-5-20251001), Turso/libSQL via lib/db.ts, Playwright PNG rendering

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/ai/translateHeadlines.ts` | Create | Haiku cultural adaptation batch call |
| `app/api/translate/route.ts` | Create | POST endpoint: receives headlines + target langs |
| `app/api/regenerate/route.ts` | Modify | Add `langOverride` param |
| `app/page.tsx` | Modify | Language type, TRANSLATE_LANGUAGES, QueueItem fields, state, handleTranslate, handleApprove update, Translate button, modal, language badge |

---

## Chunk 1: AI Translation Module

### Task 1: Create lib/ai/translateHeadlines.ts

**Files:**
- Create: `lib/ai/translateHeadlines.ts`

- [ ] **Step 1: Create the translation module**

Create `lib/ai/translateHeadlines.ts` with this content:

    import Anthropic from "@anthropic-ai/sdk";
    import { withRetry } from "./retry";

    const MODEL = "claude-haiku-4-5-20251001";

    export interface HeadlineInput {
      id: string;
      text: string;
    }

    export async function translateHeadlines(
      headlines: HeadlineInput[],
      targetLanguages: string[]
    ): Promise<Record<string, Record<string, string>>> {
      const makeFallback = () =>
        Object.fromEntries(
          headlines.map((h) => [
            h.id,
            Object.fromEntries(targetLanguages.map((l) => [l, h.text])),
          ])
        );

      if (process.env.SKIP_AI === "true") return makeFallback();
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return makeFallback();

      const headlineBlock = headlines
        .map((h) => "ID: " + h.id + "\nText: " + h.text)
        .join("\n\n");

      const prompt = [
        "You are an expert advertising copywriter for SWITCH NAILS (press-on nails).",
        "Culturally adapt each headline into the target languages.",
        "NOT literal translation: adapt idiom, register, cultural resonance.",
        "Rules: 4-8 words, natural idioms, no emojis, preserve emotional tone.",
        "",
        "Target languages: " + targetLanguages.join(", "),
        "",
        "Return ONLY raw JSON: { \"<id>\": { \"<lang>\": \"<adapted>\" } }",
        "",
        "Headlines to adapt:",
        headlineBlock,
      ].join("\n");

      try {
        const client = new Anthropic({ apiKey });
        const response = await withRetry(
          () => client.messages.create({
            model: MODEL,
            max_tokens: 1200,
            messages: [{ role: "user", content: prompt }],
          }),
          "translate-headlines"
        );
        const raw = response.content.find((b) => b.type === "text")?.text ?? "";
        const clean = raw.replace(/^```(?:json)?[\s]*/i, "").replace(/[\s]*```[\s]*$/i, "").trim();
        const parsed = JSON.parse(clean) as Record<string, Record<string, string>>;
        const count = Object.values(parsed).reduce((n, langs) => n + Object.keys(langs).length, 0);
        console.log("[translate] Generated " + count + " adaptations");
        return parsed;
      } catch (err) {
        console.error("[translate] Haiku call failed - using fallback:", err);
        return makeFallback();
      }
    }

- [ ] **Step 2: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 3: Commit**

    git add lib/ai/translateHeadlines.ts
    git commit -m "feat: add cultural headline adaptation module"

---

## Chunk 2: API Endpoint

### Task 2: Create app/api/translate/route.ts

**Files:**
- Create: `app/api/translate/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/translate/route.ts`:

    import { NextRequest, NextResponse } from "next/server";
    import { translateHeadlines } from "@/lib/ai/translateHeadlines";

    export async function POST(req: NextRequest) {
      try {
        const body = await req.json();
        const { headlines, targetLanguages } = body as {
          headlines: { id: string; text: string }[];
          targetLanguages: string[];
        };
        if (!Array.isArray(headlines) || headlines.length === 0)
          return NextResponse.json({ error: "headlines array required" }, { status: 400 });
        if (!Array.isArray(targetLanguages) || targetLanguages.length === 0)
          return NextResponse.json({ error: "targetLanguages array required" }, { status: 400 });
        const result = await translateHeadlines(headlines, targetLanguages);
        return NextResponse.json(result);
      } catch (err) {
        console.error("[/api/translate]", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed" },
          { status: 500 }
        );
      }
    }

- [ ] **Step 2: Smoke-test**

With dev server running:
    POST http://localhost:3000/api/translate
    Body: {"headlines":[{"id":"h1","text":"Salon nails at home"}],"targetLanguages":["de","fr"]}
    Expected: {"h1":{"de":"...","fr":"..."}} with culturally adapted copy (not word-for-word).

- [ ] **Step 3: Commit**

    git add app/api/translate/route.ts
    git commit -m "feat: add POST /api/translate endpoint"

---

## Chunk 3: langOverride in /api/regenerate

### Task 3: Add langOverride param to app/api/regenerate/route.ts

**Files:**
- Modify: `app/api/regenerate/route.ts`

- [ ] **Step 1: Read the file**

Read `app/api/regenerate/route.ts` to find where `lang` is destructured from `req.json()` and where `newSpec` is constructed.

- [ ] **Step 2: Add langOverride to body destructuring**

Add `langOverride` alongside `lang` in the destructuring from `req.json()`.

- [ ] **Step 3: Apply langOverride when building newSpec**

Change the lang assignment in newSpec from:
    lang: lang ?? oldSpec.lang,
To:
    lang: (langOverride as typeof oldSpec.lang) ?? lang ?? oldSpec.lang,

- [ ] **Step 4: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 5: Commit**

    git add app/api/regenerate/route.ts
    git commit -m "feat: add langOverride param to regenerate endpoint"

---

## Chunk 4: page.tsx -- Types, Constants, State

### Task 4: Extend types, add TRANSLATE_LANGUAGES, add QueueItem fields and state

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Expand Language type**

Find the `Language` type. Replace with:
    type Language = "en" | "de" | "fr" | "es" | "ar" | "nl" | "it" | "pt";

- [ ] **Step 2: Add TRANSLATE_LANGUAGES constant**

After the Language type, add:

    const TRANSLATE_LANGUAGES: { code: Language; label: string }[] = [
      { code: "de", label: "German" },
      { code: "fr", label: "French" },
      { code: "es", label: "Spanish" },
      { code: "ar", label: "Arabic" },
      { code: "nl", label: "Dutch" },
      { code: "it", label: "Italian" },
      { code: "pt", label: "Portuguese" },
    ];

- [ ] **Step 3: Add translation fields to QueueItem**

In the QueueItem interface, add:

    translationDraft?: boolean;   // true = draft, not yet Playwright-rendered
    sourceResultId?: string;      // resultId of the original approved ad
    translationLang?: string;     // language code this draft targets

- [ ] **Step 4: Add translation modal state**

In the useState block, add:

    const [translateModalOpen, setTranslateModalOpen] = useState(false);
    const [selectedTranslateLangs, setSelectedTranslateLangs] = useState<Language[]>([]);
    const [translating, setTranslating] = useState(false);

- [ ] **Step 5: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 6: Commit**

    git add app/page.tsx
    git commit -m "feat: add translation types, constants, and state"

---

## Chunk 5: page.tsx -- handleTranslate and handleApprove

### Task 5: Implement handleTranslate and update handleApprove for drafts

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add handleTranslate callback**

Add after existing handlers in the useCallback block. The callback:
1. Guards against empty selectedTranslateLangs
2. Sets translating=true, closes modal
3. Collects approved items (non-drafts with a result)
4. Builds headlines array: [{id: item.id, text: item.headlineText ?? item.result?.headline ?? ""}]
5. POSTs to /api/translate with {headlines, targetLanguages: selectedTranslateLangs}
6. Parses response as Record<id, Record<lang, text>>
7. For each approved item x each lang (skipping existing lang drafts):
   - Creates a draft QueueItem with: id="${item.id}_${lang}_${Date.now()}", file, status:"done",
     approved:false, translationDraft:true, sourceResultId:item.result?.id, translationLang:lang,
     headlineText:translatedText, result:{...item.result, headline:translatedText}
8. Appends drafts to queue via setQueue
9. Sets translating=false in finally block

Deduplication: check existing queue for items where translationDraft=true AND sourceResultId=item.result?.id, collect their translationLang values, skip those langs.

Dependencies: [queue, selectedTranslateLangs]

- [ ] **Step 2: Update handleApprove to render translation drafts first**

Find `handleApprove`. Change item param to `let` if it is `const`. At the very top of the function body, add:

    if (item.translationDraft && item.sourceResultId && item.translationLang && item.headlineText) {
      try {
        const res = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resultId: item.sourceResultId,
            angle: "own",
            customHeadline: item.headlineText,
            langOverride: item.translationLang,
          }),
        });
        const data = await res.json();
        if (data.result) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, result: data.result, translationDraft: false } : q
            )
          );
          item = { ...item, result: data.result, translationDraft: false };
        }
      } catch (err) {
        console.error("[handleApprove translation render]", err);
        return;
      }
    }

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 4: Commit**

    git add app/page.tsx
    git commit -m "feat: add handleTranslate and translation-aware handleApprove"

---

## Chunk 6: page.tsx -- UI

### Task 6: Add Translate button, language picker modal, and language badge

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add Translate button**

In the sidebar or action bar near the Approve button, add (only shows when at least one non-draft approved item exists):

    {queue.some((q) => q.approved && !q.translationDraft) && (
      <button
        onClick={() => setTranslateModalOpen(true)}
        disabled={translating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-40 transition-colors"
      >
        {translating ? "Translating..." : "Translate Approved"}
      </button>
    )}

- [ ] **Step 2: Add translation modal**

Near the existing feedback modal in JSX, add a fixed overlay modal with:
- Title: "Translate Approved Ads"
- Subtitle: "Cultural adaptation, not literal translation. Choose target languages:"
- Checkbox list for each entry in TRANSLATE_LANGUAGES (code, label)
  - checked: selectedTranslateLangs.includes(code)
  - onChange: add/remove from selectedTranslateLangs
- Cancel button: closes modal, resets selectedTranslateLangs to []
- Translate button: disabled when no langs selected, calls handleTranslate
  - Label: "Translate to N lang(s)"
- Styling: fixed inset-0 z-50 flex center, bg-black/70 backdrop, dark card bg-[#1c1c1e]

- [ ] **Step 3: Add language badge to queue items**

Inside the queue item thumbnail container (ensure wrapper has `relative` positioning), add:

    {item.translationLang && (
      <span className="absolute top-1 left-1 bg-indigo-600/80 text-white text-[9px] font-bold uppercase tracking-wider rounded px-1 py-0.5">
        {item.translationLang}
      </span>
    )}

- [ ] **Step 4: Manual smoke test**

1. Open http://localhost:3000
2. Upload an image, analyze, render an ad, approve it
3. Verify "Translate Approved" button appears
4. Click it -- modal opens with 7 language checkboxes
5. Select German and French, click "Translate to 2 langs"
6. Verify 2 new items appear in queue with "de" and "fr" badges
7. Click a draft -- detail panel shows translated headline as draggable overlay over original PNG
8. Headline text should be culturally adapted (not word-for-word)
9. Click Approve on the draft -- Playwright renders a new PNG with translated text baked in
10. Verify approved translated item shows the final rendered PNG
11. Re-open modal, select German again -- no duplicate "de" draft created

- [ ] **Step 5: Commit**

    git add app/page.tsx
    git commit -m "feat: translate modal, language badges, translation UI complete"
