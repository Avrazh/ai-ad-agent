import pathlib
bt = chr(96)
bt3 = bt * 3
nl = chr(10)
q = chr(34)
sq = chr(39)
dest = pathlib.Path("c:/Users/jiwar computer/ai-ad-agent/docs/superpowers/plans/2026-03-19-f7-text-boxes.md")
dest.parent.mkdir(parents=True, exist_ok=True)
p = []
def w(s=""): p.append(s + nl)
def code(lang, lines): p.append(bt3 + lang + nl); [p.append(l + nl) for l in lines]; p.append(bt3 + nl)

# Header
w("# F7: Free-form Text Boxes + Hide Headline Implementation Plan")
w()
w("> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.")
w()
w("**Goal:** Let users add unlimited free-form draggable text boxes to any ad, and optionally hide the generated headline box.")
w()
w("**Architecture:** A new `DraggableTextBlock` component handles one text box (2D drag, bottom-right resize, top-right delete, color, inline edit, bullet toggle). Text boxes are stored as `textBoxes: TextBox[]` in `AdSpec` and rendered into the final PNG by a shared helper injected in `renderAd.ts` after the template HTML. The headline box is unchanged \u2014 it gets a hide/show toggle via `hideHeadline: boolean` on `AdSpec`.")
w()
w("**Tech Stack:** React (client component), TypeScript, Puppeteer/Chromium (server-side PNG render), existing reposition API route.")
w()
w("---")
w()

# Chunk 1
w("## Chunk 1: Types + Data Model")
w()
w("### Task 1: Add TextBox type and update AdSpec")
w()
w("**Files:**")
w("- Modify: `lib/types.ts`")
w()
w("- [ ] **Step 1: Add TextBox type to lib/types.ts**")
w()
w("Open `lib/types.ts`. After the `AdSpec` type, add:")
w()
code("typescript", [
    "// \u2500\u2500 Text Box (user-added free-form overlay) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    "export type TextBox = {",
    '  id: string;       // unique, e.g. newId("tb")',
    "  text: string;     // raw text content (newlines allowed)",
    "  x: number;        // 0-1 normalized canvas X (left edge of box)",
    "  y: number;        // 0-1 normalized canvas Y (top edge of box)",
    "  w: number;        // 0-1 normalized canvas width",
    "  fontSize: number; // 0-1 normalized canvas height fraction (e.g. 0.035)",
    "  color: string;    // hex color",
    "  bold: boolean;",
    '  bullets: boolean; // prepend "\u2022 " to each line',
    "};",
])
w("- [ ] **Step 2: Add textBoxes and hideHeadline to AdSpec**")
w()
w("In `lib/types.ts`, inside the `AdSpec` type, add two new optional fields after `headlineColor?: string;`:")
w()
code("typescript", [
    "  hideHeadline?: boolean;       // if true, headline overlay is hidden in canvas and Puppeteer render",
    "  textBoxes?: TextBox[];        // user-added free-form text overlays",
])
w("- [ ] **Step 3: Commit**")
w()
code("bash", [
    "git add lib/types.ts",
    'git commit -m "feat(f7): add TextBox type and hideHeadline/textBoxes to AdSpec"',
])
w("---")
w()

# Chunk 2 intro
w("## Chunk 2: DraggableTextBlock Component")
w()
w("### Task 2: Create DraggableTextBlock component")
w()
w("**Files:**")
w("- Create: `app/components/DraggableTextBlock.tsx`")
w()
w("This component renders one text box with:")
w("- Drag anywhere on the box to move (X and Y)")
w("- Bottom-right corner handle: drag right/left = change width, drag up/down = change font size")
w("- Top-right corner: \u00d7 delete button")
w("- Top-left corner: color swatch (same style as headline color swatch)")
w("- Click text area: enter inline edit mode (contentEditable)")
w("- `bullets` toggle renders \"\u2022 \" before each line in display mode")
w()
w("- [ ] **Step 1: Create the file**")
w()
w("Create `app/components/DraggableTextBlock.tsx`:")
w()

# TSX component code block
tsx_lines_part1 = [
    chr(34) + chr(34) + chr(34) + 'use client' + chr(34) + chr(34) + chr(34) + ';',
]
print(tsx_lines_part1)
