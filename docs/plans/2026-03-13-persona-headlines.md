# Persona Headlines Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persona-aware headline generation so each of 18 personas gets tailored copy slots per image, with fit filtering and progressive background generation.

**Architecture:** Three new additions alongside existing flow: `copy_slots` table (unified copy storage), `persona_image_fit` table (per-persona fit ratings), and parallel AI calls at analyze time. Generic copy + fit check fire simultaneously; persona copy generates in background per fitting persona.

**Tech Stack:** Next.js App Router, Turso/libSQL, Claude Haiku (`claude-haiku-4-5-20251001`), TypeScript

---

## Task 1: Add copy_slots and persona_image_fit tables to DB

**Files:**
- Modify: `lib/db.ts`

**Context:**
`copy_slots` replaces `copy_pools` as the unified copy store. `persona_id IS NULL` means generic copy. `tone` maps to the existing `Angle` type. `slot_type` maps to `CopySlotType`.

**Step 1: Add tables to migrate() batch in lib/db.ts after the personas table (around line 113)**

```typescript
`CREATE TABLE IF NOT EXISTS copy_slots (
  id          TEXT PRIMARY KEY,
  image_id    TEXT NOT NULL,
  persona_id  TEXT,
  slot_type   TEXT NOT NULL,
  tone        TEXT,
  language    TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (image_id)   REFERENCES images(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
)`,
`CREATE TABLE IF NOT EXISTS persona_image_fit (
  image_id   TEXT NOT NULL,
  persona_id TEXT NOT NULL,
  fit        TEXT NOT NULL,
  PRIMARY KEY (image_id, persona_id),
  FOREIGN KEY (image_id)   REFERENCES images(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
)`,
```

**Step 2: Add query functions at bottom of lib/db.ts**

```typescript
export async function insertCopySlot(row: {
  id: string; imageId: string; personaId?: string;
  slotType: string; tone?: string; language: string; text: string;
}): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: 'INSERT OR IGNORE INTO copy_slots (id, image_id, persona_id, slot_type, tone, language, text) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [row.id, row.imageId, row.personaId ?? null, row.slotType, row.tone ?? null, row.language, row.text],
  });
}

export async function getCopySlotsByImage(imageId: string, personaId?: string | null) {
  await ensureMigrated();
  const client = getClient();
  const result = personaId
    ? await client.execute({ sql: 'SELECT * FROM copy_slots WHERE image_id = ? AND persona_id = ? ORDER BY created_at', args: [imageId, personaId] })
    : await client.execute({ sql: 'SELECT * FROM copy_slots WHERE image_id = ? AND persona_id IS NULL ORDER BY created_at', args: [imageId] });
  return result.rows.map((row) => ({
    id: row.id as string, imageId: row.image_id as string,
    personaId: row.persona_id as string | null, slotType: row.slot_type as string,
    tone: row.tone as string | null, language: row.language as string,
    text: row.text as string, createdAt: row.created_at as string,
  }));
}

export async function hasCopySlots(imageId: string, personaId?: string | null): Promise<boolean> {
  await ensureMigrated();
  const client = getClient();
  const result = personaId
    ? await client.execute({ sql: 'SELECT 1 FROM copy_slots WHERE image_id = ? AND persona_id = ? LIMIT 1', args: [imageId, personaId] })
    : await client.execute({ sql: 'SELECT 1 FROM copy_slots WHERE image_id = ? AND persona_id IS NULL LIMIT 1', args: [imageId] });
  return result.rows.length > 0;
}

export async function upsertPersonaImageFit(imageId: string, personaId: string, fit: "good" | "poor"): Promise<void> {
  await ensureMigrated();
  const client = getClient();
  await client.execute({
    sql: 'INSERT OR REPLACE INTO persona_image_fit (image_id, persona_id, fit) VALUES (?, ?, ?)',
    args: [imageId, personaId, fit],
  });
}

export async function getPersonaImageFit(imageId: string): Promise<Record<string, "good" | "poor">> {
  await ensureMigrated();
  const client = getClient();
  const result = await client.execute({
    sql: 'SELECT persona_id, fit FROM persona_image_fit WHERE image_id = ?',
    args: [imageId],
  });
  return Object.fromEntries(result.rows.map((r) => [r.persona_id as string, r.fit as "good" | "poor"]));
}
```

**Step 3: Verify TypeScript compiles**
```bash
cd "C:/Users/jiwar computer/ai-ad-agent" && npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add lib/db.ts
git commit -m "feat: add copy_slots and persona_image_fit tables with query functions"
```

---

## Task 2: AI fit check

**Files:**
- Create: `lib/ai/fit.ts`

**Context:**
One call per image, all 18 personas evaluated at once. Falls back to all "good" if AI unavailable — better to show too many than hide valid personas.

**Step 1: Create lib/ai/fit.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { read as readStorage } from "@/lib/storage";
import { withRetry } from "./retry";
import path from "path";

export type FitResult = Record<string, "good" | "poor">;
const MODEL = "claude-haiku-4-5-20251001";

export async function checkPersonaFit(imageId: string): Promise<FitResult> {
  const { getImage, getAllPersonas } = await import("@/lib/db");
  const [img, personas] = await Promise.all([getImage(imageId), getAllPersonas()]);
  if (!img) throw new Error(`Image "${imageId}" not found`);

  const allGood: FitResult = Object.fromEntries(personas.map((p) => [p.id, "good" as const]));

  if (process.env.SKIP_AI === "true") return allGood;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return allGood;

  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  const personaList = personas
    .map((p) => `${p.id}: ${p.name} — motivated by: ${p.motivation}. Avoid showing: ${p.whatNotToShow}`)
    .join("
");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 } },
            { type: "text", text: `This is a SWITCH NAILS press-on nails product image. Rate each persona as "good" or "poor" fit for this image based on nail style, aesthetic, and visual tone.

Rate "poor" only if the image directly conflicts with what the persona avoids — e.g. luxury editorial for a budget persona, maximalist nails for a minimalist persona.
Rate "good" if neutral or relevant.

Personas:
${personaList}

Return ONLY raw JSON mapping persona id to "good" or "poor":
{"per_trend_1":"good","per_busy_1":"poor"}` },
          ],
        }],
      }),
      "fit"
    );
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    return { ...allGood, ...JSON.parse(text) };
  } catch (err) {
    console.error("[fit] Failed — defaulting all to good:", err);
    return allGood;
  }
}
```

**Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add lib/ai/fit.ts
git commit -m "feat: add persona fit check AI function"
```

