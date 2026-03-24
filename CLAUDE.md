# ai-ad-agent — Project Knowledge

## Rules
- **NEVER run `git push` unless the user explicitly says to push.** Every push triggers a Vercel build that costs credits. Commit freely, but always stop before pushing and wait for explicit instruction.

## What this app does
Generates print-quality ad images from product photos. User uploads images, clicks Generate All, gets styled ads back. Can switch styles, language, format, or get a one-shot AI-creative via Surprise Me.

---

## Terminology

| Term | Meaning |
|---|---|
| **Preset Styles** | All 10 Playwright-rendered styles (6 layouts + 2 Testimonial + 2 Luxury). No AI at render time. Headline/lang/format are all changeable after generation. |
| **Creative Layout Studio** | Claude Sonnet analyzes a reference ad and recreates the layout with your product — no text, fully tweakable. Accessible via the "Creative Layout" pill in the sidebar. |

---

## Style inventory

### Preset Styles — Testimonial + Luxury families (Playwright, modifiable)
| templateId | family | label | notes |
|---|---|---|---|
| `quote_card` | testimonial | Quote | Customer quote layout |
| `star_review` | testimonial | Stars | Star rating + quote layout |
| `luxury_editorial_left` | luxury | Editorial | Gold left-bar, Playfair Display |
| `luxury_soft_frame_open` | luxury | Frame Open | SVG border frame, Playfair Display |

### Preset Styles — 6 Layouts (Playwright, modifiable)
8 layout pills in the sidebar, each uses a predefined `SurpriseSpec` passed as `forceSurpriseSpec`. All render via the `ai_surprise` templateId using Playwright. Language and format controls are fully functional.

Layout names: `split_right`, `full_overlay`, `bottom_bar`, `frame_overlay`, `postcard`, `vertical_text`

Adding a new layout = 3 touches: add to `SurpriseLayout` type union in `app/page.tsx`, add entry to `LAYOUT_PREVIEWS` with a `SurpriseSpec`, add `if (layout === "...")` JSX block in `lib/templates/aiSurprise.tsx`.

### Surprise Me — REMOVED
The Surprise Me feature (Just Generate, With Reference, With Prompt) has been removed from the UI and codebase. Deleted files: `app/api/surprise-render/route.ts`, `lib/ai/surpriseRender.ts`. The Creative Layout Studio (F12) covers the reference-based use case in a more flexible way.

### Creative Layout Studio (F12) — separate from Surprise Me
A node-based editor accessible from the "Creative Layout" pill in the sidebar. Different from Surprise Me — output is a **no-text SVG layout** that the user then layers their own text boxes on top of.

- Entry: "Creative Layout" pill in sidebar → opens `AIComposeEditor` component
- API: `/api/ai-compose` (separate route, not shared with Surprise Me)
- Component: `app/components/AIComposeEditor.tsx`
- Flow: User loads reference ad (Image A) + their product (Image B) → two-step Claude analysis: (1) extract layout spec from reference, (2) recreate layout as SVG with product inserted, no text
- Result: saved to queue as `status: "analyzed"` — fully tweakable with text boxes, headline overlays, etc.
- Language/format controls visible after generation (unlike Surprise Me)
- Use case: borrow a competitor's or inspiration layout, replace with your own product

#### Key difference vs Surprise Me With Reference
| | Creative Layout Studio | Surprise Me With Reference |
|---|---|---|
| API | `/api/ai-compose` | `/api/surprise-render` |
| Output | No-text layout SVG | Complete ad with headline + copy |
| After generation | Tweakable (text boxes, styles) | Final, read-only |
| Queue status | `analyzed` | shown in detail view only |
### Dead / unreachable
- `switch_grid_3x2_no_text` — registered in template registry but has no UI entry point

---

## Generate flow

### Current flow (after architecture change)
1. **Analyze All** button → upload + AI analysis only (no rendering)
2. Queue item shows `status: "analyzed"` — product photo displayed at selected format ratio
3. User clicks a style pill → renders the ad for that image

### On first analyze for an image (1 AI call — cached forever after)
1. `generateCopyPool` — Claude Haiku vision → writes 40 product-specific copy slots in EN + DE

Note: `analyzeSafeZones` was removed. Safe zones are dead code — never computed, never stored, never retrieved. The DB section for safe zones is empty. User controls crop position directly via `spec.cropX`. Two templates (`aiSurprise`, `starReview`) have leftover fallback references to `avoidRegions` but since they are always empty they never run.

### On every render (no AI)
- Pick style from family registry
- Pick copy slot matching family tone (luxury → aspirational angle)
- Render PNG via Playwright: template returns HTML string → Puppeteer screenshots headless Chrome → PNG

