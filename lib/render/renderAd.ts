import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { AdSpec, SafeZones } from "@/lib/types";
import { toPixels } from "@/lib/types";
import { getTemplate } from "@/lib/templates";
import { read as readStorage, save } from "@/lib/storage";
import { newId } from "@/lib/ids";

// ── Browser ────────────────────────────────────────────────────────────────
// Local dev: use puppeteer (bundled Chromium, works on Windows/Mac/Linux)
// Production (Vercel/Lambda): use @sparticuz/chromium (stripped, fits in serverless)
import { type Browser } from "puppeteer-core";

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance) return browserInstance;
  if (IS_SERVERLESS) {
    const puppeteer = (await import("puppeteer-core")).default;
    const chromium = (await import("@sparticuz/chromium")).default;
    const executablePath = await chromium.executablePath();
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: null,
      executablePath,
      headless: true,
    });
  } else {
    const puppeteer = (await import("puppeteer")).default;
    browserInstance = await puppeteer.launch({ headless: true });
  }
  return browserInstance;
}


// ── Font CSS (loaded once as base64, injected into every page) ─────────────
type FontDef = { family: string; weight: number; file: string; format: string };

const FONT_DEFS: FontDef[] = [
  { family: "Inter",            weight: 400, file: "Inter-Regular.ttf",          format: "truetype" },
  { family: "Inter",            weight: 700, file: "Inter-Bold.ttf",              format: "truetype" },
  { family: "Bebas Neue",       weight: 400, file: "BebasNeue-Regular.ttf",       format: "truetype" },
  { family: "Playfair Display", weight: 400, file: "PlayfairDisplay-Regular.woff",format: "woff" },
  { family: "Playfair Display", weight: 700, file: "PlayfairDisplay-Bold.woff",   format: "woff" },
  { family: "Tangerine",        weight: 400, file: "Tangerine-Regular.woff",      format: "woff" },
  { family: "Tangerine",        weight: 700, file: "Tangerine-Bold.woff",         format: "woff" },
  { family: "Abril Fatface",    weight: 400, file: "AbrilFatface-Regular.woff",   format: "woff" },
  { family: "Bodoni Moda",      weight: 400, file: "BodoniModa-Regular.woff",     format: "woff" },
  { family: "Bodoni Moda",      weight: 700, file: "BodoniModa-Bold.woff",        format: "woff" },
];

let fontCSS: string | null = null;

async function getFontCSS(): Promise<string> {
  if (fontCSS) return fontCSS;
  const fontsDir = path.join(process.cwd(), "fonts");
  const rules = await Promise.all(
    FONT_DEFS.map(async ({ family, weight, file, format }) => {
      const buf = await readFile(path.join(fontsDir, file));
      const b64 = buf.toString("base64");
      return `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: normal; src: url('data:font/${format};base64,${b64}') format('${format}'); }`;
    })
  );
  fontCSS = rules.join("\n");
  return fontCSS;
}

// ── Image cache ────────────────────────────────────────────────────────────
const imageBase64Cache = new Map<string, string>();

