# Project Backlog

Items are ordered roughly by priority within each section. Update status as work progresses.

Status: `open` · `in progress` · `done`

---

## Versioning

Current version: **0.4.0** (in `package.json` — single source of truth, displayed in the UI)

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
| F9 | Background approve baking | Approve is instant for the user — item moves to approved immediately and the PNG bake (reposition) happens silently in the background. Show a subtle error state on the queue item if baking fails. | open | — |
| F10 | Free-form review boxes | User can add/delete unlimited review boxes on any ad, the same way as free-form text boxes (drag X/Y, resize, delete top-right corner). Each box shows a fixed 5-star row + editable review text. Multiple boxes supported. Baked into PNG via reposition route alongside text boxes. | open | — |
| F6 | Auto font variation by persona | Automatically vary fonts across ads based on persona, reducing need for manual font selection. | open | — |
| TR | Translate approved ads | One-click translation of all approved EN ads into SE, GR, FR, ES. Collapsible language groups in left panel. UI implemented (button, language picker, left panel groups, detail view). Backend not yet implemented — `/api/translate` route, Claude Haiku translation, and DB helper still needed. | in progress | [plan](superpowers/plans/2026-03-17-translate-approved.md) |
| F11 | Headline freshness & auto-refresh | Track which headlines have been used and shown recently. During generation, deprioritize recently seen headlines to avoid repetition. When most headlines in the pool have been used, automatically generate a fresh batch via Claude Haiku and add them to the pool — so the user never runs out of new options and never feels like the same copy keeps appearing. | open | — |
| M1 | Brand profile onboarding | Build an onboarding flow that allows new customers to quickly set up their brand profile in the system. Instead of manual configuration, the system automatically extracts key brand information from inputs such as a website URL, product data, images, or example ads. The AI generates a structured brand profile including: brand description, tone of voice, target audience, suggested customer personas, headline styles and examples, and basic design preferences. The user reviews and edits these suggestions in a simple interface before saving. The final output is a reusable "Brand Profile" used by the system to generate ads, select personas, and guide tone and layout decisions. Goal: reduce manual setup, improve ad quality, and make the system scalable across multiple customers. | open | — |

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
| F7 | Free-form text boxes + hide headline | `DraggableTextBlock` component: drag X/Y, resize, delete, inline edit, color picker, font size, bold, bullet toggle. Headline box hide/show toggle. Text boxes baked into PNG via reposition route. |
| F8 | AI Style background generation | Layout pill "AI Style": Claude Sonnet generates a no-text HTML background for the product image. User layers headline + free text boxes on top. Baked into PNG on approve. |
