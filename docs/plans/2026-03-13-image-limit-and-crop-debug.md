---
# Image Limit Removal + 9:16 Crop Overlay in Debug

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Remove the 2-image session limit so many images can be loaded locally. (2) Show the 9:16 crop rectangle on each image in the safe zones debug page.

**Architecture:** Two independent, small changes. Task 1 touches only app/page.tsx (one constant + minor UI cleanup). Task 2 touches only app/api/debug/zones/route.ts (add SVG rect + legend entry).

**Tech Stack:** TypeScript, Next.js App Router, inline SVG

---

### Task 1: Remove the 2-image limit

**File:** app/page.tsx

**Context:**
- Line 130: `const IMAGE_LIMIT = 2; // beta: max images per session`
- Line 257: `const imageFiles = allImageFiles.slice(0, IMAGE_LIMIT);`
- Line 258: `setLimitApplied(allImageFiles.length > IMAGE_LIMIT);`
- Line 877: shows amber warning "· beta limit: first {IMAGE_LIMIT} loaded"
- Line 925: shows "Beta version · max {IMAGE_LIMIT} images"

**Change 1:** Change the constant on line 130 to:
  const IMAGE_LIMIT = 50;

That's it. The slice, the limitApplied state, and the UI text can stay as-is — with 50 as the limit, they won't interfere in practice for local testing. No other changes needed.

**Commit:**
  git add app/page.tsx
  git commit -m "chore: raise image limit to 50 for local testing"

---

### Task 2: Add 9:16 crop overlay to /api/debug/zones

**File:** app/api/debug/zones/route.ts

**Context:**
The debug page renders each image with an SVG overlay (viewBox="0 0 1 1", preserveAspectRatio="none") showing avoidRegions (red dashed) and safe zones A/B/C (green/blue/amber). All coordinates are normalized 0-1.

The image is displayed with `<img>` at natural aspect ratio. The SVG is stretched to match via `width:100%;height:100%`.

We need to add a white dashed rectangle showing what portion of the image is visible when cover-fitted to 9:16 format (1080×1920). This is center-crop behavior.

**Crop calculation (normalized coords, using img.width and img.height):**

Target aspect ratio: TARGET_AR = 9/16 = 0.5625
Image aspect ratio: image_ar = img.width / img.height

Case A — image is wider than 9:16 (image_ar > TARGET_AR):
  Image fills height, left/right are cropped.
  visible_w = TARGET_AR / image_ar   (fraction of image width that is visible)
  crop_x = (1 - visible_w) / 2
  crop rect: { x: crop_x, y: 0, w: visible_w, h: 1 }

Case B — image is taller than 9:16 (image_ar < TARGET_AR):
  Image fills width, top/bottom are cropped.
  visible_h = image_ar / TARGET_AR   (fraction of image height that is visible)
  crop_y = (1 - visible_h) / 2
  crop rect: { x: 0, y: crop_y, w: 1, h: visible_h }

Case C — exact match (image_ar === TARGET_AR):
  crop rect: { x: 0, y: 0, w: 1, h: 1 }   (no crop, show full frame)

**Change 1:** Add the crop rect calculation after the zones are parsed, before building svgRects. Add this in the for loop body, after the `const ZONE_COLORS` line:

  const TARGET_AR = 9 / 16;
  const imageAr = img.width > 0 && img.height > 0 ? img.width / img.height : TARGET_AR;
  let cropX = 0, cropY = 0, cropW = 1, cropH = 1;
  if (imageAr > TARGET_AR) {
    cropW = TARGET_AR / imageAr;
    cropX = (1 - cropW) / 2;
  } else if (imageAr < TARGET_AR) {
    cropH = imageAr / TARGET_AR;
    cropY = (1 - cropH) / 2;
  }
  const cropSvg = `<rect x="${cropX}" y="${cropY}" width="${cropW}" height="${cropH}"
    fill="none" stroke="#ffffff" stroke-width="0.006" stroke-dasharray="0.03,0.015"
    opacity="0.9"/>
  <text x="${cropX + cropW / 2}" y="${cropY + 0.04}"
    dominant-baseline="middle" text-anchor="middle"
    font-family="monospace" font-size="0.04" font-weight="bold"
    fill="#ffffff" stroke="#000" stroke-width="0.008" paint-order="stroke">9:16</text>`;

**Change 2:** Append cropSvg to the svgRects string. The current code is:

  const svgRects = zones ? [
    ...zones.avoidRegions.map(...),
    ...zones.zones.map(...),
  ].join("\n") : "";

Change to:

  const svgRects = [
    ...(zones ? [
      ...zones.avoidRegions.map(...same as before...),
      ...zones.zones.map(...same as before...),
    ] : []),
    cropSvg,
  ].join("\n");

Note: The crop overlay should always render (even when zones is null) so the developer can see the crop frame even on images not yet analyzed.

**Change 3:** Add a legend entry for the crop overlay. In the legend div at the bottom of each card, add:
  <span style="color:#ffffff">■ 9:16 crop (white dashed)</span>

**Commit:**
  git add app/api/debug/zones/route.ts
  git commit -m "feat: show 9:16 crop overlay in safe zones debug page"

---

## Verification

Task 1: Drop 10+ images onto the upload area — all should load (no truncation to 2).

Task 2: Open http://localhost:3000/api/debug/zones — each image card should show a white dashed rectangle indicating the 9:16 crop area. For portrait images the rect fills the full width. For landscape images the rect is a centered vertical strip. The label "9:16" should appear inside the top of the crop rect.