---

## Task 3: AI persona copy generation

**Files:**
- Create: `lib/ai/personaCopy.ts`

**Context:**
One call per persona per image. Uses `persona.tones` to know which angles to generate (2-3 tones). Writes directly to `copy_slots` table. Returns `CopySlot[]`.

**Step 1: Create lib/ai/personaCopy.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { read as readStorage } from "@/lib/storage";
import { withRetry } from "./retry";
import { newId } from "@/lib/ids";
import type { CopySlot, Language } from "@/lib/types";
import path from "path";

const MODEL = "claude-haiku-4-5-20251001";
const LANGUAGES: Language[] = ["en", "de"];

type PersonaInput = {
  id: string; name: string; age: string;
  motivation: string; painPoint: string; triggerMessage: string;
  creativeAngle: string; tones: string[];
};

export async function generatePersonaCopy(imageId: string, persona: PersonaInput): Promise<CopySlot[]> {
  const { getImage, insertCopySlot } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);

  if (process.env.SKIP_AI === "true") return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const imageBuffer = await readStorage("uploads", img.url);
  const ext = path.extname(img.filename).replace(".", "");
  const mimeType = (ext === "jpg" ? "jpeg" : ext) as "jpeg" | "png" | "gif" | "webp";
  const imageBase64 = imageBuffer.toString("base64");

  try {
    const client = new Anthropic({ apiKey });
    const response = await withRetry(() =>
      client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: `image/${mimeType}`, data: imageBase64 } },
            { type: "text", text: `Write SWITCH NAILS ad copy for this specific persona:

Persona: ${persona.name}, age ${persona.age}
Motivation: ${persona.motivation}
Pain point: ${persona.painPoint}
Trigger: ${persona.triggerMessage}
Creative angle: ${persona.creativeAngle}
Tones: ${persona.tones.join(", ")}

Write in English (en) and German (de) for each tone. Return ONLY raw JSON:
{
  "en": { "<tone>": { "headline": "...", "quote": "...", "subtext": "..." } },
  "de": { "<tone>": { "headline": "...", "quote": "...", "subtext": "..." } }
}

Rules: headline 2-8 words; quote 10-20 words in customer voice; subtext 3-8 words. Each tone must sound distinctly different.` },
          ],
        }],
      }),
      "personaCopy"
    );

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(text) as Record<string, Record<string, { headline: string; quote: string; subtext: string }>>;

    const slots: CopySlot[] = [];
    for (const lang of LANGUAGES) {
      for (const tone of persona.tones) {
        const toneData = parsed[lang]?.[tone];
        if (!toneData) continue;
        for (const slotType of ["headline", "quote", "subtext"] as const) {
          const slotText = toneData[slotType];
          if (!slotText) continue;
          const slot: CopySlot = { id: newId("cs"), lang: lang as Language, slotType, text: slotText, angle: slotType === "headline" ? tone as any : undefined };
          slots.push(slot);
          await insertCopySlot({ id: slot.id, imageId, personaId: persona.id, slotType, tone, language: lang, text: slotText });
        }
      }
    }
    console.log(`[personaCopy] ${slots.length} slots for ${persona.name}`);
    return slots;
  } catch (err) {
    console.error(`[personaCopy] Failed for ${persona.id}:`, err);
    return [];
  }
}
```

**Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add lib/ai/personaCopy.ts
git commit -m "feat: add per-persona copy generation AI function"
```

