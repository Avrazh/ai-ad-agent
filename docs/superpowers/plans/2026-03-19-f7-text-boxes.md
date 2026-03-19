# F7 — Free-form Text Boxes + Hide Headline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add unlimited free-form draggable text boxes on top of any ad, and optionally hide the AI-generated headline box.

**Architecture:** Text boxes are client-side overlays in `LiveAdCanvas` (instant feedback). On every interaction end (drag, resize, edit, toggle), the reposition route is called with the updated `textBoxes` array and a new PNG is rendered with text boxes baked in — exactly like the existing headline overlay pattern. The headline's hide/show toggle sets `hideHeadline` on the AdSpec; the `aiSurprise` template checks this flag and skips rendering the headline HTML.

**Tech Stack:** React (client overlays), TypeScript, Puppeteer (server bake-in), Next.js API routes, SQLite AdSpec storage.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `lib/types.ts` | Add `TextBox` type; add `textBoxes?` and `hideHeadline?` to `AdSpec` |
| Create | `app/components/DraggableTextBlock.tsx` | Generic text box: 2D drag, bottom-right resize, top-right delete, top-left color, inline edit, bold + bullets toggle |
| Modify | `app/components/LiveAdCanvas.tsx` | Add text box layer + "Add Text" button; add hide-headline toggle; pass callbacks up |
| Create | `lib/templates/textBoxHelper.ts` | `buildTextBoxesHtml(boxes, w, h)` — Puppeteer HTML for all text boxes |
| Modify | `lib/render/renderAd.ts` | Inject text box HTML before `</body>`; pass `hideHeadline` to template context |
| Modify | `lib/templates/aiSurprise.tsx` | Skip headline HTML when `spec.hideHeadline === true` |
| Modify | `app/api/reposition/route.ts` | Accept `textBoxes` and `hideHeadline`; persist to new AdSpec |
| Modify | `app/page.tsx` | Seed `initialTextBoxes` and `initialHideHeadline` from result; wire callbacks to reposition |

---

## Task 1: Add TextBox type and AdSpec fields

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the TextBox type**

In `lib/types.ts`, add after the `RenderResult` type block:

```typescript
// ── Text Boxes (user-added overlays) ─────────────────────────
export type TextBox = {
  id: string;
  text: string;
  x: number;        // 0-1 normalized canvas X (left edge of box)
  y: number;        // 0-1 normalized canvas Y (top edge of box)
  w: number;        // 0-1 normalized canvas width
  fontSize: number; // 0-1 normalized canvas height (e.g. 0.04 = 4% of canvas height)
  color: string;    // hex
  bold: boolean;
  bullets: boolean;
};
```

- [ ] **Step 2: Update AdSpec**

In `AdSpec`, add after `splitSwapped?`:

```typescript
  textBoxes?: TextBox[];   // user-added free-form text overlays
  hideHeadline?: boolean;  // if true, suppress AI headline in render
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(F7): add TextBox type and AdSpec fields"
```

---

## Task 2: Create DraggableTextBlock component

**Files:**
- Create: `app/components/DraggableTextBlock.tsx`

### Layout spec
- **Top-left**: color swatch (opens `<input type="color">`)
- **Top-right**: × delete button (red circle)
- **Bottom-right**: resize handle — drag right/left changes `w`, drag up/down changes `fontSize`
- **Bottom-left**: mini toolbar with B (bold) and • (bullets) toggle buttons
- **Click body**: inline edit mode (contentEditable)
- **Escape / blur**: exits edit mode, fires `onChange`
- Dashed indigo border (same style as existing headline overlay)
- When `bullets=true`: each line is prefixed with `• ` in display and edit

- [ ] **Step 1: Create the file**

Create `app/components/DraggableTextBlock.tsx`:

