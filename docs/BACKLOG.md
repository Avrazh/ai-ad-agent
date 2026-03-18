# Project Backlog

Items are ordered roughly by priority within each section. Update status as work progresses.

Status: `open` · `in progress` · `done`

---

## Bugs

| ID | Title | Description | Status |
|----|-------|-------------|--------|
| B1 | Left panel lag | Scroll and click lag + OOM tab crash with 17+ images. Fixed with React.memo, lazy loading, and freeing blob memory after upload. | done |
| B3 | Own text sometimes doesn't apply | "Write your own text" function doesn't always work. Cannot reproduce — monitor and revisit if customer reports again with steps. | cannot reproduce |

---

## Features

| ID | Title | Description | Status | Plan |
|----|-------|-------------|--------|------|
| F1 | Attribution format on testimonials | Testimonial and star review ads should show "Elin K. · Verified customer" format on all testimonial layouts. | open | — |
| F2 | Text color picker | User can freely change headline and brand name color. Currently auto black/white — open it up to any color. | open | — |
| F3 | Line break control on headlines | Better headline wrapping. Avoid awkward splits (e.g. 6 words line 1, 2 words line 2). | open | — |
| F4 | Testimonial auto-generates real review copy | When testimonial layout is selected, generate a proper customer review instead of reusing the benefit headline. | open | — |
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