### Caching
- CopyPool cached in SQLite per imageId — AI never called again for the same image
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
| `app/api/generate/route.ts` | Main generate endpoint — Playwright renders |
| `app/api/surprise-render/route.ts` | Surprise Me endpoint — Claude SVG render |
| `app/api/regenerate/route.ts` | New headline / style switch |
| `app/api/switch/route.ts` | Lang/format re-render without AI |
| `app/api/feedback/route.ts` | POST /api/feedback — saves developer feedback to DB |
| `lib/ai/analyze.ts` | Legacy — safe zone detection (dead code, no longer called) |
| `lib/ai/copy.ts` | Claude Haiku — copy pool generation |
| `lib/ai/surpriseRender.ts` | DELETED — Surprise Me removed |
| `lib/ai/aiSurprise.ts` | Claude Sonnet — SurpriseSpec generation (for Other layouts) |
| `app/components/AIComposeEditor.tsx` | Creative Layout Studio UI — node-based editor |
| `app/api/ai-compose/route.ts` | Creative Layout Studio API — two-step layout analysis + SVG generation |
| `lib/templates/index.ts` | Registers all families and templates |
| `lib/templates/registry.ts` | Template registry (Map, insertion-order) |
| `lib/types.ts` | All shared types |
| `lib/db.ts` | SQLite — images, copy pool, ad specs, render results, developer feedback |

---

## Design decisions
- `ai_surprise_svg` (Surprise Me) is always final — no controls shown, no re-render
- The 8 layout pills are **Preset Styles** using `forceSurpriseSpec` — they ARE modifiable (not the same as Surprise Me)
- Surprise Me is kept separate from Preset Styles — different cost, different creative approach, not used by the agent
- Preview thumbnails generate once per image on first select, cached per imageId in React state
- `generatingPreviewsFor` ref prevents duplicate generation for the same image
- Future agent feature will use **Preset Styles only** (cheap, fast, tweakable during review)

### Critical: Analyze All vs. rendering
- **"Analyze All" button** = upload + AI analysis ONLY. Zero ad renders happen here.
- The button label while running is `"Analyzing X of Y..."` — not "Generating"
- Actual renders only happen when user clicks a layout/template pill in the style picker, or Surprise Me
- The `handleGenerateAll` function in `app/page.tsx` calls `/api/analyze`, NOT `/api/generate`

### switch route: preserving surpriseSpec + theme
- `app/api/switch/route.ts` must copy `surpriseSpec` from the old AdSpec into the new AdSpec
- It must also use `theme: oldSpec.theme`, NOT `theme: template.themeDefaults`
- Failing to do this causes Other layout ads to revert to the "top_bottom" layout on every lang/format switch

### aiSurprise.tsx: font fitting (Playwright)
- All templates return **HTML strings** (not JSX). No manual CHAR_RATIO / wordFitSize math.
- Headlines marked with `data-fit-headline` attribute.
- After `page.setContent()`, `page.evaluate()` runs a JS loop that shrinks font size 1px at a time until:
  - `el.getBoundingClientRect().bottom <= clipAncestor.getBoundingClientRect().bottom` (no vertical overflow)
  - `el.scrollWidth <= el.offsetWidth` (no horizontal overflow / word clipping)
- Clip ancestor = nearest `overflow:hidden` parent, found by walking up the DOM.
- `word-break: normal; overflow-wrap: normal` enforced — words never split mid-character.
- Minimum font size floor: 12px.

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
| Task | Model | File |
|---|---|---|
| Copy pool generation | `claude-haiku-4-5-20251001` | `lib/ai/copy.ts` |
| SurpriseSpec generation (layout pills) | `claude-sonnet-4-6` | `lib/ai/aiSurprise.ts` |
| Surprise Me / Inspired by Reference SVG | `claude-sonnet-4-6` | `lib/ai/surpriseRender.ts` |

Rule: cheap (Haiku) for first-generate analysis; better (Sonnet) for all creative/AI output.

## Rendering pipeline
- **Local dev:** `puppeteer` (bundled Chromium, works on Windows/Mac/Linux)
- **Production (Vercel/Lambda):** `@sparticuz/chromium` + `puppeteer-core` (stripped ~45MB Chromium, fits serverless 50MB limit)
- Detection: `IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)`
- Browser instance cached across requests (`browserInstance` module-level singleton)
- Fonts loaded once at startup as base64 data URIs, injected as `@font-face` CSS into every page
- Flow: `template.build()` → HTML string → `page.setContent()` → `page.evaluate()` font-fit → `page.screenshot()` → PNG
