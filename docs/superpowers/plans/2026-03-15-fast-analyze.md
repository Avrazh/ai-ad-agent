# Fast Analyze Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Reduce analyze from 4 sequential AI calls (~10s) to 1 AI call (~2s) by removing copy pool, image tags, and per-image persona headline generation. Ads use per-persona headlines from DB instead.

**Architecture:** Strip /api/analyze to only run analyzeSafeZones. Add personaId to generate request body and AdSpec so generate/regenerate can fetch persona headlines from the persona_headlines table. For new images where no persona headlines exist, fall back to hardcoded string. Remove copy pool from generate and regenerate entirely.

**Tech Stack:** Next.js 14 App Router, TypeScript, Turso/libSQL, Node.js

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| app/api/analyze/route.ts | Modify | Remove generateCopyPool, extractImageTags, generatePersonaHeadlines |
| lib/types.ts | Modify | Add personaId to AdSpec |
| lib/db.ts | Modify | Add getPersonaHeadlinesForPersona query |
| app/api/generate/route.ts | Modify | Accept personaId, use persona headlines, remove copy pool |
| app/api/regenerate/route.ts | Modify | Remove copy pool, use persona headlines for New Headline |
| app/page.tsx | Modify | Pass activePersonaId to generate fetch calls |

---

## Chunk 1: Strip analyze + extend types + add DB query

### Task 1: Strip app/api/analyze/route.ts to 1 AI call

**Files:**
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Remove the 3 slow AI call blocks**

Remove these three blocks from the POST handler body.

Block 1 (copy pool, around line 55):

    const cachedCopy = await getCopyPool(imageId);
    if (!cachedCopy) {
      const copyPool = await generateCopyPool(imageId);
      await upsertCopyPool(imageId, JSON.stringify(copyPool));
    }

Block 2 (image tags, around line 62):

    const freshImage = await getImage(imageId);
    if (!freshImage?.tags) {
      const tags = await extractImageTags(imageId);
      await upsertImageTags(imageId, tags);
    }

Block 3 (persona headlines, around line 69):

    if (!(await hasPersonaHeadlines(imageId, "en"))) {
      const generated = await generatePersonaHeadlines(imageId);
      ...rows...
      await upsertPersonaHeadlines(rows);
    }

- [ ] **Step 2: Remove unused imports**

Remove these imports:
- `generateCopyPool` from `@/lib/ai/copy`
- `extractImageTags` from `@/lib/ai/tags`
- `generatePersonaHeadlines` from `@/lib/ai/personaHeadlines`
- From `@/lib/db`: `getCopyPool`, `upsertCopyPool`, `upsertImageTags`, `hasPersonaHeadlines`, `upsertPersonaHeadlines`

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 4: Commit**

    git add app/api/analyze/route.ts
    git commit -m "perf: strip analyze to 1 AI call"

---

### Task 2: Add personaId to AdSpec in lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add personaId field to AdSpec interface**

After `scenePersonaId?: string` add:

    personaId?: string;  // active persona when the ad was generated

- [ ] **Step 2: Verify TypeScript compiles**

    npx tsc --noEmit

- [ ] **Step 3: Commit**

    git add lib/types.ts
    git commit -m "feat: add personaId to AdSpec"

---

### Task 3: Add getPersonaHeadlinesForPersona to lib/db.ts

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Find getPersonaHeadlines function and add a focused query after it**

Add this function after `getPersonaHeadlines`:

    export async function getPersonaHeadlinesForPersona(
      imageId: string,
      personaId: string,
      lang = "en"
    ): Promise<{ tone: string; headline: string }[]> {
      const client = await getClient();
      const rows = await client.execute({
        sql: `SELECT tone, headline FROM persona_headlines
              WHERE image_id = ? AND persona_id = ? AND language = ?
              ORDER BY tone`,
        args: [imageId, personaId, lang],
      });
      return rows.rows.map((r) => ({
        tone: r.tone as string,
        headline: r.headline as string,
      }));
    }

- [ ] **Step 2: Verify TypeScript compiles**

    npx tsc --noEmit

- [ ] **Step 3: Commit**

    git add lib/db.ts
    git commit -m "feat: add getPersonaHeadlinesForPersona db query"

---

## Chunk 2: Replace copy pool in generate and regenerate

### Task 4: app/api/generate/route.ts

**Files:** Modify: app/api/generate/route.ts

- [ ] Step 1: Add personaId to body destructuring

Add personaId as an optional string alongside the other body params.

- [ ] Step 2: Update imports

Add getPersonaHeadlinesForPersona to @/lib/db import.
Remove getCopyPool, upsertCopyPool from @/lib/db import.
Remove generateCopyPool import line from @/lib/ai/copy.
Remove CopyPool and CopySlot from type imports.

- [ ] Step 3: Delete copy pool block from SURPRISE path (around line 97)

Delete the block starting with: // 2. Ensure CopyPool exists

Then find the TWO spots (forceSurpriseSpec branch and savedSurpriseSpecId branch)
where copy pool replaces the spec headline (using langSlots/hlSlot).
Replace each block with:

    const personaHls = personaId
      ? await getPersonaHeadlinesForPersona(imageId, personaId, lang)
      : [];
    const headline = personaHls[0]?.headline ?? surprise.en.headline;
    const subtext = surprise.en.subtext;
    surprise = { ...surprise, en: { headline, subtext }, de: { headline, subtext } };

