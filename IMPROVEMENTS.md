# Improvement Ideas

## Performance

### 1. Parallelize preview generation
Currently the 12 preview thumbnails (8 layouts + 4 templates) generate sequentially — one HTTP call at a time.
Running them in parallel batches of 3–4 would cut preview load time by ~4×.
- File: `app/page.tsx` — `handleGenerateLayoutPreviews` and `handleGenerateTemplatePreviews`

### 2. Font caching in Satori
Every render call likely reloads font files from disk.
Caching them in a module-level variable means they're loaded once per server process, not once per render.
- File: `lib/render/renderAd.ts`

### 3. Stop rendering unused styles
The generate route still renders ALL styles in a family and discards all but `results[0]`.
Now that style picking goes via `forceTemplateId`, the family loop is never used for real ads. Clean it up.
- File: `app/api/generate/route.ts`

---

## Cost / Storage

### 4. Auto-clean old PNGs
`removeGenerated()` exists in `lib/storage.ts` but is never called.
Calling it before each new batch analyze would wipe stale PNGs automatically instead of waiting for the user to click Clear.
- File: `lib/storage.ts` (function exists), `app/api/analyze/route.ts` (call it here)

### 5. Lazy copy pool
40 slots are generated upfront but a user might only ever see 3–4.
Could generate a smaller pool (10–15 slots) and expand on demand if the user clicks "New Headline" many times.
- File: `lib/ai/copy.ts`, `app/api/regenerate/route.ts`

---

## Quality

### 6. Length-aware copy matching
Tag each headline slot as `short` (≤4 words), `medium` (5–7), `long` (8+) when generating the pool.
Then layouts with small text zones (e.g. `bottom_bar`) always get short slots, while `magazine` can take long ones.
- Files: `lib/types.ts` (add length field to CopySlot), `lib/ai/copy.ts` (tag slots), `app/api/generate/route.ts` (use tag in slot picker)

### 7. Add FR and ES to copy pool
FR and ES language buttons exist in the UI but silently fall back to EN copy — the pool only generates EN + DE.
Expanding `generateCopyPool` to write all 4 languages would make those buttons actually work.
- File: `lib/ai/copy.ts`

---

## Dead code cleanup

### 8. Remove switch_grid_3x2_no_text
Registered in the template registry but has no UI entry point. Either add a pill for it or remove it entirely.
- Files: `lib/templates/gridSwitchLayout.tsx`, `lib/templates/index.ts`, `lib/types.ts`

### 9. Remove BATCH_FAMILIES dead code
`BATCH_FAMILIES` and `usedStyleIdsRef` in `app/page.tsx` are leftovers from the old auto-render flow.
Analyze All no longer renders anything, so this logic is unused.
- File: `app/page.tsx`
