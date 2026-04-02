# Advaria — Customer Changelog

This document tracks what has been built and delivered, intended for customer communication and invoicing.

---

## The Prototype

The core application is an AI-powered ad production tool built for e-commerce brands. It takes product photos as input and generates print-quality ad images ready for Meta (Facebook/Instagram). The base prototype includes:

- **Upload & analyze** — drop a folder of product photos; the AI analyzes each image and generates a pool of 40 ad copy variations (headlines, quotes, subtexts) tailored to the product
- **Layout styles** — 10 ready-to-use ad layouts across four families: Testimonial, Luxury, Layout presets, and AI Style
- **Live canvas** — drag-and-position headline text, brand name overlay, and font/size controls before finalizing
- **Persona system** — select a target audience persona; copy and tone adapt accordingly
- **Approve & download** — approve ads one by one, download individual PNGs or all at once in one click

---

## Delivered Features

| ID | Title | Description |
|----|-------|-------------|
| F1 + F4 | Persona-based testimonial quotes | Testimonial ad layouts (Quote Card, Star Review) generate real customer review quotes tailored to the selected persona via AI. Each quote includes a reviewer name, avatar, and "Verified customer" label — translated to match the ad language. |
| F2 | Text color picker | A color swatch on the headline and brand name lets the user pick any text color. The chosen color is baked into the final PNG exactly as shown on screen. |
| F3 | Line break control | Double-click the headline to enter edit mode. Use arrow keys to move the cursor and Enter to insert manual line breaks — giving full control over how copy wraps across two or more lines. Persists into the baked PNG. |
| F5 | Split screen with own photos | A two-panel layout where the user picks a second product photo from the queue. Both panels are independently pannable, the divider is draggable, and the panels can be swapped. Renders as a single ad image. |
| F7 | Free-form text boxes | Add unlimited custom text blocks on top of any ad — drag to position, resize, edit inline, change color, font size, bold, and bullet toggle. A toggle also hides or shows the main headline. All text boxes are baked into the final PNG. |
| F12 | Creative Layout Studio | Upload a reference ad (e.g. a competitor or inspiration piece) alongside a product photo. The AI analyses the reference layout — panels, proportions, colors, accent elements — and recreates it as a clean SVG with the product placed inside. The result is fully editable with text boxes and style controls. |
| TR | Translate approved ads | One click translates all approved English ads into Swedish, German, French, and Spanish. Translated ads appear in the queue with the full editing toolbar — headline position, brand name, text boxes — and can be individually approved and downloaded. |

---

## Upcoming / In Progress

| ID | Title | Status |
|----|-------|--------|
| M1 | Brand profile onboarding | In progress — Step 1 (URL extraction + brand review form) done |
| F9 | Background approve baking | Done (internal — part of core workflow) |
| F10 | Free-form review boxes | Open |
| F17 | Grid review mode | Open |
| F18 | Bulk export | Open |
| M2 | Demo / sales funnel | Open |