// ── renderAd ───────────────────────────────────────────────────────────────
export async function renderAd(
  spec: AdSpec,
  safeZones: SafeZones
): Promise<{ pngUrl: string; renderResultId: string }> {
  const template = getTemplate(spec.templateId);

  const zone = safeZones.zones.find((z) => z.id === spec.zoneId);
  if (!zone) throw new Error(`Zone "${spec.zoneId}" not found in SafeZones`);

  const zonePx = toPixels(zone.rect, spec.renderMeta.w, spec.renderMeta.h);

  // Load + resize source image with smart focal-point crop, cache per imageId+canvas size
  const cacheKey = `${spec.imageId}:${spec.renderMeta.w}x${spec.renderMeta.h}`;
  let imageBase64 = imageBase64Cache.get(cacheKey);
  if (!imageBase64) {
    const { url: imageUrl } = await getImageInfo(spec.imageId);
    const rawBuffer = await readStorage("uploads", imageUrl);
    // Smart crop: use avoidRegions cx for horizontal positioning (anchors on hands),
    // keep vertical centered to avoid zoom. Falls back to "attention" if no avoidRegion.
    const meta = await sharp(rawBuffer).metadata();
    const sw = meta.width ?? spec.renderMeta.w;
    const sh = meta.height ?? spec.renderMeta.h;
    const tw = spec.renderMeta.w;
    const th = spec.renderMeta.h;
    const region = safeZones.avoidRegions[0];
    const CX_BIAS = -0.10; // shift crop left — tune if hands appear off-center
    const cx = region ? Math.max(0, Math.min(1, region.x + region.w / 2 + CX_BIAS)) : null;

    let pipeline = sharp(rawBuffer);
    if (cx !== null && sw / sh > tw / th) {
      // Source wider than target: crop width using avoidRegion cx for horizontal alignment
      const cropW = Math.round(sh * (tw / th));
      const cropLeft = Math.max(0, Math.min(Math.round(cx * sw - cropW / 2), sw - cropW));
      pipeline = pipeline.extract({ left: cropLeft, top: 0, width: cropW, height: sh });
    } else if (cx !== null && sw / sh < tw / th) {
      // Source taller than target: crop height using center vertical (not cy — avoids zoom)
      const cropH = Math.round(sw * (th / tw));
      const cropTop = Math.max(0, Math.min(Math.round(sh / 2 - cropH / 2), sh - cropH));
      pipeline = pipeline.extract({ left: 0, top: cropTop, width: sw, height: cropH });
    }
    const resizedBuffer = await pipeline
      .resize(tw, th, { fit: "cover", position: cx === null ? "attention" : "centre" })
      .jpeg({ quality: 85 })
      .toBuffer();
    imageBase64 = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
    imageBase64Cache.set(cacheKey, imageBase64);
  }

  // Build template → HTML string
  const html = template.build(spec, imageBase64, zonePx, safeZones);

  // Wrap in a full HTML page with embedded fonts + reset CSS
  const fonts = await getFontCSS();
  const page_html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${fonts}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { width: ${spec.renderMeta.w}px; height: ${spec.renderMeta.h}px; overflow: hidden; }
</style>
</head>
<body>${html}</body>
</html>`;

  // Screenshot via Playwright
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: spec.renderMeta.w, height: spec.renderMeta.h, deviceScaleFactor: 1 });
    await page.setContent(page_html, { waitUntil: "domcontentloaded" });

    // Auto-shrink headlines until they fit within their overflow:hidden ancestor
    await page.evaluate(() => {
      function getClipAncestor(el: Element): Element {
        let node = el.parentElement;
        while (node) {
          const s = getComputedStyle(node);
          if (s.overflow === "hidden" || s.overflowY === "hidden") return node;
          node = node.parentElement;
        }
        return document.body;
      }
      document.querySelectorAll<HTMLElement>("[data-fit-headline]").forEach((el) => {
        el.style.wordBreak = "normal";
        el.style.overflowWrap = "normal";
        const clip = getClipAncestor(el);
        const clipBottom = clip.getBoundingClientRect().bottom;
        const minFs = 12;
        const maxFs = parseFloat(getComputedStyle(el).fontSize);
        const overflows = () =>
          el.getBoundingClientRect().bottom > clipBottom || el.scrollWidth > el.offsetWidth;
        if (!overflows()) return; // already fits — skip
        let lo = minFs, hi = maxFs;
        while (lo < hi - 1) {
          const mid = Math.round((lo + hi) / 2);
          el.style.fontSize = `${mid}px`;
          if (overflows()) hi = mid; else lo = mid;
        }
        el.style.fontSize = `${lo}px`;
      });
    });

    // Settle: wait two animation frames so the browser repaints after font-fit changes
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

    const pngBuffer = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: spec.renderMeta.w, height: spec.renderMeta.h } });

    const renderResultId = newId("rr");
    const pngUrl = await save("generated", `${renderResultId}.png`, Buffer.from(pngBuffer));
    return { pngUrl, renderResultId };
  } finally {
    await page.close();
  }
}

async function getImageInfo(imageId: string): Promise<{ filename: string; url: string }> {
  const { getImage } = await import("@/lib/db");
  const img = await getImage(imageId);
  if (!img) throw new Error(`Image "${imageId}" not found`);
  return { filename: img.filename, url: img.url };
}
