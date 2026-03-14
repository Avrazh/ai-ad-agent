# Persona Selector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persona dropdown to the stage bar that filters tone buttons to the selected persona's 2 tones and triggers a headline regeneration into the live draggable box.

**Architecture:** New GET /api/personas endpoint returns slim persona data from the DB. page.tsx adds two new state entries (personas array + personaByImage map), derives activePersona and activeTones from them, and renders a grouped <select> to the left of the Headline Tone section.

**Tech Stack:** Next.js 14 App Router, TypeScript, React useState/useEffect, Turso/libSQL via lib/db.ts

---

## Chunk 1: API Endpoint

### Task 1: Create app/api/personas/route.ts

**Files:**
- Create: `app/api/personas/route.ts`

This endpoint reads all personas from the DB and returns only the 4 fields the UI needs: id, segmentId, name, tones.

- [ ] **Step 1: Create the route file**

Create `app/api/personas/route.ts` with this exact content:

```ts
import { NextResponse } from "next/server";
import { getAllPersonas } from "@/lib/db";

export async function GET() {
  try {
    const all = await getAllPersonas();
    const personas = all.map(({ id, segmentId, name, tones }) => ({
      id,
      segmentId,
      name,
      tones,
    }));
    return NextResponse.json(personas);
  } catch (err) {
    console.error("[personas]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Smoke-test the endpoint**

With the dev server running (`npm run dev`), open:
  http://localhost:3000/api/personas

Expected: JSON array of 16 objects, each with id, segmentId, name, tones (array of 2 strings).
Example first entry:
```json
{ "id": "per_trend_1", "segmentId": "seg_trend", "name": "The Aesthetic Curator", "tones": ["aspirational", "emotional"] }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/personas/route.ts
git commit -m "feat: add GET /api/personas endpoint"
```

---

## Chunk 2: page.tsx — State and Derived Values

### Task 2: Add Persona type, SEGMENT_LABELS, and state

**Files:**
- Modify: `app/page.tsx:123-135` (after TONES constant)
- Modify: `app/page.tsx:215` (after toneByImage state line)

- [ ] **Step 1: Add Persona type and SEGMENT_LABELS after the TONES constant**

Current code at line 123:
```ts
const TONES: { angle: string; label: string }[] = [
  { angle: "benefit",      label: "Benefit"    },
  ...
  { angle: "contrast",     label: "Contrast"   },
];
```

Insert immediately after the closing `];` of the TONES constant (around line 131):

```ts
interface Persona {
  id: string;
  segmentId: string;
  name: string;
  tones: string[];
}

const SEGMENT_LABELS: Record<string, string> = {
  seg_trend: "Trendy",
  seg_busy:  "Busy",
  seg_occ:   "Occasion",
  seg_bud:   "Budget",
  seg_nat:   "Natural",
  seg_new:   "New",
};
```

- [ ] **Step 2: Add personas and personaByImage state**

Find the line at ~215:
```ts
const [toneByImage, setToneByImage] = useState<Record<string, string>>({});
```

Insert BEFORE that line:
```ts
const [personas, setPersonas] = useState<Persona[]>([]);
const [personaByImage, setPersonaByImage] = useState<Record<string, string>>({});
```

- [ ] **Step 3: Add useEffect to fetch personas on mount**

Find the block of useEffect hooks near the top of the component body (the first useEffect is around line 235-240). Add a new useEffect alongside the existing ones:

```ts
useEffect(() => {
  fetch("/api/personas")
    .then((r) => r.json())
    .then((data) => { if (Array.isArray(data)) setPersonas(data); })
    .catch(() => { /* leave personas as [] — select stays disabled */ });
}, []);
```

- [ ] **Step 4: Add derived activePersona and activeTones**

Find the block where derived/computed values are declared (look for `selectedItemId`, `selectedItem`, `isSVGSurprise` — around lines 230-260). After those derived values, add:

```ts
const activePersona = personas.find(
  (p) => p.id === (personaByImage[selectedItemId ?? ""] ?? personas[0]?.id)
);
const activeTones = activePersona
  ? TONES.filter((t) => activePersona.tones.includes(t.angle))
  : TONES;
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "C:/Users/jiwar computer/ai-ad-agent"
npx tsc --noEmit
```

Expected: no errors relating to the new state or type declarations.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add persona state and activeTones derived value"
```

---

## Chunk 3: page.tsx — UI

### Task 3: Add persona selector section and update tone render loop

**Files:**
- Modify: `app/page.tsx:1212-1226` (Headline Tone section and TONES render loop)

- [ ] **Step 1: Insert persona selector section before the Headline Tone section**

Find this exact comment + div at line ~1212:
```tsx
{/* Stage: Headline Tone — disabled (not hidden) for final SVG surprise */}
<div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
```

Insert the following block IMMEDIATELY BEFORE that comment:

```tsx
{/* Stage: Persona */}
<div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Persona</span>
  <select
    disabled={isSVGSurprise || detailLoading || personas.length === 0 || !selectedItem?.result}
    value={personaByImage[selectedItemId ?? ""] ?? personas[0]?.id ?? ""}
    onChange={(e) => {
      const persona = personas.find((p) => p.id === e.target.value);
      if (!persona || !selectedItem || !selectedItemId) return;
      setPersonaByImage((prev) => ({ ...prev, [selectedItemId]: persona.id }));
      handleNewHeadlineWithTone(selectedItem, persona.tones[0]);
    }}
    className="w-52 rounded-md px-2 py-1.5 text-sm bg-[#0d1117] border border-white/[0.08] text-gray-200 disabled:opacity-30 focus:outline-none focus:border-white/30"
  >
    {personas.length === 0 ? (
      <option disabled value="">Loading…</option>
    ) : (
      Object.entries(SEGMENT_LABELS).map(([segId, segLabel]) => (
        <optgroup key={segId} label={segLabel}>
          {personas
            .filter((p) => p.segmentId === segId)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </optgroup>
      ))
    )}
  </select>
</div>
```

- [ ] **Step 2: Update the tone render loop to use activeTones**

Note: after Step 1's insertion the line numbers will have shifted. Search by text, not by number.

Find this line (search for `TONES.map`):
```tsx
{TONES.map(({ angle, label }) => (
```

Change it to:
```tsx
{activeTones.map(({ angle, label }) => (
```

That is the only change needed to the tone buttons — everything else (disabled state, active highlight, onClick) remains identical.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. Open http://localhost:3000
2. Upload an image and generate an ad
3. Verify the Persona dropdown appears to the left of Headline Tone
4. Verify 16 personas are grouped into 6 segments in the dropdown
5. Select a different persona — headline should regenerate, tone buttons should update to show only that persona's 2 tones
6. Switch to a second image, select a different persona — verify first image's persona is still remembered when you switch back
7. Verify the dropdown is disabled for AI Style (SVG surprise) ads

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add persona selector UI to stage bar"
```
