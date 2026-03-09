# Surprise Me — Three Modes Design

**Date:** 2026-03-09

## Overview

Extend the AI "Surprise Me" feature with two additional creative input modes: Reference Image and Prompt. Users choose between Auto (current behavior), Reference (upload a style inspiration image), or Prompt (type creative direction). All three modes call the same `/api/surprise-render` endpoint and produce the same SVG ad output.

## UI — app/page.tsx

Replace the single Surprise Me button in the AI section with:

1. **Mode tab toggle** — three pills: `Auto · Reference · Prompt`
2. **Contextual zone** — appears below the tabs based on active mode:
   - Auto: nothing
   - Reference: dashed upload zone. Once selected, shows thumbnail with X to clear
   - Prompt: 2-line textarea, placeholder "Describe the mood, style, or concept..."
3. **Surprise Me button** — always visible below contextual zone

New state: `surpriseMode`, `surpriseRefFile`, `surprisePrompt`

## API — app/api/surprise-render/route.ts

Add optional: `userPrompt`, `referenceImageBase64`, `referenceImageMimeType`

## AI — lib/ai/surpriseRender.ts

- User prompt: injected at top of Claude message as highest-priority creative direction
- Reference image: sent as second image block with style-reference caption

## Files Changed

1. `app/page.tsx`
2. `app/api/surprise-render/route.ts`
3. `lib/ai/surpriseRender.ts`
