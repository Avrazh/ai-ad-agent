import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "previews");
const LAYOUT_SPECS = [
  { layout: "split_right",   spec: { layout: "split_right",   bgColor: "#F5EDD6", textColor: "#2A1F14", accentColor: "#C8A96E", overlayOpacity: 0.6,  font: "serif", fontWeight: 400, letterSpacingKey: "ultra",  textTransform: "none",      textAlign: "right",  headlineScale: "large",  accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } } },
  { layout: "full_overlay",  spec: { layout: "full_overlay",  bgColor: "#000000", textColor: "#FFFFFF",  accentColor: "#FFFFFF",  overlayOpacity: 0.55, font: "sans",  fontWeight: 400, letterSpacingKey: "normal", textTransform: "none",      textAlign: "left",   headlineScale: "large",  accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } } },
  { layout: "bottom_bar",    spec: { layout: "bottom_bar",    bgColor: "#1A1A1A", textColor: "#FFFFFF",  accentColor: "#FFFFFF",  overlayOpacity: 0.6,  font: "bebas", fontWeight: 900, letterSpacingKey: "tight",  textTransform: "uppercase", textAlign: "center", headlineScale: "huge",   accent: "none", preferredHeadlineLength: "short",  en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } } },
  { layout: "frame_overlay", spec: { layout: "frame_overlay", bgColor: "#0D0D0D", textColor: "#F5F0E8", accentColor: "#C8A96E",  overlayOpacity: 0.6,  font: "serif", fontWeight: 300, letterSpacingKey: "ultra",  textTransform: "none",      textAlign: "left",   headlineScale: "medium", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } } },
  { layout: "postcard",      spec: { layout: "postcard",      bgColor: "#F2EFE9", textColor: "#141414",  accentColor: "#141414",  overlayOpacity: 0.45, font: "serif", fontWeight: 700, letterSpacingKey: "tight",  textTransform: "none",      textAlign: "left",   headlineScale: "medium", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } } },
  { layout: "vertical_text",  spec: { layout: "vertical_text",  bgColor: "#FFFFFF", textColor: "#1A1A1A",  accentColor: "#1A1A1A",  overlayOpacity: 0,    font: "bebas", fontWeight: 400, letterSpacingKey: "normal", textTransform: "uppercase", textAlign: "left",   headlineScale: "medium", accent: "none", preferredHeadlineLength: "short",  en: { headline: "GLOW",    subtext: "Collection" }, de: { headline: "GLANZ",    subtext: "Kollektion" } } },
  { layout: "clean_headline", spec: { layout: "clean_headline", bgColor: "#000000", textColor: "#1a1a1a",  accentColor: "#1a1a1a",  overlayOpacity: 0,    font: "serif", fontWeight: 400, letterSpacingKey: "normal", textTransform: "none",      textAlign: "center", headlineScale: "large",  accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "" },        de: { headline: "Vorschau", subtext: "" } } },
];
const TEMPLATE_IDS = ["quote_card", "star_review", "luxury_editorial_left", "luxury_soft_frame_open"];

async function jsonPost(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("POST " + url + " => " + res.status + ": " + (await res.text()).slice(0,200));
  return res.json();
}

async function main() {
  const refImagePath = process.argv[2];
  if (!refImagePath) { console.error("Usage: node scripts/generate-previews.mjs <image>"); process.exit(1); }
  const absPath = path.resolve(refImagePath);
  if (!fs.existsSync(absPath)) { console.error("File not found:", absPath); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Reference:", absPath);

  const ext = path.extname(absPath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(absPath)], { type: mime }), path.basename(absPath));
  console.log("Uploading...");
  const upRes = await fetch(BASE_URL + "/api/upload", { method: "POST", body: form });
  if (!upRes.ok) { console.error("Upload failed:", (await upRes.text()).slice(0,200)); process.exit(1); }
  const { imageId, url: imageUrl, width: imageWidth, height: imageHeight } = await upRes.json();
  console.log("Uploaded imageId=" + imageId + " (" + imageWidth + "x" + imageHeight + ")");

  console.log("Analyzing...");
  await jsonPost(BASE_URL + "/api/analyze", { imageId, imageUrl, imageWidth, imageHeight });
  console.log("Analysis done");

  const base = { imageId, imageUrl, imageWidth, imageHeight, lang: "en", format: "9:16" };
  const total = LAYOUT_SPECS.length + TEMPLATE_IDS.length;
  console.log("Rendering " + total + " previews in parallel...");

  await Promise.all([
    ...LAYOUT_SPECS.map(async ({ layout, spec }) => {
      try {
        const data = await jsonPost(BASE_URL + "/api/generate", { ...base, forceSurpriseSpec: spec });
        const pngUrl = data.results?.[0]?.pngUrl;
        if (!pngUrl) { console.warn("  SKIP", layout); return; }
        await downloadTo(pngUrl, path.join(OUT_DIR, layout + ".png"));
        console.log("  OK  ", layout);
      } catch (e) { console.warn("  SKIP", layout, e.message); }
    }),
    ...TEMPLATE_IDS.map(async (templateId) => {
      try {
        const data = await jsonPost(BASE_URL + "/api/generate", { ...base, forceTemplateId: templateId });
        const pngUrl = data.results?.[0]?.pngUrl;
        if (!pngUrl) { console.warn("  SKIP", templateId); return; }
        await downloadTo(pngUrl, path.join(OUT_DIR, templateId + ".png"));
        console.log("  OK  ", templateId);
      } catch (e) { console.warn("  SKIP", templateId, e.message); }
    }),
  ]);
  console.log("Done! Thumbnails in public/previews/");
}

async function downloadTo(url, dest) {
  const fullUrl = url.startsWith("http") ? url : BASE_URL + url;
  const res = await fetch(fullUrl, {});
  if (!res.ok) throw new Error("HTTP " + res.status);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

main().catch(e => {
  if (e && e.cause && e.cause.code === "ECONNREFUSED") {
    console.error("ERROR: Cannot connect — start the dev server: npm run dev");
  } else { console.error(e); }
  process.exit(1);
});