- [ ] Step 4: Replace copy pool in the normal generate path (around line 239)

Replace the getCopyPool/generateCopyPool block and langSlots declaration with:

    const FALLBACK_HEADLINE = "The nails made for you";
    const personaHls = personaId
      ? await getPersonaHeadlinesForPersona(imageId, personaId, lang)
      : [];
    const dims = FORMAT_DIMS[format];

- [ ] Step 5: Replace copy slot picking inside the family loop

Remove usedSlotIds and headlineAngles variables declared before the loop.
Inside the for-each-family loop, remove the inner for-loop that calls pickSlot.
Replace the copy-building section with:

    const toneRow = personaHls[specIndex % (personaHls.length || 1)];
    const primarySlotId = personaId
      ? (personaId + ":" + (toneRow?.tone ?? "default"))
      : "default";
    const copy: AdSpec["copy"] = {};
    for (const slotType of style.copySlots) {
      if (slotType === "headline" || slotType === "quote") {
        copy[slotType] = toneRow?.headline ?? FALLBACK_HEADLINE;
      }
    }

Keep specIndex++ at end of outer loop.

- [ ] Step 6: Add personaId to AdSpec construction

    ...(personaId ? { personaId } : {}),

- [ ] Step 7: Remove pickSlot and lengthTag helpers from bottom of file

- [ ] Step 8: Verify TypeScript compiles

    npx tsc --noEmit

- [ ] Step 9: Commit

    git add app/api/generate/route.ts
    git commit -m "perf: replace copy pool with persona headlines in generate route"

---

### Task 5: app/api/regenerate/route.ts

**Files:** Modify: app/api/regenerate/route.ts

HARD RULE: never import from @/lib/ai/. DB imports are fine.

- [ ] Step 1: Update imports

Add getPersonaHeadlinesForPersona to db import.
Remove getCopyPool. Remove CopyPool and CopySlot type imports.

- [ ] Step 2: Replace copyPool load + safety gate (around line 52)

Replace the block that loads copyPoolJson and the guard checking both safeZonesJson and copyPoolJson,
plus the const copyPool and langSlots lines, with:

    if (!safeZonesJson) {
      return NextResponse.json({ error: "No safe zones -- generate first" }, { status: 400 });
    }
    const FALLBACK_HEADLINE = "The nails made for you";
    const personaHls = oldSpec.personaId
      ? await getPersonaHeadlinesForPersona(oldSpec.imageId, oldSpec.personaId, lang)
      : [];

- [ ] Step 3: Replace style mode copy rebuilding

Replace entire content of if (mode === "style") block with:

    if (mode === "style") {
      const newStyle = pickDifferentStyle(oldSpec.familyId, oldSpec.templateId);
      newTemplateId = newStyle.id;
      newZoneId = pickBestZone(safeZones, newStyle.supportedZones, oldSpec.zoneId);
      newPrimarySlotId = oldSpec.primarySlotId;
      newCopy = { ...oldSpec.copy };
    }

- [ ] Step 4: Replace headline mode slot cycling

Replace entire if (mode === "headline") block with:

    if (mode === "headline") {
      const currentTemplate = getTemplate(oldSpec.templateId);
      const primarySlotType = currentTemplate.copySlots[0] ?? "headline";

      if (angle === "own" && customHeadline) {
        newPrimarySlotId = "own";
        newCopy = { ...oldSpec.copy, [primarySlotType]: customHeadline };
        delete newCopy.subtext;
      } else {
        const currentTone = oldSpec.primarySlotId?.split(":")[1];
        const nextRow = personaHls.find((r) => r.tone !== currentTone) ?? personaHls[0];
        if (nextRow) {
          newPrimarySlotId = oldSpec.personaId
            ? (oldSpec.personaId + ":" + nextRow.tone)
            : "default";
          newCopy = { ...oldSpec.copy, [primarySlotType]: nextRow.headline };
          delete newCopy.subtext;
        }
        newZoneId = pickBestZone(safeZones, currentTemplate.supportedZones, oldSpec.zoneId);
      }
    }

- [ ] Step 5: Verify TypeScript compiles

    npx tsc --noEmit

- [ ] Step 6: Commit

    git add app/api/regenerate/route.ts
    git commit -m "perf: replace copy pool with persona headlines in regenerate route"

---

## Chunk 3: Client

### Task 6: app/page.tsx -- pass personaId to generate

**Files:** Modify: app/page.tsx

- [ ] Step 1: Find all fetch("/api/generate") calls

Search page.tsx for: fetch("/api/generate"
Includes handleRerender, handleSplitScene, and layout pill render calls.

- [ ] Step 2: Add personaId to every generate fetch body

    personaId: activePersonaId ?? undefined,

- [ ] Step 3: Verify TypeScript compiles

    npx tsc --noEmit

- [ ] Step 4: Manual smoke test

1. Upload new image, click Analyze All -- completes in ~2s (was ~10s)
2. Select persona, click layout pill -- ad renders with persona headline or fallback text
3. New Headline -- cycles to the other persona tone
4. Style switch -- copy is preserved, layout changes
5. Surprise Me still works

- [ ] Step 5: Commit

    git add app/page.tsx
    git commit -m "feat: pass personaId to generate for persona-specific headlines"
