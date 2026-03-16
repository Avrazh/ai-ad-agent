# Split Scene Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Split Scene layout pill that renders a vertical-split ad: product beauty shot on the left (540px) and a static lifestyle scene image from `public/scenes/` on the right (540px), with a draggable headline overlay.

**Architecture:** New `lib/templates/splitScene.ts` builds the HTML for the two-panel layout. `lib/render/renderAd.ts` loads the scene image from `public/scenes/<personaId>.*` and passes it via a new optional `context` param on `TemplateBuildFn`. `app/api/generate/route.ts` and `app/api/regenerate/route.ts` accept `scenePersonaId`. `app/page.tsx` adds `isSplitScene` flag, `handleSplitScene` callback, a layout pill, and a LiveAdCanvas rendering branch.

**Tech Stack:** Next.js 14 App Router, TypeScript, React useState/useCallback, Playwright/Puppeteer PNG rendering, Node.js fs/promises, static files in `public/scenes/`
---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/types.ts` | Modify | Add `"split_scene"` to TemplateId union; add `scenePersonaId?: string` to AdSpec |
| `lib/templates/registry.ts` | Modify | Add optional 5th param `context?: { sceneBase64?: string }` to TemplateBuildFn |
| `lib/templates/splitScene.ts` | Create | Split-panel template: left=product, right=scene, headline overlay |
| `lib/templates/index.ts` | Modify | Import `./splitScene` |
| `lib/render/renderAd.ts` | Modify | Load scene image from public/scenes/, pass as context to build() |
| `app/api/generate/route.ts` | Modify | Accept + forward `scenePersonaId` in AdSpec |
| `app/api/regenerate/route.ts` | Modify | Carry `scenePersonaId` from oldSpec into newSpec |
| `app/page.tsx` | Modify | isSplitScene flag, handleSplitScene, pill button, LiveAdCanvas branch |

---

## Chunk 1: Types, Registry, Template

### Task 1: Extend lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add split_scene to TemplateId**

Find the `TemplateId` type. Add `| "split_scene"` at the end of the union (before the closing semicolon).

- [ ] **Step 2: Add scenePersonaId to AdSpec**

Find the `AdSpec` interface. After `brandNameFontScale?: number` add:

    scenePersonaId?: string;  // scene filename stem: pre_1 through pre_6

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 4: Commit**

    git add lib/types.ts
    git commit -m "feat: add split_scene template id and scenePersonaId to AdSpec"

---
### Task 2: Extend TemplateBuildFn in lib/templates/registry.ts

**Files:**
- Modify: `lib/templates/registry.ts`

- [ ] **Step 1: Read lib/templates/registry.ts**

Find the TemplateBuildFn type definition.

- [ ] **Step 2: Add context param**

Change from:

    export type TemplateBuildFn = (
      spec: AdSpec,
      imageBase64: string,
      zonePx: PixelRect,
      safeZones?: SafeZones
    ) => string;

To:

    export type TemplateBuildFn = (
      spec: AdSpec,
      imageBase64: string,
      zonePx: PixelRect,
      safeZones?: SafeZones,
      context?: { sceneBase64?: string }
    ) => string;

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 4: Commit**

    git add lib/templates/registry.ts
    git commit -m "feat: add optional context param to TemplateBuildFn"

---
### Task 3: Create lib/templates/splitScene.ts

**Files:**
- Create: `lib/templates/splitScene.ts`

- [ ] **Step 1: Create the file**

Create `lib/templates/splitScene.ts` with this content:

    import { registerTemplate } from "./registry";
    import type { AdSpec, PixelRect, SafeZones } from "@/lib/types";

    const definition = {
      id: "split_scene" as const,
      familyId: "ai",
      label: "Split Scene",
      copySlots: ["headline" as const],
      preferredHeadlineLength: "short" as const,
      themeDefaults: { primaryColor: "#ffffff", accentColor: "#ffffff" },
    };

    function build(
      spec: AdSpec,
      imageBase64: string,
      _zonePx: PixelRect,
      _safeZones?: SafeZones,
      context?: { sceneBase64?: string }
    ): string {
      const W = 1080;
      const H = 1920;
      const headlineY = spec.headlineYOverride ?? 0.82;
      const headlineTopPx = Math.round(headlineY * H);
      const headline = spec.copy?.headline ?? "";

      // Headline overlay (empty string = no overlay on initial render)
      const headlineHtml = headline
        ? ("<div data-fit-headline style="position:absolute;left:0;right:0;top:" + headlineTopPx + "px;" +
           "padding:0 48px;text-align:center;font-family:Playfair Display,serif;font-weight:700;font-size:72px;" +
           "color:#ffffff;line-height:1.15;text-shadow:0 2px 16px rgba(0,0,0,0.85),0 1px 4px rgba(0,0,0,0.7);" +
           "word-break:normal;overflow-wrap:normal;">" + headline + "</div>")
        : "";

      // Scene panel: right half or dark fallback
      const sceneImg = context?.sceneBase64
        ? ("<img src="" + context.sceneBase64 + "" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block;" />")
        : "<div style="width:100%;height:100%;background:#1a1a2e;"></div>";

      // Layout: flex row with two 540px panels + 1px divider, headline absolute over both
      return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"/>" +
        "<style>* { margin:0;padding:0;box-sizing:border-box; } body { width:" + W + "px;height:" + H + "px;overflow:hidden;background:#000; }</style>" +
        "</head><body>" +
        "<div style=\"position:relative;width:" + W + "px;height:" + H + "px;display:flex;\">" +
        "<div style=\"width:540px;height:" + H + "px;overflow:hidden;flex-shrink:0;\">" +
        "<img src=\"" + imageBase64 + "\" style=\"width:100%;height:100%;object-fit:cover;object-position:50% 40%;display:block;\" /></div>" +
        "<div style=\"width:1px;height:" + H + "px;background:rgba(255,255,255,0.25);flex-shrink:0;\"></div>" +
        "<div style=\"width:539px;height:" + H + "px;overflow:hidden;flex-shrink:0;\">" + sceneImg + "</div>" +
        headlineHtml + "</div></body></html>";
    }

    registerTemplate(definition, build);

**Note:** The string concatenation above avoids TS template literals for clarity in the plan.
In your actual implementation, use TypeScript template literals (backtick strings) for cleaner code.
The key rendering requirements are:
- Left panel: 540px wide, product photo with object-fit:cover, object-position:50% 40%
- Divider: 1px white/25% opacity
- Right panel: 539px wide, scene image with object-fit:cover, object-position:center 30%
- Headline: absolute overlay, data-fit-headline attribute, Playfair Display, white text with shadow
- headlineHtml is empty string when spec.copy.headline is empty

- [ ] **Step 2: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 3: Commit**

    git add lib/templates/splitScene.ts
    git commit -m "feat: add split scene template"

---

### Task 4: Import splitScene in lib/templates/index.ts

**Files:**
- Modify: `lib/templates/index.ts`

- [ ] **Step 1: Find the line `import "./aiSurprise";` and add after it:**

    import "./splitScene";

- [ ] **Step 2: Verify TypeScript compiles**

    npx tsc --noEmit

- [ ] **Step 3: Commit**

    git add lib/templates/index.ts
    git commit -m "feat: register split scene template"

---
## Chunk 2: Render Pipeline

### Task 5: Add scene loading to lib/render/renderAd.ts

**Files:**
- Modify: `lib/render/renderAd.ts`

- [ ] **Step 1: Read lib/render/renderAd.ts**

Find the line `const html = template.build(spec, imageBase64, zonePx, safeZones);` (around line 167).
Confirm `readFile` and `path` are already imported at the top of the file.

- [ ] **Step 2: Insert scene loading block before the build() call**

Replace:

    const html = template.build(spec, imageBase64, zonePx, safeZones);

With:

    // Load scene image for split_scene template
    let buildContext: { sceneBase64?: string } | undefined;
    if (spec.scenePersonaId) {
      const exts = ["jpg", "jpeg", "png", "webp"];
      for (const ext of exts) {
        const scenePath = path.join(process.cwd(), "public", "scenes", spec.scenePersonaId + "." + ext);
        try {
          const sceneBuffer = await readFile(scenePath);
          const mimeMap: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
          };
          buildContext = {
            sceneBase64: "data:" + mimeMap[ext] + ";base64," + sceneBuffer.toString("base64"),
          };
          break;
        } catch {
          // try next extension
        }
      }
      if (!buildContext) {
        console.warn("[renderAd] scene image not found for persona: " + spec.scenePersonaId);
      }
    }
    const html = template.build(spec, imageBase64, zonePx, safeZones, buildContext);

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

Expected: no errors.

- [ ] **Step 4: Commit**

    git add lib/render/renderAd.ts
    git commit -m "feat: load scene image from public/scenes and pass to template build"

---

### Task 6: Add scenePersonaId to app/api/generate/route.ts

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Read app/api/generate/route.ts**

Find where request body is destructured (around line 29) and where the AdSpec object is constructed (around line 300).

- [ ] **Step 2: Add scenePersonaId to body destructuring**

Add `scenePersonaId?: string` to the destructured fields from `await req.json()`.

- [ ] **Step 3: Add scenePersonaId to AdSpec construction**

    ...(scenePersonaId ? { scenePersonaId } : {}),

- [ ] **Step 4: Verify TypeScript compiles**

    npx tsc --noEmit

- [ ] **Step 5: Commit**

    git add app/api/generate/route.ts
    git commit -m "feat: forward scenePersonaId through generate endpoint"

---

### Task 7: Add scenePersonaId carry-over to app/api/regenerate/route.ts

**Files:**
- Modify: `app/api/regenerate/route.ts`

- [ ] **Step 1: Read app/api/regenerate/route.ts**

Find where `newSpec` is constructed. This endpoint does NOT spread `oldSpec` -- every field must be explicitly carried over.

- [ ] **Step 2: Add scenePersonaId carry-over in newSpec**

    ...(oldSpec.scenePersonaId ? { scenePersonaId: oldSpec.scenePersonaId } : {}),

This ensures changing headline or tone on a split_scene ad preserves scenePersonaId.

- [ ] **Step 3: Verify TypeScript compiles**

    npx tsc --noEmit

- [ ] **Step 4: Commit**

    git add app/api/regenerate/route.ts
    git commit -m "feat: carry scenePersonaId through regenerate endpoint"

---
## Chunk 3: UI

### Task 8: page.tsx -- isSplitScene, handleSplitScene, pill, rendering branch

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add isSplitScene flag**

Find the block where `isCleanHeadline`, `isStarReview`, and `isHeadlineDraggable` are defined (around lines 893-904).

After `isStarReview`, add:

    const isSplitScene = selectedItem?.result?.templateId === "split_scene";

Extend `isHeadlineDraggable`:

    const isHeadlineDraggable = isCleanHeadline || isStarReview || isSplitScene;

- [ ] **Step 2: Add initialHeadlineY case for split_scene**

Find the `initialHeadlineY` derivation (around lines 906-910). Slot in split_scene at 0.82:

    const initialHeadlineY =
      isStarReview ? 0.72
      : isSplitScene ? 0.82
      : isCleanHeadline ? 0.5
      : 0.5;

(Adjust to match the current ternary structure.)

- [ ] **Step 3: Add handleSplitScene callback**

Add alongside other handlers in the useCallback block:

    const handleSplitScene = useCallback(async () => {
      if (!selectedItem || !activePersonaId) return;
      const queueId = selectedItem.id;
      setQueue((prev) => prev.map((q) =>
        q.id === queueId ? { ...q, status: "loading" } : q
      ));
      try {
        // Map persona ID to scene file (pre_1..pre_6 by segment)
      const PERSONA_SCENE: Record<string, string> = {
        per_trend_1: "pre_1", per_trend_2: "pre_1", per_trend_3: "pre_1",
        per_busy_1:  "pre_2", per_busy_2:  "pre_2", per_busy_3:  "pre_2",
        per_occ_1:   "pre_3", per_occ_2:   "pre_3", per_occ_3:   "pre_3",
        per_bud_1:   "pre_4", per_bud_2:   "pre_4", per_bud_3:   "pre_4",
        per_nat_1:   "pre_5", per_nat_2:   "pre_5", per_nat_3:   "pre_5",
        per_new_1:   "pre_6", per_new_2:   "pre_6", per_new_3:   "pre_6",
      };
      const sceneFile = PERSONA_SCENE[activePersonaId] ?? "pre_1";
      const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: selectedItem.imageId,
            forceTemplateId: "split_scene",
            scenePersonaId: sceneFile,
            lang: selectedLang,
            format: selectedFormat,
          }),
        });
        const data = await res.json();
        if (data.results?.[0]) {
          setQueue((prev) => prev.map((q) =>
            q.id === queueId
              ? { ...q, status: "done", result: data.results[0], usedSurpriseSpec: undefined }
              : q
          ));
        }
      } catch (err) {
        console.error("[handleSplitScene]", err);
        setQueue((prev) => prev.map((q) =>
          q.id === queueId ? { ...q, status: "error" } : q
        ));
      }
    }, [selectedItem, activePersonaId, selectedLang, selectedFormat, setQueue]);

Note: `activePersonaId` = the state variable tracking the currently selected persona.

- [ ] **Step 4: Add Split Scene pill button**

Find the layout picker pills section (around lines 1442-1484). Add:

    <button
      onClick={handleSplitScene}
      className={isSplitScene
        ? "px-3 py-1.5 rounded-md text-sm font-medium border bg-indigo-600/30 border-indigo-500/50 text-indigo-200 transition-colors"
        : "px-3 py-1.5 rounded-md text-sm font-medium border bg-white/5 border-white/10 text-white/70 hover:bg-white/10 transition-colors"}
    >
      Split Scene
    </button>

- [ ] **Step 5: Add isSplitScene LiveAdCanvas rendering branch**

Find the image rendering ternary (around lines 1507-1552). The existing structure is:
- isCleanHeadline -> LiveAdCanvas
- isStarReview -> LiveAdCanvas
- else -> img

Add isSplitScene as another LiveAdCanvas branch using the same props as isCleanHeadline.

- [ ] **Step 6: Manual smoke test**

1. Drop any lifestyle JPEG in `public/scenes/per_trend_1.jpg`
2. Open http://localhost:3000
3. Upload a product image, click Analyze All
4. Select per_trend_1 persona, click "Split Scene" pill
5. Verify: product on left (50% 40% crop), scene on right (center 30% crop)
6. Verify: draggable headline overlay appears and responds to drag
7. Click New Headline / change tone -- verify scene persists (scenePersonaId carried through)
8. Verify other layout pills still work normally

- [ ] **Step 7: Commit**

    git add app/page.tsx
    git commit -m "feat: add Split Scene layout pill, isSplitScene flag, and handleSplitScene"