---

## Task 4: Update analyze route — parallel execution + background persona generation

**Files:**
- Modify: `app/api/analyze/route.ts`

**Context:**
Currently runs safe zones then copy pool sequentially. New flow fires all three (safe zones, generic copy, fit check) simultaneously with Promise.all. After fit check resolves, persona copy generation fires in background without blocking the response.

**Step 1: Replace app/api/analyze/route.ts entirely**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { analyzeSafeZones } from "@/lib/ai/analyze";
import { generateCopyPool } from "@/lib/ai/copy";
import { checkPersonaFit } from "@/lib/ai/fit";
import { generatePersonaCopy } from "@/lib/ai/personaCopy";
import {
  getImage, insertImage, getSafeZones, upsertSafeZones,
  getCopyPool, upsertCopyPool, hasCopySlots, insertCopySlot,
  upsertPersonaImageFit, getPersonaImageFit, getAllPersonas,
} from "@/lib/db";
import { newId } from "@/lib/ids";

export async function POST(req: NextRequest) {
  try {
    const { imageId, imageUrl, imageWidth, imageHeight } = await req.json();
    if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

    let image = await getImage(imageId);
    if (!image) {
      if (!imageUrl) return NextResponse.json({ error: "Image not found" }, { status: 404 });
      await insertImage({ id: imageId, filename: imageId + ".png", url: imageUrl, width: imageWidth ?? 0, height: imageHeight ?? 0 });
    }

    // Step 1: safe zones + generic copy + fit check in parallel
    const [, copyPool, fitResult] = await Promise.all([
      getSafeZones(imageId).then((cached) =>
        cached ? null : analyzeSafeZones(imageId).then((sz) => upsertSafeZones(imageId, JSON.stringify(sz)))
      ),
      getCopyPool(imageId).then((cached) =>
        cached ? cached : generateCopyPool(imageId).then((pool) => { upsertCopyPool(imageId, JSON.stringify(pool)); return pool; })
      ),
      getPersonaImageFit(imageId).then((cached) =>
        Object.keys(cached).length > 0 ? cached : checkPersonaFit(imageId).then(async (fit) => {
          await Promise.all(Object.entries(fit).map(([pid, rating]) => upsertPersonaImageFit(imageId, pid, rating)));
          return fit;
        })
      ),
    ]);

    // Step 2: migrate generic copy to copy_slots (once)
    if (copyPool && !(await hasCopySlots(imageId, null))) {
      const pool = typeof copyPool === "string" ? JSON.parse(copyPool) : copyPool;
      await Promise.all((pool?.slots ?? []).map((slot: any) =>
        insertCopySlot({ id: slot.id ?? newId("cs"), imageId, slotType: slot.slotType, tone: slot.angle ?? null, language: slot.lang, text: slot.text })
      ));
    }

    // Step 3: background persona copy generation (fire and forget)
    const personas = await getAllPersonas();
    const fitting = personas.filter((p) => fitResult[p.id] !== "poor");
    Promise.all(
      fitting.map(async (persona) => {
        if (!(await hasCopySlots(imageId, persona.id))) {
          await generatePersonaCopy(imageId, persona);
        }
      })
    ).catch((err) => console.error("[analyze] Background persona copy error:", err));

    return NextResponse.json({ ok: true, fittingPersonas: fitting.length, totalPersonas: personas.length });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analysis failed" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add app/api/analyze/route.ts
git commit -m "feat: parallelize analyze route and add background persona copy generation"
```

---

## Task 5: Add personas and copy-slots API endpoints

**Files:**
- Create: `app/api/personas/route.ts`
- Create: `app/api/copy-slots/route.ts`

**Step 1: Create app/api/personas/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllPersonas, getAllSegments, getPersonaImageFit, hasCopySlots } from "@/lib/db";

export async function GET(req: NextRequest) {
  const imageId = req.nextUrl.searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  const [personas, segments, fitMap] = await Promise.all([getAllPersonas(), getAllSegments(), getPersonaImageFit(imageId)]);
  const segmentMap = Object.fromEntries(segments.map((s) => [s.id, s]));

  const readyMap: Record<string, boolean> = {};
  await Promise.all(personas.map(async (p) => { readyMap[p.id] = await hasCopySlots(imageId, p.id); }));

  return NextResponse.json({
    personas: personas.map((p) => ({
      ...p,
      segment: segmentMap[p.segmentId],
      fit: fitMap[p.id] ?? "good",
      ready: readyMap[p.id] ?? false,
    })),
  });
}
```

**Step 2: Create app/api/copy-slots/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCopySlotsByImage } from "@/lib/db";

export async function GET(req: NextRequest) {
  const imageId = req.nextUrl.searchParams.get("imageId");
  const personaId = req.nextUrl.searchParams.get("personaId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });
  const slots = await getCopySlotsByImage(imageId, personaId ?? null);
  return NextResponse.json({ slots });
}
```

**Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add app/api/personas/route.ts app/api/copy-slots/route.ts
git commit -m "feat: add personas and copy-slots API endpoints"
```

---

## Task 6: Push and verify

**Step 1: Push**
```bash
git push origin master
```

**Step 2: After Vercel deploys, upload a new image and test**

```bash
# personas endpoint — should return 18 personas with fit ratings
curl "https://ai-ad-agent-avrazs-projects.vercel.app/api/personas?imageId=IMG_ID" -H "Cookie: preview_auth=demo2026"

# generic copy slots
curl "https://ai-ad-agent-avrazs-projects.vercel.app/api/copy-slots?imageId=IMG_ID" -H "Cookie: preview_auth=demo2026"

# persona-specific slots (after background generation completes ~30s)
curl "https://ai-ad-agent-avrazs-projects.vercel.app/api/copy-slots?imageId=IMG_ID&personaId=per_trend_1" -H "Cookie: preview_auth=demo2026"
```

---

## What this plan does NOT include (next phase — UI)

- Persona pills / segment selector in the stage panel
- Polling `/api/personas` to progressively unlock pills as slots become ready
- Swapping headline/quote/subtext from `copy_slots` when a persona is active
- Dropping `copy_pools` table once UI fully migrated to `copy_slots`
- Language expansion post-approval flow