```tsx
"use client";
import { useRef, useState, useEffect } from "react";
import type { TextBox } from "@/lib/types";

interface Props {
  box: TextBox;
  containerW: number;
  containerH: number;
  onChange: (updated: TextBox) => void;
  onDelete: (id: string) => void;
}

export function DraggableTextBlock({ box, containerW, containerH, onChange, onDelete }: Props) {
  const [local, setLocal] = useState(box);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ mouseX: 0, mouseY: 0 });
  const resizeRef = useRef({ mouseX: 0, mouseY: 0, startW: 0, startFs: 0 });
  const localRef = useRef(local);
  localRef.current = local;

  // Sync when parent swaps to a different box (e.g. switching images)
  useEffect(() => { setLocal(box); }, [box.id]);

  // Focus and position cursor at end when entering edit mode
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    const displayText = local.bullets
      ? local.text.split("\n").map(l => `• ${l}`).join("\n")
      : local.text;
    el.innerText = displayText;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Global mouse move/up for drag and resize
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragRef.current.mouseX) / containerW;
        const dy = (e.clientY - dragRef.current.mouseY) / containerH;
        setLocal(cur => {
          const next = {
            ...cur,
            x: Math.max(0, Math.min(0.95, cur.x + dx)),
            y: Math.max(0, Math.min(0.95, cur.y + dy)),
          };
          localRef.current = next;
          return next;
        });
        dragRef.current = { mouseX: e.clientX, mouseY: e.clientY };
      }
      if (isResizing) {
        const dx = (e.clientX - resizeRef.current.mouseX) / containerW;
        const dy = (resizeRef.current.mouseY - e.clientY) / containerH; // up = bigger
        const nextW = Math.max(0.1, Math.min(1, resizeRef.current.startW + dx));
        const nextFs = Math.max(0.012, Math.min(0.18, resizeRef.current.startFs + dy * 0.5));
        setLocal(cur => {
          const next = { ...cur, w: nextW, fontSize: nextFs };
          localRef.current = next;
          return next;
        });
      }
    };
    const onUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      onChange(localRef.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, isResizing, containerW, containerH, onChange]);

  const displayText = local.bullets
    ? local.text.split("\n").map(l => `• ${l}`).join("\n")
    : local.text;

  const px = local.x * containerW;
  const py = local.y * containerH;
  const pw = local.w * containerW;
  const fs = local.fontSize * containerH;

  return (
    <div
      style={{
        position: "absolute",
        left: px, top: py, width: pw,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: 20,
      }}
      onMouseDown={(e) => {
        if (editing) return;
        e.preventDefault();
        dragRef.current = { mouseX: e.clientX, mouseY: e.clientY };
        setIsDragging(true);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        setIsDragging(false);
        setEditing(true);
      }}
    >
      {/* Dashed selection border */}
      <div style={{
        position: "absolute",
        inset: "-6px",
        border: "1.5px dashed rgba(99,102,241,0.7)",
        borderRadius: 6,
        pointerEvents: "none",
      }} />

      {/* Color swatch — top-left */}
      <input
        ref={colorInputRef}
        type="color"
        value={local.color}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        onChange={(e) => {
          const next = { ...localRef.current, color: e.target.value };
          setLocal(next);
          onChange(next);
        }}
      />
      <div
        title="Change color"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); colorInputRef.current?.click(); }}
        style={{
          position: "absolute", top: -14, left: -14,
          width: 20, height: 20, borderRadius: "50%",
          background: local.color,
          border: "2px solid rgba(255,255,255,0.5)",
          cursor: "pointer", zIndex: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      />

      {/* Delete button — top-right */}
      <div
        title="Delete text box"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
        style={{
          position: "absolute", top: -14, right: -14,
          width: 20, height: 20, borderRadius: "50%",
          background: "#ef4444",
          cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Resize handle — bottom-right (drag X=width, drag Y=fontSize) */}
      <div
        title="Drag to resize (left/right = width, up/down = font size)"
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          resizeRef.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            startW: localRef.current.w,
            startFs: localRef.current.fontSize,
          };
          setIsResizing(true);
        }}
        style={{
          position: "absolute", bottom: -14, right: -14,
          width: 20, height: 20, borderRadius: 4,
          background: "#6366f1",
          cursor: "nwse-resize", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 8L8 2M5 8L8 8L8 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Bold + Bullets mini toolbar — bottom-left */}
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ position: "absolute", bottom: -26, left: -6, display: "flex", gap: 4 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = { ...localRef.current, bold: !localRef.current.bold };
            setLocal(next);
            onChange(next);
          }}
          style={{
            background: local.bold ? "#6366f1" : "rgba(0,0,0,0.5)",
            color: "white", border: "none", borderRadius: 3,
            fontSize: 10, fontWeight: 700, padding: "2px 5px", cursor: "pointer",
          }}
        >B</button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = { ...localRef.current, bullets: !localRef.current.bullets };
            setLocal(next);
            onChange(next);
          }}
          style={{
            background: local.bullets ? "#6366f1" : "rgba(0,0,0,0.5)",
            color: "white", border: "none", borderRadius: 3,
            fontSize: 10, padding: "2px 5px", cursor: "pointer",
          }}
        >•</button>
      </div>

      {/* Text content */}
      {editing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
          onBlur={() => {
            const raw = editRef.current?.innerText ?? local.text;
            const cleaned = local.bullets
              ? raw.split("\n").map(l => l.replace(/^•\s?/, "")).join("\n")
              : raw;
            const next = { ...localRef.current, text: cleaned.replace(/\n$/, "") };
            setLocal(next);
            setEditing(false);
            onChange(next);
          }}
          style={{
            margin: 0,
            fontFamily: "Inter, sans-serif",
            fontSize: `${fs}px`,
            fontWeight: local.bold ? 700 : 400,
            color: local.color,
            lineHeight: 1.3,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            outline: "none",
            cursor: "text",
            minHeight: `${fs * 1.3}px`,
          }}
        />
      ) : (
        <p style={{
          margin: 0,
          fontFamily: "Inter, sans-serif",
          fontSize: `${fs}px`,
          fontWeight: local.bold ? 700 : 400,
          color: local.color,
          lineHeight: 1.3,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>
          {displayText || <span style={{ opacity: 0.4, fontStyle: "italic" }}>Double-click to edit</span>}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/DraggableTextBlock.tsx
git commit -m "feat(F7): add DraggableTextBlock component"
```

