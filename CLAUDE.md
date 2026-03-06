# ai-ad-agent — Project Knowledge

## What this app does
Generates print-quality ad images from product photos. User uploads images, clicks Generate All, gets styled ads back. Can switch styles, language, format, or get a one-shot AI-creative via Surprise Me.

---

## Style inventory

### Satori-rendered templates (modifiable — lang/format/headline can be changed after generation)
| templateId | family | label | notes |
|---|---|---|---|
| `quote_card` | testimonial | Quote | Customer quote layout |
| `star_review` | testimonial | Stars | Star rating + quote layout |
| `luxury_editorial_left` | luxury | Editorial | Gold left-bar, Playfair Display |
| `luxury_soft_frame_open` | luxury | Frame Open | SVG border frame, Playfair Display |

### Satori-rendered layouts — "Other" section (modifiable — same as above)
8 layout pills in the sidebar, each uses a predefined `SurpriseSpec` passed as `forceSurpriseSpec`. All render via the `ai_surprise` templateId using Satori. Language and format controls are fully functional.

Layout names: `top_bottom`, `split_left`, `split_right`, `full_overlay`, `bottom_bar`, `color_block`, `frame_overlay`, `magazine`

### AI-generated — Surprise Me (FINAL — not modifiable)
- Button: "✨ Surprise Me" → calls `/api/surprise-render`
- Claude Sonnet generates a complete SVG ad (full layout, copy, colors — all decided by Claude)
- Returns `templateId: "ai_surprise_svg"`
- Language/format controls are **hidden** for this result
- Cannot switch headline, language, format — it is a finished creative piece

### Dead / unreachable
- `switch_grid_3x2_no_text` — registered in template registry but has no UI entry point

---

## Generate flow

### Current flow (after architecture change)
1. **Analyze All** button → upload + AI analysis only (no rendering)
2. Queue item shows `status: "analyzed"` — product photo displayed at selected format ratio
3. User clicks a style pill → renders the ad for that image

### On first analyze for an image (2 AI calls — cached forever after)
1. `analyzeSafeZones` — Claude Haiku vision → returns normalized rects for avoidRegions + zones A/B/C
2. `generateCopyPool` — Claude Haiku vision → writes 40 product-specific copy slots in EN + DE

### On every render (no AI)
- Pick style from family registry
- Pick best zone (avoids avoidRegions)
- Pick copy slot matching family tone (luxury → aspirational angle)
- Render PNG via Satori (JSX→SVG) + resvg (SVG→PNG)

### Caching
- SafeZones and CopyPool cached in SQLite per imageId — AI never called again for the same image
- Preview thumbnails (layout + template) cached in React state per imageId — switching images never re-generates
- Generated PNGs accumulate on disk — only cleared when user clicks Clear

---

## Copy pool

### Structure
- Stored as a single JSON blob in `copy_pools` table: `image_id (PK) | data (TEXT/JSON)`
- One row per image containing all 40 slots
- Debug view: `/api/debug/copy`

### Slot breakdown (40 total per image)
| Type | EN | DE | Total | Used by |
|---|---|---|---|---|
| `headline` | 9 | 9 | 18 | Luxury, Other layouts |
| `quote` | 3 | 3 | 6 | Testimonial styles only |
| `subtext` | 8 | 8 | 16 | All styles |

### Headline angles (7 types, only on headline slots)
`benefit` ×2, `curiosity`, `urgency`, `emotional`, `aspirational` ×2, `story`, `contrast`

### Copy slot selection per style
- **Testimonial** — primary: `quote` slot (any angle), secondary: `subtext`
- **Luxury** — primary: `headline` with `aspirational` angle forced, secondary: `subtext`
- **Other layouts** — headline: first `aspirational` headline or any headline; subtext: first subtext slot
- **Surprise Me** — Claude Sonnet writes its own copy directly in the SVG, never uses the pool

### Limitations
- No layout-aware matching — same headline can appear in any layout regardless of length or tone
- No length/brevity metadata on slots
- "New Headline" cycles through unused slots of same type, wraps around when all used

---

## Batch / style notes
- "Analyze All" no longer auto-renders any ad — user picks style manually after analysis
- `BATCH_FAMILIES = ["testimonial", "luxury"]` still exists in code but is only used if handleRerender is called without a specific templateId
- `star_review` and `luxury_soft_frame_open` are only reachable via sidebar pills (never auto-selected)
- Server always renders ALL styles in a family when called with `familyIds` — client takes only `results[0]` (wasteful but harmless since style picking now goes via `forceTemplateId`)

