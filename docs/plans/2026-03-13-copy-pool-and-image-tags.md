# Copy Pool Reduction + Image Context Tags

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce copy pool to 1 headline + 1 quote + 1 subtext per language (6 slots total), and extract structured image context tags during analysis for persona-aware copy generation.

**Architecture:** Two independent changes. (1) Slim down generateCopyPool in lib/ai/copy.ts. (2) Create lib/ai/tags.ts and wire into app/api/analyze/route.ts. DB column images.tags is already added.

**Tech Stack:** TypeScript, Next.js App Router, Anthropic SDK (claude-haiku-4-5-20251001), Turso/libSQL

---

## Already Done

- images.tags TEXT column added via ALTER TABLE in migrate()
- upsertImageTags(imageId, tags) exists in lib/db.ts
- getImage() and getAllImages() already return tags (null if not set)

---

### Task 1: Reduce copy pool to 1 slot per type per language

**Files:** Modify lib/ai/copy.ts

Current: 14 headlines + 3 quotes + 14 subtexts per language = 62 slots. Target: 1 headline + 1 quote + 1 subtext per language = 6 slots.

Change 1: Update JSDoc comment to say 6 slots total (1+1+1 x 2 langs).

Change 2: Set max_tokens to 512 (was 4096).

Change 3: Replace the prompt text with the following (this goes inside the existing text field of the messages array):

You are an expert e-commerce ad copywriter for SWITCH NAILS (press-on nails brand). Write in English (en) and German (de).
Return ONLY raw JSON (no markdown):
{
  "en": {
    "headline": {"angle":"benefit","text":"..."},
    "quote": {"text":"...","attribution":"- Name, Verified Buyer"},
    "subtext": {"angle":"benefit","text":"..."}
  },
  "de": {
    "headline": {"angle":"benefit","text":"..."},
    "quote": {"text":"...","attribution":"- Name, Verifizierte Kaeufer"},
    "subtext": {"angle":"benefit","text":"..."}
  }
}
Rules: headline 1-8 words punchy specific to image (angle: benefit|curiosity|urgency|emotional|aspirational|story|contrast), quote 10-25 words customer voice first person, subtext 3-8 words matches headline angle, German natural fluent not literal, no emojis, write about stick-on nails only ignore rings/jewelry/props.

Change 4: Replace the parsing loop (the for loop after JSON.parse) with:

  const slots: CopySlot[] = [];
  for (const lang of ["en", "de"] as Language[]) {
    const bucket = parsed[lang];
    if (!bucket) continue;
    const h = bucket.headline;
    slots.push({ id: newId("sl"), lang, slotType: "headline", text: h.text, angle: h.angle as CopySlot["angle"], wordCount: h.text.trim().split(/\s+/).filter(Boolean).length });
    const q = bucket.quote;
    slots.push({ id: newId("sl"), lang, slotType: "quote", text: q.text, attribution: q.attribution, wordCount: q.text.trim().split(/\s+/).filter(Boolean).length });
    const s = bucket.subtext;
    slots.push({ id: newId("sl"), lang, slotType: "subtext", text: s.text, angle: s.angle as CopySlot["angle"], wordCount: s.text.trim().split(/\s+/).filter(Boolean).length });
  }

Change 5: Replace entire buildHardcodedPool function with:

  function buildHardcodedPool(imageId: string): CopyPool {
    const slots: CopySlot[] = [
      { id: newId("sl"), lang: "en", slotType: "headline", text: "Salon look in 5 minutes", angle: "benefit", wordCount: 5 },
      { id: newId("sl"), lang: "en", slotType: "quote", text: "I literally threw away my nail kit. Zero chipping, zero hassle.", attribution: "- Emma R., Verified Buyer", wordCount: 12 },
      { id: newId("sl"), lang: "en", slotType: "subtext", text: "Professional results at home", angle: "benefit", wordCount: 4 },
      { id: newId("sl"), lang: "de", slotType: "headline", text: "Salon-Look in 5 Minuten", angle: "benefit", wordCount: 4 },
      { id: newId("sl"), lang: "de", slotType: "quote", text: "Kein Absplittern, kein Aufwand, keine Reue.", attribution: "- Emma R., Verifizierte Kaeufer", wordCount: 8 },
      { id: newId("sl"), lang: "de", slotType: "subtext", text: "Professionelle Ergebnisse zu Hause", angle: "benefit", wordCount: 4 },
    ];
    return { imageId, slots };
  }