---

## Task 3: Build text box Puppeteer helper

**Files:**
- Create: `lib/templates/textBoxHelper.ts`

- [ ] **Step 1: Create the helper**

Create `lib/templates/textBoxHelper.ts`:

```typescript
import type { TextBox } from "@/lib/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns absolutely-positioned HTML divs for all user text boxes.
 * Inject this inside <body> which has position:relative and overflow:hidden.
 */
export function buildTextBoxesHtml(boxes: TextBox[], canvasW: number, canvasH: number): string {
  if (!boxes || boxes.length === 0) return "";
  return boxes.map(box => {
    const x = Math.round(box.x * canvasW);
    const y = Math.round(box.y * canvasH);
    const w = Math.round(box.w * canvasW);
    const fs = Math.round(box.fontSize * canvasH);
    const fw = box.bold ? 700 : 400;
    const lines = box.text.split("\n").map(l => box.bullets ? `&bull; ${esc(l)}` : esc(l));
    const html = lines.join("<br>");
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-family:'Inter',sans-serif;font-size:${fs}px;font-weight:${fw};color:${esc(box.color)};line-height:1.3;word-break:break-word;white-space:pre-wrap;">${html}</div>`;
  }).join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/templates/textBoxHelper.ts
git commit -m "feat(F7): add text box Puppeteer HTML helper"
```

---

## Task 4: Inject text boxes in renderAd + handle hideHeadline in aiSurprise

**Files:**
- Modify: `lib/render/renderAd.ts`
- Modify: `lib/templates/aiSurprise.tsx`

- [ ] **Step 1: Import and inject text boxes in renderAd.ts**

At the top of `lib/render/renderAd.ts`, add:

```typescript
import { buildTextBoxesHtml } from "@/lib/templates/textBoxHelper";
```

Find the line `const html = template.build(spec, imageBase64, zonePx, safeZones)` (approximately line 200+). Replace it with:

```typescript
const templateHtml = template.build(spec, imageBase64, zonePx, safeZones);
const textBoxHtml = buildTextBoxesHtml(spec.textBoxes ?? [], spec.renderMeta.w, spec.renderMeta.h);
const html = textBoxHtml
  ? templateHtml.replace("</body>", `${textBoxHtml}</body>`)
  : templateHtml;
