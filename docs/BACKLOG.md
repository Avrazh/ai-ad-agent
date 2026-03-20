# Project Backlog

Items are ordered roughly by priority within each section. Update status as work progresses.

Status: `open` · `in progress` · `done`

---

## Versioning

Current version: **0.3.0** (in `package.json` — single source of truth, displayed in the UI)

| Bump | When |
|------|------|
| `PATCH` (0.2.**x**) | Bug fixes only |
| `MINOR` (0.**x**.0) | One or more features shipped |
| `MAJOR` (**x**.0.0) | Big redesign, architecture overhaul, or breaking change |

Stay on `0.x.x` while in active development. Move to `1.0.0` when the customer considers it production-stable.

---

## Bugs

| ID | Title | Description | Status |
|----|-------|-------------|--------|

---

## Features

| ID | Title | Description | Status | Plan |
|----|-------|-------------|--------|------|
| F7 | Free-form text boxes + hide headline | User can add/delete unlimited free-form text boxes on any ad (drag X/Y, resize bottom-right corner, delete top-right corner, inline edit, color picker, font size, bold, bullet toggle). Headline box gets a hide/show toggle. Text boxes baked into PNG via reposition route. `DraggableTextBlock` component; headline box unchanged. | open | [plan](superpowers/plans/2026-03-19-f7-text-boxes.md) |
| F8 | AI Style background generation | Move AI Generate into the layout pills as "AI Style". Claude Sonnet generates a no-text SVG background composition for the product → rendered to PNG via resvg → saved as a new image asset. User then layers headline box + free text boxes (F7) on top. Text edits are instant (client-side only); server only called for final export. Prompt reworked from "design a complete ad" to "design a rich editorial background — no text, no UI elements". | open | [plan](superpowers/plans/2026-03-19-f8-ai-style.md) |
| F9 | Background approve baking | Approve is instant for the user — item moves to approved immediately and the PNG bake (reposition) happens silently in the background. Show a subtle error state on the queue item if baking fails. | open | — |
| F6 | Auto font variation by persona | Automatically vary fonts across ads based on persona, reducing need for manual font selection. | open | — |
| TR | Translate approved ads | One-click translation of all approved EN ads into SE, GR, FR, ES. Collapsible language groups in left panel. | open | [plan](superpowers/plans/2026-03-17-translate-approved.md) |

---

## Done

| ID | Title | Notes |
|----|-------|-------|
| F5 | Split screen with own photos | SplitSceneEditor component: pick second image from queue, drag-to-pan both panels, draggable divider, swap panels, renders via existing split_scene template |
| — | Live ad canvas with drag-to-position | Headline drag, brand name overlay, star review card |
| — | Persona selector | Persona picker with custom persona creation |
| F2 | Text color picker | Color swatch on headline box (top-left) and brand name box; persists to PNG via reposition |
| — | Font picker | Playfair Display and Montserrat for headlines; Krona One for brand name |
| — | Headline persistence and UX improvements | Brand color fix, showBrand fix, auto-color threshold |
| — | Scene images committed to git | Fix for Vercel not showing split screen images |
| B1 | Left panel lag / OOM crash | React.memo, lazy loading, blob URL cleanup, LRU image cache, heap size increase |
| B3 | Own text sometimes doesn't apply | Cannot reproduce — monitor if reported again |
| F3 | Line break control on headlines | Double-click headline to enter edit mode; arrow keys move cursor; Enter inserts line break; persists to PNG via reposition |
| F1+F4 | Persona-based testimonial quotes | Testimonial layouts generate real review quotes per persona via Claude Haiku. Shows reviewer name + "Verified customer". Persona switching fetches correct quote. |
