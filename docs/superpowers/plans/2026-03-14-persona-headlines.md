# Persona Headlines Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Generate one English headline per persona per image using a single Haiku text call (no vision - uses cached ImageTags), cache results in DB, apply when user selects a persona.

**Architecture:** New persona_headlines table stores (image_id, persona_id, headline, language) rows. lib/ai/personaHeadlines.ts reads images.tags + all personas from DB, builds one text-only prompt, returns Record<personaId, headline>. Headlines generated eagerly during /api/analyze (same as tags), served instantly from cache at persona-select time. language column is future-proofed for translation but only en is generated now.

**Tech Stack:** Next.js 14 App Router, TypeScript, Anthropic SDK (claude-haiku-4-5-20251001), Turso/libSQL via lib/db.ts

---

## Chunk 1: DB — Table + Queries

### Task 1: Add persona_headlines table to migrate()

**Files:**
- Modify: lib/db.ts (after the persona_image_fit CREATE TABLE block, before closing ] of the batch)

- [ ] **Step 1: Add the CREATE TABLE statement**

In lib/db.ts, find the persona_image_fit CREATE TABLE block (lines ~126-133). Add the following immediately after it, before the closing ] of the client.batch call:

```ts
    `CREATE TABLE IF NOT EXISTS persona_headlines (
  image_id   TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  headline   TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (image_id, persona_id, language),
  FOREIGN KEY (image_id)   REFERENCES images(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
)`,
```

- [ ] **Step 2: Verify the batch array is still valid — every entry must have a trailing comma**

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add persona_headlines table to DB migration"
```

---

### Task 2: Add three DB query functions

**Files:**
- Modify: lib/db.ts — add after the upsertImageTags function (~line 237)

- [ ] **Step 1: Insert the three query functions immediately after upsertImageTags closing brace**

```ts
// -- Persona Headlines queries
export async function upsertPersonaHeadlines(
  rows: { imageId: string; personaId: string; headline: string; language: string }[]
): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  for (const r of rows) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO persona_headlines (image_id, persona_id, headline, language)
            VALUES (?, ?, ?, ?)`,
      args: [r.imageId, r.personaId, r.headline, r.language],
    });
  }
}

export async function getPersonaHeadlines(
  imageId: string,
  language = "en"
): Promise<Record<string, string>> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT persona_id, headline FROM persona_headlines WHERE image_id = ? AND language = ?`,
    args: [imageId, language],
  });
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.persona_id as string] = row.headline as string;
  }
  return map;
}

export async function hasPersonaHeadlines(
  imageId: string,
  language = "en"
): Promise<boolean> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: `SELECT COUNT(*) as n FROM persona_headlines WHERE image_id = ? AND language = ?`,
    args: [imageId, language],
  });
  return ((result.rows[0]?.n as number) ?? 0) > 0;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:/Users/jiwar computer/ai-ad-agent"
npx tsc --noEmit 2>&1 | grep -i "upsertPersona\|getPersonaHead\|hasPersona"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add upsertPersonaHeadlines, getPersonaHeadlines, hasPersonaHeadlines"
```

---
## Chunk 2: AI Function

### Task 3: Create lib/ai/personaHeadlines.ts

**Files:**
- Create: lib/ai/personaHeadlines.ts

Pure text call to Haiku - no image sent. Reads images.tags (already cached by analyze) and all persona profiles from DB, builds one prompt, returns Record<personaId, headline>. Always falls back to a generic headline so the app never breaks.

- [ ] **Step 1: Create the file with this exact content**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ImageTags } from "@/lib/types";
import { withRetry } from "./retry";

const MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_HEADLINE = "The nails made for you";

/**
 * Generates one English headline per persona for a given image.
 * Uses pre-cached ImageTags - pure text prompt, no vision tokens.
 * Returns Record<personaId, headline>. Falls back on any error.
 */
export async function generatePersonaHeadlines(
  imageId: string
): Promise<Record<string, string>> {
  const { getImage, getAllPersonas } = await import("@/lib/db");

  const img = await getImage(imageId);
  if (!img) throw new Error(`Image ${imageId} not found`);

  const tags = img.tags as ImageTags | null;
  if (!tags) throw new Error(`Image ${imageId} has no tags - run analyze first`);

  const personas = await getAllPersonas();

  if (process.env.SKIP_AI === "true") {
    console.log("[persona-headlines] SKIP_AI=true - using hardcoded fallback");
    return Object.fromEntries(personas.map((p) => [p.id, FALLBACK_HEADLINE]));
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[persona-headlines] ANTHROPIC_API_KEY not set - using hardcoded fallback");
    return Object.fromEntries(personas.map((p) => [p.id, FALLBACK_HEADLINE]));
  }

  const personaBlock = personas
    .map(
      (p) =>
        `ID: ${p.id}