```

- [ ] **Step 2: Handle hideHeadline in aiSurprise.tsx**

At the top of the `build()` function in `lib/templates/aiSurprise.tsx`, add:

```typescript
const hideHeadline = spec.hideHeadline === true;
```

Then find every place where the headline `<div data-fit-headline ...>` or headline text is inserted into the layout HTML. There will be one per layout branch (top_bottom, split_left, split_right, full_overlay, etc.). For each, wrap it:

```typescript
// Before:
`<div data-fit-headline ...>${headline}</div>`

// After:
hideHeadline ? "" : `<div data-fit-headline ...>${headline}</div>`
```

Do the same for any subtext that only appears with the headline (each layout branch may differ — check each one).

- [ ] **Step 3: Commit**

```bash
git add lib/render/renderAd.ts lib/templates/aiSurprise.tsx
git commit -m "feat(F7): inject text boxes in Puppeteer render; hideHeadline in aiSurprise"
```

---

## Task 5: Update reposition route

**Files:**
- Modify: `app/api/reposition/route.ts`

- [ ] **Step 1: Accept textBoxes and hideHeadline**

In the destructured body at line 16, add `textBoxes` and `hideHeadline`:

```typescript
const { resultId, headlineYOverride, headlineFontScale, brandNameY, brandNameFontScale,
  headlineFont, showBrand, headlineColor, brandColor, headlineOverride,
  splitSecondImageId, splitDividerX, splitProductPanX, splitSecondPanX, splitSwapped,
  textBoxes, hideHeadline,   // ← add these
} = await req.json() as {
  // ... existing fields ...
  textBoxes?: import("@/lib/types").TextBox[];
  hideHeadline?: boolean;
};
```

In the `newSpec` object, add after the split fields:

```typescript
...(textBoxes !== undefined ? { textBoxes } : {}),
...(hideHeadline !== undefined ? { hideHeadline } : {}),
```

In the response JSON, add:

```typescript
textBoxes: newSpec.textBoxes,
hideHeadline: newSpec.hideHeadline,
```

- [ ] **Step 2: Commit**

```bash
git add app/api/reposition/route.ts
git commit -m "feat(F7): reposition route accepts textBoxes and hideHeadline"
```

---

## Task 6: Update LiveAdCanvas

**Files:**
- Modify: `app/components/LiveAdCanvas.tsx`

- [ ] **Step 1: Add imports and new props**

Add import at top:

```typescript
import { DraggableTextBlock } from "./DraggableTextBlock";
import type { TextBox } from "@/lib/types";
```

Add to the `Props` interface:

```typescript
textBoxes?: TextBox[];
hideHeadline?: boolean;
onTextBoxesChange?: (boxes: TextBox[]) => void;
onHideHeadlineChange?: (hide: boolean) => void;
```

- [ ] **Step 2: Add local state**

Inside `LiveAdCanvas`, add:

```typescript
const [boxes, setBoxes] = useState<TextBox[]>(textBoxes ?? []);
// Sync when switching images
useEffect(() => { setBoxes(textBoxes ?? []); }, [JSON.stringify(textBoxes)]);
```

- [ ] **Step 3: Wrap existing headline overlay with hideHeadline check**

Find the `<div onMouseDown=...>` that starts the headline drag block (around line 322). Wrap it:

```tsx
{!hideHeadline && (
  <div onMouseDown={...} ...>
    {/* existing content unchanged */}
  </div>
)}
```

- [ ] **Step 4: Render DraggableTextBlock for each box**

Inside the canvas `<div ref={containerRef}>`, after the headline overlay block, add:

```tsx
{boxes.map(box => (
  <DraggableTextBlock
    key={box.id}
    box={box}
    containerW={containerW}
    containerH={containerRef.current?.getBoundingClientRect().height ?? 600}
    onChange={(updated) => {
      const next = boxes.map(b => b.id === updated.id ? updated : b);
      setBoxes(next);
      onTextBoxesChange?.(next);
    }}
    onDelete={(id) => {
      const next = boxes.filter(b => b.id !== id);
      setBoxes(next);
      onTextBoxesChange?.(next);
    }}
  />
))}
```

- [ ] **Step 5: Add "Add Text" button and hide-headline toggle**

Outside and below the canvas `<div>` (inside the outer `<div className="relative h-full...">`), add:

```tsx
{!disabled && (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
    <button
      onClick={() => {
        const newBox: TextBox = {
          id: crypto.randomUUID(),
          text: "Your text here",
          x: 0.1, y: 0.45,
          w: 0.8,
          fontSize: 0.04,
          color: "#ffffff",
          bold: false,
          bullets: false,
        };
        const next = [...boxes, newBox];
        setBoxes(next);
        onTextBoxesChange?.(next);
      }}
      style={{
        background: "#6366f1", color: "white", border: "none",
        borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer",
      }}
    >+ Add Text</button>
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a1a1aa", cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={hideHeadline ?? false}
        onChange={(e) => onHideHeadlineChange?.(e.target.checked)}
      />
      Hide headline
    </label>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add app/components/LiveAdCanvas.tsx
git commit -m "feat(F7): text boxes + hide headline in LiveAdCanvas"
```

---

## Task 7: Wire into page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add TextBox to result type**

Find the inline result type in `QueueItem` (or wherever `result` is typed). Add:

```typescript
textBoxes?: TextBox[];
hideHeadline?: boolean;
```

Also add the import: `import type { TextBox } from "@/lib/types";`

- [ ] **Step 2: Add handler functions**

Add alongside the existing `handleReposition` / `handleTextChange` functions:

```typescript
async function handleTextBoxesChange(textBoxes: TextBox[]) {
  if (!selectedItem?.result) return;
  const res = await fetch("/api/reposition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resultId: selectedItem.result.id,
      headlineYOverride: selectedItem.result.headlineYOverride ?? 0.3,
      textBoxes,
      hideHeadline: selectedItem.result.hideHeadline,
    }),
  });
  const data = await res.json();
  if (data.ok) updateItem({ result: { ...selectedItem.result, ...data.result } });
}

