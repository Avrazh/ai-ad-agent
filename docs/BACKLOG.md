# Project Backlog

Items are ordered roughly by priority within each section. Update status as work progresses.

Status: `open` · `in progress` · `done`

---

## Versioning

Current version: **0.2.0** (in `package.json` — single source of truth, displayed in the UI)

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
| F2 | Text color picker | User can freely change headline and brand name color. Currently auto black/white — open it up to any color. | open | — |
| F3 | Line break control on headlines | Better headline wrapping. Avoid awkward splits (e.g. 6 words line 1, 2 words line 2). | open | — |
| F5 | Split screen with own photos | Replace AI-generated scene images. User picks 2 own uploaded photos, or 1 own + 1 AI scene. | open | — |
| F6 | Auto font variation by persona | Automatically vary fonts across ads based on persona, reducing need for manual font selection. | open | — |
| TR | Translate approved ads | One-click translation of all approved EN ads into SE, GR, FR, ES. Collapsible language groups in left panel. | open | [plan](superpowers/plans/2026-03-17-translate-approved.md) |

---

## Done

| ID | Title | Notes |
|----|-------|-------|
| — | Live ad canvas with drag-to-position | Headline drag, brand name overlay, star review card |
| — | Persona selector | Persona picker with custom persona creation |
| — | Font picker | Playfair Display and Montserrat for headlines; Krona One for brand name |
| — | Headline persistence and UX improvements | Brand color fix, showBrand fix, auto-color threshold |
| — | Scene images committed to git | Fix for Vercel not showing split screen images |
| B1 | Left panel lag / OOM crash | React.memo, lazy loading, blob URL cleanup, LRU image cache, heap size increase |
| B3 | Own text sometimes doesn't apply | Cannot reproduce — monitor if reported again |
| F1+F4 | Persona-based testimonial quotes | Testimonial layouts generate real review quotes per persona via Claude Haiku. Shows reviewer name + "Verified customer". Persona switching fetches correct quote. |