Name: ${p.name}
Motivation: ${p.motivation}
Trigger: ${p.triggerMessage}
Tones: ${p.tones.join(", ")}
Angle: ${p.creativeAngle}`
    )
    .join("

");

  const prompt = `You are an expert ad copywriter for SWITCH NAILS (press-on nails brand).

Product characteristics:
- Color: ${tags.color}
- Finish: ${tags.finish}
- Length: ${tags.length}
- Shape: ${tags.shape}
- Style mood: ${tags.style_mood}
- Complexity: ${tags.complexity}
- Occasion: ${tags.occasion ?? "everyday"}
- Nail art: ${tags.nail_art_type ?? "plain"}

Write one punchy English headline (4-8 words) for each persona below.
Each headline must reflect BOTH the product characteristics AND the persona motivation and tone.
Rules: no emojis, no generic phrases, specific to press-on nails, match the persona tones.

Return ONLY raw JSON (no markdown) mapping each ID to its headline:
{
  "per_trend_1": "headline here",
  "per_trend_2": "headline here"
}

Personas:
${personaBlock}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(
      () =>
        client.messages.create({
          model: MODEL,
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      "persona-headlines"
    );

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<string, string>;

    console.log(`[persona-headlines] Generated ${Object.keys(parsed).length} headlines for ${imageId}`);
    return parsed;
  } catch (err) {
    console.error("[persona-headlines] Claude call failed - using hardcoded fallback:", err);
    return Object.fromEntries(personas.map((p) => [p.id, FALLBACK_HEADLINE]));
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "personaHeadlines"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/personaHeadlines.ts
git commit -m "feat: create generatePersonaHeadlines AI function"
```

---
## Chunk 3: API Layer

### Task 4: Wire generation into /api/analyze

**Files:**
- Modify: app/api/analyze/route.ts

Add persona headlines as the fourth step in analyze, using the same cache-check pattern as the other three steps.

- [ ] **Step 1: Update the @/lib/db import**

Replace the existing db import block with:

```ts
import {
  getImage,
  insertImage,
  getSafeZones,
  upsertSafeZones,
  getCopyPool,
  upsertCopyPool,
  upsertImageTags,
  hasPersonaHeadlines,
  upsertPersonaHeadlines,
} from "@/lib/db";
```

- [ ] **Step 2: Add the AI import after the existing extractImageTags import**

```ts
import { generatePersonaHeadlines } from "@/lib/ai/personaHeadlines";
```

- [ ] **Step 3: Add the persona headlines block after the image tags block**

Find these lines (around lines 59-64):

```ts
    // Image tags - cached in images.tags column, extracted once per image
    const freshImage = await getImage(imageId);
    if (!freshImage?.tags) {
      const tags = await extractImageTags(imageId);
      await upsertImageTags(imageId, tags);
    }
```

Insert immediately after the closing brace:

```ts
    // Persona headlines - one Haiku text call per image, cached forever
    if (!(await hasPersonaHeadlines(imageId, "en"))) {
      const generated = await generatePersonaHeadlines(imageId);
      const rows = Object.entries(generated).map(([personaId, headline]) => ({
        imageId,
        personaId,
        headline,
        language: "en",
      }));
      await upsertPersonaHeadlines(rows);
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "analyze"
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: generate and cache persona headlines during analyze"
```

---

### Task 5: Create GET /api/persona-headlines endpoint

**Files:**
- Create: app/api/persona-headlines/route.ts

Read-through cache: returns immediately on hit, generates+stores on miss (handles images analyzed before this feature existed).

- [ ] **Step 1: Create the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  hasPersonaHeadlines,
  getPersonaHeadlines,
  upsertPersonaHeadlines,
} from "@/lib/db";
import { generatePersonaHeadlines } from "@/lib/ai/personaHeadlines";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");
  if (!imageId) {
    return NextResponse.json({ error: "imageId required" }, { status: 400 });
  }

  try {
    if (await hasPersonaHeadlines(imageId, "en")) {
      const headlines = await getPersonaHeadlines(imageId, "en");
      return NextResponse.json(headlines);
    }

    // Not cached (image pre-dates this feature) - generate on demand
    const generated = await generatePersonaHeadlines(imageId);
    const rows = Object.entries(generated).map(([personaId, headline]) => ({
      imageId,
      personaId,
      headline,
      language: "en",
    }));
    await upsertPersonaHeadlines(rows);
    return NextResponse.json(generated);
  } catch (err) {
    console.error("[persona-headlines GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "persona-headlines"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/persona-headlines/route.ts
git commit -m "feat: add GET /api/persona-headlines read-through cache endpoint"
```

---
## Chunk 4: page.tsx Integration

### Task 6: Apply persona headline on persona select

**Files:**
- Modify: app/page.tsx

When user selects a persona, fetch its pre-computed headline from cache and apply it to the ad via the existing /api/regenerate customHeadline mechanism.

- [ ] **Step 1: Add handlePersonaHeadline callback**

Find handleNewHeadlineWithTone (around line 693). Insert the following new callback immediately after its closing brace + deps array line ([detailLoading, updateItem]):

```ts
  const handlePersonaHeadline = useCallback(
    async (item: QueueItem, personaId: string) => {
      if (!item.result || !item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/persona-headlines?imageId=${encodeURIComponent(item.imageId)}`);
        if (!res.ok) throw new Error("Could not fetch persona headlines");
        const headlines: Record<string, string> = await res.json();
        const headline = headlines[personaId];
        if (!headline) return;

        const regenRes = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resultId: item.result.id,
            mode: "headline",
            angle: "own",
            customHeadline: headline,
          }),
        });
        if (!regenRes.ok) {
          const d = await regenRes.json();
          throw new Error(d.error || "Regeneration failed");
        }
        const data = await regenRes.json();
        updateItem(item.id, {
          result: {
            ...data.result,
            subjectPos: data.result.subjectPos ?? item.result?.subjectPos,
            attribution: data.result.attribution ?? item.result?.attribution,
          },
          approved: false,
        });
      } catch (err) {
        console.error("Persona headline error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );
```

- [ ] **Step 2: Update persona select onChange**

Find this line (search for handleNewHeadlineWithTone(selectedItem, persona.tones[0])):

```ts
      handleNewHeadlineWithTone(selectedItem, persona.tones[0]);
```

Replace with:

```ts
      handlePersonaHeadline(selectedItem, persona.id);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "handlePersona"
```

Expected: no output.

- [ ] **Step 4: Manual smoke test**

1. Start dev server: npm run dev
2. Upload a new image, click Analyze All
3. Watch server logs - expect to see:
   - [tags] ImageTags from Claude for img_xxx: { ... }
   - [persona-headlines] Generated 18 headlines for img_xxx
4. Generate an ad (click any layout pill)
5. Select a persona from the dropdown - ad headline should update to that persona headline
6. Select a different persona - headline updates with different text
7. Switch back to first persona - headline applies instantly, no new AI call in logs (cache hit)
8. Verify dropdown is still disabled for SVG Surprise ads

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: apply persona headline to ad on persona select"
```