async function handleHideHeadlineChange(hideHeadline: boolean) {
  if (!selectedItem?.result) return;
  const res = await fetch("/api/reposition", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resultId: selectedItem.result.id,
      headlineYOverride: selectedItem.result.headlineYOverride ?? 0.3,
      textBoxes: selectedItem.result.textBoxes,
      hideHeadline,
    }),
  });
  const data = await res.json();
  if (data.ok) updateItem({ result: { ...selectedItem.result, ...data.result } });
}
```

- [ ] **Step 3: Pass props to LiveAdCanvas**

Find where `<LiveAdCanvas` is rendered. Add:

```tsx
textBoxes={selectedItem.result?.textBoxes}
hideHeadline={selectedItem.result?.hideHeadline}
onTextBoxesChange={handleTextBoxesChange}
onHideHeadlineChange={handleHideHeadlineChange}
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(F7): wire text boxes and hide headline into page.tsx"
```

---

## Task 8: Manual test checklist

- [ ] `npm run dev` — no build errors
- [ ] Upload an image, generate an ad with any layout
- [ ] Click **"+ Add Text"** → text box appears on canvas at center-left
- [ ] Drag the box to a new position → `onTextBoxesChange` fires, PNG re-renders with box baked in
- [ ] Double-click box → edit mode; type new text → blur → PNG re-renders
- [ ] Drag bottom-right handle right → box gets wider in PNG
- [ ] Drag bottom-right handle up → font gets bigger in PNG
- [ ] Click color swatch (top-left) → pick a color → PNG updates
- [ ] Click **B** toggle → text goes bold in PNG
- [ ] Click **•** toggle → lines get `•` prefix in PNG
- [ ] Click **×** (top-right) → box disappears, PNG re-renders without it
- [ ] Add two text boxes → both appear in PNG
- [ ] Check **"Hide headline"** → headline gone from preview and PNG
- [ ] Uncheck → headline comes back
- [ ] Switch to a different image → text boxes reset (don't bleed over)

- [ ] **Final push**

```bash
git push origin master
```

---

## Known limitations (v1 — acceptable)

- Text boxes use Inter font only in Puppeteer. Font picker can be added as F7.1.
- `hideHeadline` only implemented for `ai_surprise` template. Other templates (quote_card, star_review, luxury) still show the headline — add per-template when needed.
- No touch/mobile drag (mouse only).
- Text box state resets when switching images — by design, each image has its own AdSpec.
