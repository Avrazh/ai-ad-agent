# Persona Selector -- Design Spec
**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Add a persona selector dropdown to the stage bar, to the left of the Headline Tone section.
Selecting a persona immediately regenerates the headline (into the live draggable box only, not the baked PNG)
using the persona primary tone, and filters the visible tone buttons to that persona 2 tones.
Persona selection persists per image independently.

---

## Goals

- Let users target specific buyer personas when crafting headlines
- Filter tone options to only the 2 tones relevant to the selected persona
- Keep personas editable in the DB without frontend code changes (modular)

---

## Data Layer

### API endpoint: GET /api/personas

New file: app/api/personas/route.ts

Returns all personas from the existing personas DB table.
Uses getAllPersonas() from lib/db.ts. No new DB function required.

Response shape (id, segmentId, name, tones only -- no other fields needed by the UI):

    [
      { "id": "per_trend_1", "segmentId": "seg_trend", "name": "The Aesthetic Curator", "tones": ["aspirational", "emotional"] },
      ...
    ]

16 personas total, organized into 6 segments (~3 per segment).

---

## State Management (app/page.tsx)

### Persona type (local to page.tsx)

    interface Persona {
      id: string;
      segmentId: string;   // e.g. "seg_trend"
      name: string;
      tones: string[];     // 2 angle strings, e.g. ["aspirational", "emotional"]
    }

### Segment display name mapping (static constant in page.tsx)

    const SEGMENT_LABELS: Record<string, string> = {
      seg_trend: "Trendy",
      seg_busy:  "Busy",
      seg_occ:   "Occasion",
      seg_bud:   "Budget",
      seg_nat:   "Natural",
      seg_new:   "New",
    };

### New state

    const [personas, setPersonas] = useState<Persona[]>([]);
    const [personaByImage, setPersonaByImage] = useState<Record<string, string>>({});
    // personaByImage: imageId -> persona.id

### Fetch on mount

    useEffect(() => {
      fetch("/api/personas").then(r => r.json()).then(setPersonas);
    }, []);

### Derived values

    const activePersona = personas.find(
      p => p.id === (personaByImage[selectedItemId ?? ""] ?? personas[0]?.id)
    );

    // tones values in DB must exactly match TONES[i].angle strings (case-sensitive)
    const activeTones = activePersona
      ? TONES.filter(t => activePersona.tones.includes(t.angle))
      : TONES;

TONES constant (all 7) remains unchanged as the master list.
activeTones replaces direct use of TONES in the tone button render loop.

---

## UI

### Placement

New stage section inserted to the left of the existing Headline Tone section, using the same
"flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08]" pattern.

### Visual structure

    [ PERSONA label (10px uppercase)    ]  |  [ HEADLINE TONE label ]
    [ <select> ~200px, dark-styled      ]  |  [ Aspire ] [ Emotional ]

### Select element details

- Native <select> styled dark: bg-[#0d1117] border border-white/[0.08] text-sm text-gray-200 rounded-md px-2 py-1.5 w-52
- Options grouped by segment using <optgroup label={SEGMENT_LABELS[segmentId]}> -- 6 groups
- value bound to: personaByImage[selectedItemId] ?? personas[0]?.id ?? ""
- onChange triggers the persona select handler (see Behavior)
- Disabled when: no image selected, AI Style (isSVGSurprise) active, personas array empty, or detailLoading

---

## Behavior

### On persona select (onChange handler)

1. Find the selected persona object from the personas array by id
2. Update personaByImage: setPersonaByImage(prev => ({ ...prev, [imageId]: persona.id }))
3. Call handleNewHeadlineWithTone(selectedItem, persona.tones[0])
   - Regenerates headline text only -> updates the draggable headline box
   - handleNewHeadlineWithTone already calls setToneByImage on success
   - Do NOT set toneByImage before the call (avoids optimistic state getting out of sync on failure)
   - No PNG re-render, no server image processing

### On tone button click (unchanged)

- Works exactly as today: calls handleNewHeadlineWithTone(selectedItem, angle)
- Updates toneByImage via that function success path
- No change to personaByImage

### Tone buttons

- Render loop iterates activeTones instead of TONES
- Only the active persona 2 tones are shown
- Active highlight logic unchanged: toneByImage[selectedItemId] === angle

### Edge cases

| Situation | Behavior |
|-----------|----------|
| No image selected | Persona select disabled |
| AI Style (isSVGSurprise) active | Persona select disabled (same rule as tone buttons) |
| Personas not yet loaded | Select shows single disabled "Loading..." option; activeTones falls back to full TONES list |
| Image has no personaByImage entry | Defaults to personas[0] for tone filtering; no headline regeneration triggered |
| persona.tones values do not match TONES angles | activeTones will be empty; DB tones strings must exactly match TONES angle keys |

---

## Files Changed

| File | Change |
|------|--------|
| app/api/personas/route.ts | NEW -- GET endpoint, calls getAllPersonas(), returns id/segmentId/name/tones only |
| app/page.tsx | Add Persona type + SEGMENT_LABELS constant, personas + personaByImage state, useEffect fetch, activePersona/activeTones derived values, persona selector UI section, update tone render loop to use activeTones |

---

## Out of Scope

- Saving persona selection to DB per image (session state only)
- Admin UI for editing personas
- Persona-aware copy pool generation (separate feature)
