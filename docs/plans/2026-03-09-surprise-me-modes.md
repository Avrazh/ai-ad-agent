# Surprise Me Three Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Reference Image and Prompt modes to the Surprise Me button, alongside the existing Auto mode.

**Architecture:** Three files change. The AI function gains two optional params, the API route extracts and forwards them, and the UI replaces the single button with a mode-tab plus contextual input zone. No new routes, no new DB tables.

**Tech Stack:** Next.js App Router, React hooks, TypeScript, Anthropic SDK (claude-sonnet-4-6)

---

### Task 1: Extend generateSurpriseSVG

**Files:**
- Modify: `lib/ai/surpriseRender.ts`

1. Change signature to accept two optional params:
   `userPrompt?: string`
   `referenceImage?: { base64: string; mimeType: "image/jpeg"|"image/png"|"image/webp" }`

2. Build `creativeDirection` string at top of function:
   ```
   const creativeDirection = userPrompt
     ? "CREATIVE DIRECTION (highest priority):\n\"" + userPrompt + "\"\n\n"
     : "";
   ```
   Prepend it to the existing prompt text string.

3. Build `content` array dynamically. When `referenceImage` is provided, insert a second image block + caption text block before the main text block:
   ```
   [
     { type: "image", source: { type: "base64", media_type: mimeType, data: imageBase64 } },
     // if referenceImage:
     { type: "image", source: { type: "base64", media_type: referenceImage.mimeType, data: referenceImage.base64 } },
     { type: "text", text: "The image above is a STYLE REFERENCE only. Use it to inspire layout, color palette, mood, and typography. The first image is the product." },
     // always:
     { type: "text", text: creativeDirection + "You are a world-class creative director..." }
   ]
   ```

4. Commit:
   `git commit -m "feat: add userPrompt and referenceImage to generateSurpriseSVG"`

---

### Task 2: Update surprise-render API route

**Files:**
- Modify: `app/api/surprise-render/route.ts`

1. Destructure new fields from request body:
   ```
   const { imageId, imageUrl, lang = "en", userPrompt, referenceImageBase64, referenceImageMimeType } = await req.json();
   ```

2. Build referenceImage object:
   ```
   const referenceImage = referenceImageBase64 && referenceImageMimeType
     ? { base64: referenceImageBase64, mimeType: referenceImageMimeType }
     : undefined;
   ```

3. Pass to generateSurpriseSVG:
   `let svg = await generateSurpriseSVG(imageUrl, lang, userPrompt, referenceImage);`

4. Commit:
   `git commit -m "feat: pass userPrompt and referenceImage through surprise-render route"`

---

### Task 3: Add state and update handleSurpriseMe

**Files:**
- Modify: `app/page.tsx`

1. Add three state variables near the other state declarations:
   ```
   const [surpriseMode, setSurpriseMode] = useState<"auto"|"reference"|"prompt">("auto");
   const [surpriseRefFile, setSurpriseRefFile] = useState<File | null>(null);
   const [surprisePrompt, setSurprisePrompt] = useState("");
   ```

2. Add a module-level helper above the component:
   ```
   function fileToBase64(file: File): Promise<string> {
     return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = () => resolve((reader.result as string).split(",")[1]);
       reader.onerror = reject;
       reader.readAsDataURL(file);
     });
   }
   ```

3. In handleSurpriseMe, build extraFields before the fetch:
   ```
   const extraFields: Record<string, string> = {};
   if (surpriseMode === "prompt" && surprisePrompt.trim()) {
     extraFields.userPrompt = surprisePrompt.trim();
   } else if (surpriseMode === "reference" && surpriseRefFile) {
     extraFields.referenceImageBase64 = await fileToBase64(surpriseRefFile);
     extraFields.referenceImageMimeType = surpriseRefFile.type;
   }
   ```
   Spread into fetch body: `body: JSON.stringify({ imageId, imageUrl, lang: selectedLang, ...extraFields })`

4. Add surpriseMode, surprisePrompt, surpriseRefFile to the useCallback dependency array.

5. Commit:
   `git commit -m "feat: handleSurpriseMe sends mode-specific fields"`

---

### Task 4: Replace AI section UI with mode tabs

**Files:**
- Modify: `app/page.tsx` around line 1291

Find the AI section comment and replace the entire div with:

```
{/* AI - Surprise Me */}
<div className="space-y-2">
  <p className="text-[11px] text-gray-600">AI</p>

  {/* Mode tabs */}
  <div className="flex gap-1 rounded-lg bg-white/[0.04] p-0.5">
    {(["auto", "reference", "prompt"] as const).map((mode) => (
      <button key={mode} onClick={() => setSurpriseMode(mode)}
        className={"flex-1 rounded-md py-1 text-[11px] font-medium transition " +
          (surpriseMode === mode ? "bg-indigo-500/20 text-indigo-300" : "text-gray-500 hover:text-gray-300")}>
        {mode === "auto" ? "Auto" : mode === "reference" ? "Reference" : "Prompt"}
      </button>
    ))}
  </div>

  {/* Reference upload zone */}
  {surpriseMode === "reference" && (
    surpriseRefFile ? (
      <div className="relative w-full h-20 rounded-lg overflow-hidden border border-white/10">
        <img src={URL.createObjectURL(surpriseRefFile)} className="w-full h-full object-cover" alt="ref" />
        <button onClick={() => setSurpriseRefFile(null)}
          className="absolute top-1 right-1 rounded-full bg-black/60 text-white text-[10px] w-5 h-5 flex items-center justify-center hover:bg-black/80">x</button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center gap-1 w-full h-20 rounded-lg border border-dashed border-white/20 hover:border-indigo-400/40 cursor-pointer transition bg-white/[0.02]">
        <span className="text-[10px] text-gray-500">Drop or click to upload reference</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setSurpriseRefFile(f); }} />
      </label>
    )
  )}

  {/* Prompt textarea */}
  {surpriseMode === "prompt" && (
    <textarea value={surprisePrompt} onChange={(e) => setSurprisePrompt(e.target.value)}
      placeholder="Describe the mood, style, or concept..."
      rows={2}
      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/40" />
  )}

  {/* Action button */}
  <button
    onClick={() => handleSurpriseMe(selectedItem)}
    disabled={detailLoading || !selectedItem.imageId ||
      (surpriseMode === "reference" && !surpriseRefFile) ||
      (surpriseMode === "prompt" && !surprisePrompt.trim())}
    className="w-full rounded-lg border border-indigo-500/20 bg-indigo-500/10 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition disabled:opacity-40">
    <span className="flex items-center justify-center gap-2">
      <span>Surprise Me</span>
      <span className="text-[10px] font-normal opacity-50">1 credit</span>
    </span>
  </button>
</div>
```

Commit: `git commit -m "feat: Surprise Me UI with Auto/Reference/Prompt mode tabs"`

---

### Task 5: Push and verify

1. `git push origin main`
2. Run `npm run dev`
3. Test all three modes with a product image
4. Confirm server logs show correct fields for each mode
5. Set SKIP_AI=false temporarily to test actual Claude output with a prompt