Commit:
  git add lib/ai/copy.ts
  git commit -m "feat: reduce copy pool to 1 headline+quote+subtext per language"

---

### Task 2: Add ImageTags type to lib/types.ts

**Files:** Modify lib/types.ts

Add after the Language type (around line 37):

  // Image context tags - extracted once per image, stored in images.tags JSON column
  export type ImageTags = {
    color: string;          // nude|red|pink|white|black|blue|purple|green|orange|yellow|multicolor|clear
    finish: string;         // glossy|matte|glitter|metallic|chrome|shimmer
    length: string;         // short|medium|long
    shape: string;          // round|oval|almond|square|coffin|stiletto
    style_mood: string;     // minimal|elegant|bold|glam|playful|natural
    complexity: string;     // clean|decorated|patterned
    occasion?: string;      // everyday|work|night_out|bridal|seasonal
    nail_art_type?: string; // plain|french|ombre|floral|geometric|abstract|graphic
  };

Commit:
  git add lib/types.ts
  git commit -m "feat: add ImageTags type"

---

### Task 3: Create lib/ai/tags.ts

**Files:** Create lib/ai/tags.ts

Follow the exact same file structure as lib/ai/analyze.ts. Key specifics:
- Imports: ImageTags from @/lib/types, readStorage, path, Anthropic, withRetry
- MODEL = "claude-haiku-4-5-20251001"
- HARDCODED_FALLBACK: ImageTags = { color: "nude", finish: "glossy", length: "medium", shape: "almond", style_mood: "minimal", complexity: "clean", occasion: "everyday", nail_art_type: "plain" }
- export async function extractImageTags(imageId: string): Promise<ImageTags>
- Load image from storage the same way analyze.ts does (getImage, readStorage, base64 encode)
- Check SKIP_AI env var and ANTHROPIC_API_KEY, return HARDCODED_FALLBACK if either missing
- max_tokens: 256
- Prompt text: Analyze the nails in this SWITCH NAILS product image. Return ONLY raw JSON with these fields and allowed values: color (nude/red/pink/white/black/blue/purple/green/orange/yellow/multicolor/clear), finish (glossy/matte/glitter/metallic/chrome/shimmer), length (short/medium/long), shape (round/oval/almond/square/coffin/stiletto), style_mood (minimal/elegant/bold/glam/playful/natural), complexity (clean/decorated/patterned), occasion (everyday/work/night_out/bridal/seasonal), nail_art_type (plain/french/ombre/floral/geometric/abstract/graphic). Pick single best value per field. Return only JSON.
- Parse response: strip markdown fences then JSON.parse, cast to ImageTags
- console.log result with prefix [tags]
- Return HARDCODED_FALLBACK on any catch error

Commit:
  git add lib/ai/tags.ts
  git commit -m "feat: create extractImageTags function"

---

### Task 4: Wire tags extraction into /api/analyze

**Files:** Modify app/api/analyze/route.ts

Change 1: Add import at top:
  import { extractImageTags } from "@/lib/ai/tags";
  Also add upsertImageTags to the @/lib/db import list.

Change 2: After the copy pool block (after the closing brace of the if (!cachedCopy) block), add:

    // Image tags - cached in images.tags column, extracted once per image
    const freshImage = await getImage(imageId);
    if (!freshImage?.tags) {
      const tags = await extractImageTags(imageId);
      await upsertImageTags(imageId, tags);
    }

Commit:
  git add app/api/analyze/route.ts
  git commit -m "feat: extract and cache image context tags during analyze"

---

## Verification

Upload a new image and check server logs for:
  [copy] CopyPool from Claude for img_xxx - 6 slots  (was 62)
  [tags] ImageTags from Claude for img_xxx: { color: ..., finish: ..., ... }

Check DB: SELECT id, tags FROM images ORDER BY created_at DESC LIMIT 1;
Should return a JSON string with all 8 tag fields populated.