---

## Key files
| File | Role |
|---|---|
| `app/page.tsx` | All UI — queue, sidebar style picker, detail panel |
| `app/api/analyze/route.ts` | Upload + AI analysis only (no rendering) — called by Analyze All button |
| `app/api/generate/route.ts` | Main generate endpoint — Satori renders |
| `app/api/surprise-render/route.ts` | Surprise Me endpoint — Claude SVG render |
| `app/api/regenerate/route.ts` | New headline / style switch |
| `app/api/switch/route.ts` | Lang/format re-render without AI |
| `app/api/feedback/route.ts` | POST /api/feedback — saves developer feedback to DB |
| `lib/ai/analyze.ts` | Claude Haiku — safe zone detection |
| `lib/ai/copy.ts` | Claude Haiku — copy pool generation |
| `lib/ai/surpriseRender.ts` | Claude Sonnet — full SVG ad generation |
| `lib/ai/aiSurprise.ts` | Claude Haiku — SurpriseSpec generation (for Other layouts) |
| `lib/templates/index.ts` | Registers all families and templates |
| `lib/templates/registry.ts` | Template registry (Map, insertion-order) |
| `lib/types.ts` | All shared types |
| `lib/db.ts` | SQLite — images, safe zones, copy pool, ad specs, render results, developer feedback |

---

## Design decisions
- `ai_surprise_svg` (Surprise Me) is always final — no controls shown, no re-render
- The 8 Other layout pills use `forceSurpriseSpec` — they ARE modifiable (not the same as Surprise Me)
- Surprise Me is kept out of batch rotation — it is a different creative approach
- Preview thumbnails generate once per image on first select, cached per imageId in React state
- `generatingPreviewsFor` ref prevents duplicate generation for the same image

### Critical: Analyze All vs. rendering
- **"Analyze All" button** = upload + AI analysis ONLY. Zero ad renders happen here.
- The button label while running is `"Analyzing X of Y..."` — not "Generating"
- Actual renders only happen when user clicks a layout/template pill in the style picker, or Surprise Me
- The `handleGenerateAll` function in `app/page.tsx` calls `/api/analyze`, NOT `/api/generate`

### switch route: preserving surpriseSpec + theme
- `app/api/switch/route.ts` must copy `surpriseSpec` from the old AdSpec into the new AdSpec
- It must also use `theme: oldSpec.theme`, NOT `theme: template.themeDefaults`
- Failing to do this causes Other layout ads to revert to the "top_bottom" layout on every lang/format switch

### aiSurprise.tsx: font sizing helpers
- `wordFitSize(size, textW)` — horizontal cap: largest font where the longest word fits in column width
- `heightFitSize(size, panelH, hasSubtext, hasLabel, hasAccent)` — vertical cap: largest font where worst-case 3-line headline + subtext fits inside the colored panel
- Both applied together: `wordFitSize(heightFitSize(rawSize, ...), textW)`
- Layouts that need heightFitSize: `top_bottom`, `magazine`, `bottom_bar` (have fixed-height text panels)

---

## Developer feedback feature
- Table: `developer_feedback (id PK, message TEXT, image_id TEXT, template_id TEXT, created_at TEXT)`
- API: `POST /api/feedback` — body `{ message, imageId?, templateId? }` → `{ ok: true }`
- UI: "💬 Leave feedback" button pinned to bottom-right of the left sidebar
- Clicking opens a centered modal with an autofocused textarea
- Submit via "Send" button or Cmd/Ctrl+Enter; shows "Thanks! Feedback sent ✓" then auto-closes after 1.5s
- Context is attached automatically: current `imageId` + `templateId` so issues are reproducible
- `developer_feedback` is intentionally NOT cleared by the "Clear" button — it is permanent developer data

---

## Models used
| Task | Model |
|---|---|
| Safe zone detection | `claude-haiku-4-5-20251001` |
| Copy pool generation | `claude-haiku-4-5-20251001` |
| SurpriseSpec generation | `claude-haiku-4-5-20251001` |
| Full SVG ad (Surprise Me) | `claude-sonnet-4-6` |
