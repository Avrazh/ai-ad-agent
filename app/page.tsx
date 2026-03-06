"use client";

import { useState, useRef, useCallback, useEffect, type CSSProperties } from "react";

type RenderResultItem = {
  id: string;
  adSpecId: string;
  imageId: string;
  familyId: string;
  templateId: string;
  primarySlotId: string;
  format: string;
  pngUrl: string;
  approved: boolean;
  createdAt: string;
};

type FamilyId = "testimonial" | "minimal" | "luxury" | "ai";

type SurpriseLayout =
  | "top_bottom" | "split_left" | "split_right" | "full_overlay"
  | "bottom_bar" | "color_block" | "frame_overlay" | "magazine";

type SurpriseSpec = {
  layout: SurpriseLayout;
  bgColor: string; textColor: string; accentColor: string;
  overlayOpacity: number;
  font: "serif" | "sans" | "bebas";
  fontWeight: 300 | 400 | 700 | 900;
  letterSpacingKey: "tight" | "normal" | "wide" | "ultra";
  textTransform: "none" | "uppercase";
  textAlign: "left" | "center" | "right";
  headlineScale: "small" | "medium" | "large" | "huge";
  accent: "line" | "bar" | "dot" | "circle" | "none";
  preferredHeadlineLength?: "short" | "medium" | "long";
  en: { headline: string; subtext: string };
  de: { headline: string; subtext: string };
};

// Miniature preview shown on hover for each layout pill
function LayoutThumb({ p, previewUrl }: { p: (typeof LAYOUT_PREVIEWS)[0]; previewUrl?: string }) {
  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={p.label}
        style={{ width: 192, height: 240, objectFit: "cover", borderRadius: 10, flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}
      />
    );
  }
  const bg  = p.spec.bgColor;
  const tc  = p.spec.textColor;
  const ac  = p.spec.accentColor;
  const IMG = "#9CA3AF"; // neutral gray = placeholder image zone

  const base: CSSProperties = {
    width: 192, height: 240, overflow: "hidden", borderRadius: 10, flexShrink: 0,
    boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
  };

  const Lines = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px" }}>
      <div style={{ height: 9, background: tc, opacity: 0.85, borderRadius: 3, width: "75%" }} />
      <div style={{ height: 5, background: tc, opacity: 0.4,  borderRadius: 3, width: "55%" }} />
    </div>
  );

  const { layout } = p;

  if (layout === "top_bottom") return (
    <div style={{ ...base, display: "flex", flexDirection: "column" }}>
      <div style={{ height: "60%", background: IMG }} />
      <div style={{ height: "40%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
    </div>
  );
  if (layout === "split_left") return (
    <div style={{ ...base, display: "flex", flexDirection: "row" }}>
      <div style={{ width: "55%", background: IMG }} />
      <div style={{ width: "45%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
    </div>
  );
  if (layout === "split_right") return (
    <div style={{ ...base, display: "flex", flexDirection: "row" }}>
      <div style={{ width: "45%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
      <div style={{ width: "55%", background: IMG }} />
    </div>
  );
  if (layout === "full_overlay") return (
    <div style={{ ...base, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: IMG }} />
      <div style={{ position: "absolute", inset: 0, background: bg, opacity: 0.55 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}><Lines /></div>
    </div>
  );
  if (layout === "bottom_bar") return (
    <div style={{ ...base, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: IMG }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "27%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
    </div>
  );
  if (layout === "color_block") return (
    <div style={{ ...base, display: "flex", flexDirection: "row" }}>
      <div style={{ width: "55%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
      <div style={{ width: "45%", background: IMG }} />
    </div>
  );
  if (layout === "frame_overlay") return (
    <div style={{ ...base, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: IMG }} />
      <div style={{ position: "absolute", inset: 10, border: `3px solid ${ac}`, borderRadius: 4, display: "flex", alignItems: "flex-start" }}><Lines /></div>
    </div>
  );
  // magazine (default)
  return (
    <div style={{ ...base, display: "flex", flexDirection: "column" }}>
      <div style={{ height: "45%", background: IMG }} />
      <div style={{ height: "55%", background: bg, display: "flex", alignItems: "center" }}><Lines /></div>
    </div>
  );
}

// Test layout previews — one per layout type with distinct default aesthetics
const LAYOUT_PREVIEWS: { layout: SurpriseLayout; label: string; spec: SurpriseSpec }[] = [
  {
    layout: "top_bottom", label: "Top / Bottom",
    spec: { layout: "top_bottom", bgColor: "#0D0D0D", textColor: "#F5F0E8", accentColor: "#F5F0E8", overlayOpacity: 0.6, font: "serif", fontWeight: 700, letterSpacingKey: "wide", textTransform: "none", textAlign: "left", headlineScale: "large", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "split_left", label: "Split Left",
    spec: { layout: "split_left", bgColor: "#1034FF", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.6, font: "bebas", fontWeight: 900, letterSpacingKey: "wide", textTransform: "uppercase", textAlign: "left", headlineScale: "huge", accent: "bar", preferredHeadlineLength: "short", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "split_right", label: "Split Right",
    spec: { layout: "split_right", bgColor: "#F5EDD6", textColor: "#2A1F14", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 400, letterSpacingKey: "ultra", textTransform: "none", textAlign: "right", headlineScale: "large", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "full_overlay", label: "Full Overlay",
    spec: { layout: "full_overlay", bgColor: "#000000", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.55, font: "sans", fontWeight: 400, letterSpacingKey: "normal", textTransform: "none", textAlign: "left", headlineScale: "large", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "bottom_bar", label: "Bottom Bar",
    spec: { layout: "bottom_bar", bgColor: "#CC0022", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.6, font: "bebas", fontWeight: 900, letterSpacingKey: "tight", textTransform: "uppercase", textAlign: "center", headlineScale: "huge", accent: "none", preferredHeadlineLength: "short", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "color_block", label: "Color Block",
    spec: { layout: "color_block", bgColor: "#D4FF00", textColor: "#000000", accentColor: "#000000", overlayOpacity: 0.6, font: "bebas", fontWeight: 900, letterSpacingKey: "wide", textTransform: "uppercase", textAlign: "left", headlineScale: "huge", accent: "bar", preferredHeadlineLength: "short", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "frame_overlay", label: "Frame",
    spec: { layout: "frame_overlay", bgColor: "#0D0D0D", textColor: "#F5F0E8", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 300, letterSpacingKey: "ultra", textTransform: "none", textAlign: "left", headlineScale: "medium", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "magazine", label: "Magazine",
    spec: { layout: "magazine", bgColor: "#F5EDD6", textColor: "#2A1F14", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 700, letterSpacingKey: "normal", textTransform: "none", textAlign: "left", headlineScale: "large", accent: "dot", preferredHeadlineLength: "long", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
];
type Language = "en" | "de" | "fr" | "es";
type Format = "4:5" | "1:1" | "9:16";


type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  imageId?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  status: "idle" | "uploading" | "analyzing" | "analyzed" | "generating" | "done" | "error";
  result?: RenderResultItem;
  usedFamilyId?: FamilyId;
  approved: boolean;
  error?: string;
};

const FAMILY_LABELS: Record<FamilyId, string> = {
  testimonial: "Testimonial",
  minimal: "Minimal",
  luxury: "Luxury",
  ai: "AI Style",
};

const ALL_TEMPLATES: { familyId: FamilyId; templateId: string; label: string }[] = [
  { familyId: "testimonial", templateId: "quote_card",             label: "Quote" },
  { familyId: "testimonial", templateId: "star_review",            label: "Stars" },
  { familyId: "luxury",      templateId: "luxury_editorial_left",  label: "Editorial" },
  { familyId: "luxury",      templateId: "luxury_soft_frame_open", label: "Frame Open" },
];

const FAMILIES_IN_ORDER: FamilyId[] = ["testimonial", "luxury"];

let _itemCounter = 0;
function newItemId() {
  return `qi-${++_itemCounter}`;
}

// Resize + re-encode image to JPEG before upload to stay under the
// Vercel 4.5 MB serverless function payload limit.
const MAX_UPLOAD_PX = 1920; // longest side in pixels
const JPEG_QUALITY = 0.85;
const IMAGE_LIMIT = 2; // beta: max images per session

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_UPLOAD_PX || h > MAX_UPLOAD_PX) {
        if (w >= h) { h = Math.round((h * MAX_UPLOAD_PX) / w); w = MAX_UPLOAD_PX; }
        else        { w = Math.round((w * MAX_UPLOAD_PX) / h); h = MAX_UPLOAD_PX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

function StatusIcon({ status }: { status: QueueItem["status"] }) {
  if (status === "done")
    return (
      <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === "error")
    return (
      <svg className="h-3.5 w-3.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  if (status === "uploading" || status === "analyzing" || status === "generating")
    return <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />;
  if (status === "analyzed")
    return <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-indigo-400/60" />;
  return <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />;
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [selectedFormat, setSelectedFormat] = useState<Format>("4:5");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeLayout, setActiveLayout] = useState<SurpriseLayout | null>(null);
  const [hoveredLayout, setHoveredLayout] = useState<SurpriseLayout | null>(null);
  const [layoutPreviewsMap, setLayoutPreviewsMap] = useState<Record<string, Partial<Record<SurpriseLayout, string>>>>({});
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [templatePreviewsMap, setTemplatePreviewsMap] = useState<Record<string, Partial<Record<string, string>>>>({});
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const usedStyleIdsRef = useRef<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirror queue + selectedItemId in refs so callbacks can read latest values
  // without being declared after derived variables that depend on state.
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;
  const selectedItemIdRef = useRef<string | null>(null);
  selectedItemIdRef.current = selectedItemId;

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // Auto-select first done item when nothing is selected
  const statusKey = queue.map((i) => i.status).join(",");
  useEffect(() => {
    setQueue((prev) => {
      const hasSelection = prev.some((i) => i.id === selectedItemId);
      if (!hasSelection) {
        const first = prev.find((i) => i.status === "done");
        if (first) setSelectedItemId(first.id);
      }
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);


  // ── Server-side cleanup ─────────────────────────────────
  // Deletes uploaded images + generated PNGs from storage, and clears DB records.
  // Runs fire-and-forget; UI reset happens immediately regardless of outcome.
  const clearServerData = useCallback(() => {
    fetch("/api/clear", { method: "POST" })
      .catch(() => { /* silent — best-effort cleanup */ });
  }, []);

  // ── File handling ───────────────────────────────────────
  const [limitApplied, setLimitApplied] = useState(false);

  const handleFiles = useCallback((files: FileList) => {
    const allImageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (allImageFiles.length === 0) return;

    const imageFiles = allImageFiles.slice(0, IMAGE_LIMIT);
    setLimitApplied(allImageFiles.length > IMAGE_LIMIT);

    clearServerData();
    setQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    usedStyleIdsRef.current = [];
    setSelectedItemId(null);

    setQueue(
      imageFiles.map((file) => ({
        id: newItemId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "idle",
        approved: false,
      }))
    );
  }, [clearServerData]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // ── Generate All ────────────────────────────────────────

  const BATCH_FAMILIES: FamilyId[] = ["testimonial", "luxury"];

  const handleGenerateAll = useCallback(async () => {
    if (processing) return;
    const itemsToProcess = queue.filter((item) => item.status === "idle");
    if (itemsToProcess.length === 0) return;

    setProcessing(true);

    for (const item of itemsToProcess) {
      try {
        // Step 1 — upload
        updateItem(item.id, { status: "uploading" });
        const compressed = await compressImage(item.file);
        const form = new FormData();
        form.append("file", compressed, item.file.name.replace(/\.[^.]+$/, ".jpg"));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const d = await uploadRes.json();
          throw new Error(d.error || "Upload failed");
        }
        const uploaded = await uploadRes.json();

        // Step 2 — AI analysis (safe zones + copy pool, no rendering)
        updateItem(item.id, {
          status: "analyzing",
          imageId: uploaded.imageId,
          imageUrl: uploaded.url,
          imageWidth: uploaded.width,
          imageHeight: uploaded.height,
        });

        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: uploaded.imageId,
            imageUrl: uploaded.url,
            imageWidth: uploaded.width,
            imageHeight: uploaded.height,
          }),
        });
        if (!analyzeRes.ok) {
          const d = await analyzeRes.json();
          throw new Error(d.error || "Analysis failed");
        }

        updateItem(item.id, { status: "analyzed" });
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    setProcessing(false);
  }, [processing, queue, updateItem]);

  // ── Re-render: shared by style/lang/format changes ──────
  // Always pass explicit lang+format so React state timing is never an issue.
  const handleRerender = useCallback(
    async (
      item: QueueItem,
      templateId: string,
      lang: Language,
      format: Format
    ) => {
      if (!item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            imageWidth: item.imageWidth,
            imageHeight: item.imageHeight,
            forceTemplateId: templateId,
            autoFamily: false,
            lang,
            format,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Re-render failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];

        usedStyleIdsRef.current = [
          ...usedStyleIdsRef.current.filter((s) => s !== item.result?.templateId),
          result.templateId,
        ];
        updateItem(item.id, {
          result,
          approved: false,
          usedFamilyId: result.familyId as FamilyId,
        });
      } catch (err) {
        console.error("Re-render error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );

  // ── Surprise Me — Claude generates full SVG ad (no Satori, no predefined layout) ──
  const handleSurpriseMe = useCallback(
    async (item: QueueItem) => {
      if (!item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/surprise-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            lang: selectedLang,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Surprise Me failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        updateItem(item.id, { result, approved: false, usedFamilyId: "ai" as FamilyId });
      } catch (err) {
        console.error("Surprise Me error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem, selectedLang]
  );


  // ── Preview a specific layout — no AI call, fixed spec ──
  const handlePreviewLayout = useCallback(
    async (item: QueueItem, spec: SurpriseSpec) => {
      if (!item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            imageWidth: item.imageWidth,
            imageHeight: item.imageHeight,
            forceSurpriseSpec: spec,
            lang: selectedLang,
            format: selectedFormat,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Preview layout failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        updateItem(item.id, { result, approved: false, usedFamilyId: "ai" as FamilyId });
        setActiveLayout(spec.layout);
      } catch (err) {
        console.error("Preview layout error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem, selectedLang, selectedFormat]
  );

  // Generate a real rendered ad for every layout using the current image — no AI call
  const handleGenerateLayoutPreviews = useCallback(
    async (item: QueueItem) => {
      if (!item.imageId) return;
      const imageId = item.imageId;
      await Promise.allSettled(
        LAYOUT_PREVIEWS.map(async (p) => {
          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageId: item.imageId,
                imageUrl: item.imageUrl,
                imageWidth: item.imageWidth,
                imageHeight: item.imageHeight,
                forceSurpriseSpec: p.spec,
                lang: selectedLang,
                format: selectedFormat,
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const pngUrl: string | undefined = data.results?.[0]?.pngUrl;
            if (pngUrl) setLayoutPreviewsMap(prev => ({
              ...prev,
              [imageId]: { ...prev[imageId], [p.layout]: pngUrl },
            }));
          } catch { /* skip failed layout, continue */ }
        })
      );
    },
    [selectedLang, selectedFormat]
  );

  const handleGenerateTemplatePreviews = useCallback(
    async (item: QueueItem) => {
      if (!item.imageId) return;
      const imageId = item.imageId;
      await Promise.allSettled(
        ALL_TEMPLATES.map(async (t) => {
          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageId: item.imageId,
                imageUrl: item.imageUrl,
                imageWidth: item.imageWidth,
                imageHeight: item.imageHeight,
                forceTemplateId: t.templateId,
                lang: selectedLang,
                format: selectedFormat,
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const pngUrl: string | undefined = data.results?.[0]?.pngUrl;
            if (pngUrl) setTemplatePreviewsMap(prev => ({
              ...prev,
              [imageId]: { ...prev[imageId], [t.templateId]: pngUrl },
            }));
          } catch { /* skip */ }
        })
      );
    },
    [selectedLang, selectedFormat]
  );

  // Auto-generate layout + template previews when selected item gets an imageId (or switches to a new image).
  // Previews are cached per imageId — switching images never re-generates already-cached previews.
  useEffect(() => {
    const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
    if (!item?.imageId) return;
    const imageId = item.imageId;
    // Skip if we already have previews cached for this image
    const hasLayoutPreviews = Object.keys(layoutPreviewsMap[imageId] ?? {}).length > 0;
    const hasTemplatePreviews = Object.keys(templatePreviewsMap[imageId] ?? {}).length > 0;
    if (hasLayoutPreviews && hasTemplatePreviews) return;
    if (!hasLayoutPreviews) handleGenerateLayoutPreviews(item);
    if (!hasTemplatePreviews) handleGenerateTemplatePreviews(item);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, queue]);


  // Convenience wrappers used by the three control types in the detail panel
  const handleStyleChange = useCallback(
    (item: QueueItem, templateId: string) =>
      handleRerender(item, templateId, selectedLang, selectedFormat),
    [handleRerender, selectedLang, selectedFormat]
  );

  // Shared helper: re-render existing ad via /api/switch (preserves headline, no AI call)
  const handleSwitch = useCallback(
    async (item: QueueItem, lang: Language, format: Format) => {
      if (!item.result || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultIds: [item.result.id], lang, format }),
        });
        if (!res.ok) throw new Error("Switch failed");
        const data = await res.json();
        const switched = data.results?.[0];
        if (switched?.result) {
          updateItem(item.id, { result: switched.result, approved: false });
        }
      } catch (err) {
        console.error("Switch error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );

  const handleLangChange = useCallback(
    (lang: Language) => {
      setSelectedLang(lang);
      const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
      if (item?.result) {
        handleSwitch(item, lang, selectedFormat);
      }
    },
    [handleSwitch, selectedFormat]
  );

  const handleFormatChange = useCallback(
    (format: Format) => {
      setSelectedFormat(format);
      const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
      if (item?.result) {
        handleSwitch(item, selectedLang, format);
      }
    },
    [handleSwitch, selectedLang]
  );

  // ── New headline ────────────────────────────────────────
  const handleNewHeadline = useCallback(
    async (item: QueueItem) => {
      if (!item.result || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId: item.result.id, mode: "headline" }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Regeneration failed");
        }
        const data = await res.json();
        updateItem(item.id, { result: data.result, approved: false });
      } catch (err) {
        console.error("New headline error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );

  // ── Approve ─────────────────────────────────────────────
  const handleApprove = useCallback(
    async (itemId: string, resultId: string, approved: boolean) => {
      try {
        await fetch("/api/approve", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId, approved }),
        });
        updateItem(itemId, { approved });
      } catch {
        // silent
      }
    },
    [updateItem]
  );

  // ── Download ────────────────────────────────────────────
  const handleDownload = useCallback(async (pngUrl: string, id: string) => {
    try {
      const res = await fetch(pngUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ad-${id}.png`;
      // Must be in the DOM for Firefox/Safari to trigger the download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revocation so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const approved = queue.filter((item) => item.approved && item.result);
    for (let i = 0; i < approved.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 200));
      const item = approved[i];
      if (item.result) handleDownload(item.result.pngUrl, item.result.id);
    }
  }, [queue, handleDownload]);

  async function handleSendFeedback() {
    if (!feedbackText.trim() || feedbackBusy) return;
    setFeedbackBusy(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: feedbackText.trim(),
          imageId: selectedItem?.imageId,
          templateId: selectedItem?.result?.templateId,
        }),
      });
    } finally {
      setFeedbackSent(true);
      setFeedbackBusy(false);
      setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackText("");
        setFeedbackSent(false);
      }, 1500);
    }
  }

  // ── Derived ─────────────────────────────────────────────
  const approvedCount = queue.filter((item) => item.approved).length;
  const idleCount = queue.filter((item) => item.status === "idle").length;
  const activeIndex = queue.findIndex(
    (item) => item.status === "uploading" || item.status === "analyzing" || item.status === "generating"
  );
  // Only show rows that have started processing (hide idle ones)
  const visibleQueueItems = queue.filter((item) => item.status !== "idle");

  const selectedItem = queue.find((item) => item.id === selectedItemId) ?? null;
  const selectedIdx = selectedItem ? queue.indexOf(selectedItem) : -1;
  const prevItem = selectedIdx > 0 ? queue[selectedIdx - 1] : null;
  const nextItem =
    selectedIdx >= 0 && selectedIdx < queue.length - 1
      ? queue[selectedIdx + 1]
      : null;

  const pillActive =
    "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.12)]";
  const pillInactive =
    "bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300";

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] text-white">

      {/* ════ LEFT PANEL ════════════════════════════════ */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-white/[0.06] overflow-hidden">

        {/* Title */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <h1 className="text-base font-bold text-white tracking-tight">AI Ad Agent</h1>
          <p className="text-[11px] text-gray-600 mt-0.5">
            AI picks best template · visual diversity guaranteed
          </p>
        </div>

        {/* Drop zone — always visible, Choose Folder inside */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={
            "shrink-0 mx-4 mt-3 rounded-xl border border-dashed transition " +
            (queue.length > 0
              ? "border-white/10 bg-white/[0.02] px-4 py-3"
              : "border-white/15 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04] px-4 py-6 cursor-pointer")
          }
          onClick={() => queue.length === 0 && folderInputRef.current?.click()}
        >
          {queue.length > 0 ? (
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-1.5 shrink-0">
                {queue.slice(0, 5).map((item) => (
                  <img
                    key={item.id}
                    src={item.previewUrl}
                    alt=""
                    className="h-6 w-6 rounded object-cover border border-[#0B0F14]"
                  />
                ))}
                {queue.length > 5 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded border border-[#0B0F14] bg-white/10 text-[9px] text-gray-400">
                    +{queue.length - 5}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-1">
                {queue.length} image{queue.length !== 1 ? "s" : ""}
                {limitApplied && (
                  <span className="ml-1.5 text-[10px] text-amber-500/80">· beta limit: first {IMAGE_LIMIT} loaded</span>
                )}
              </span>
              {!processing && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                    className="text-[11px] text-gray-600 hover:text-indigo-400 transition"
                  >
                    Change
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearServerData();
                      setQueue((prev) => {
                        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                        return [];
                      });
                      usedStyleIdsRef.current = [];
                      setSelectedItemId(null);
                    }}
                    className="text-[11px] text-gray-600 hover:text-red-400 transition"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
              <svg
                className="h-7 w-7 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
                />
              </svg>
              <p className="text-xs text-gray-500">
                Drop images or click to choose a folder
              </p>
              <p className="text-[10px] text-gray-600">
                Beta version · max {IMAGE_LIMIT} images
              </p>
            </div>
          )}

          {/* Hidden inputs */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory=""
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* Generate button */}
        <div className="shrink-0 px-4 py-2.5">
          <button
            onClick={handleGenerateAll}
            disabled={processing || idleCount === 0}
            className={
              "w-full rounded-xl py-2.5 text-sm font-semibold transition " +
              (processing || idleCount === 0
                ? "bg-indigo-500/15 text-indigo-400/50 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.25)]")
            }
          >
            {processing ? (
              `Analyzing ${activeIndex + 1} of ${queue.length}...`
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>{idleCount > 0 ? `Analyze All (${idleCount})` : "Analyze All"}</span>
                <span className="text-[10px] font-normal opacity-60">1 credit / image</span>
              </span>
            )}
          </button>
        </div>

        {/* Queue list — only shows items that have started processing */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {visibleQueueItems.length > 0 && (
            <div>
              {visibleQueueItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-2 " +
                    (selectedItemId === item.id
                      ? "bg-indigo-500/[0.08] border-indigo-500/60"
                      : "hover:bg-white/[0.03] border-transparent")
                  }
                >
                  <StatusIcon status={item.status} />
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-9 w-9 rounded object-cover shrink-0 border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] text-gray-300 leading-tight">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      {item.status === "uploading" && (
                        <span className="text-indigo-400">Uploading...</span>
                      )}
                      {item.status === "analyzing" && (
                        <span className="text-indigo-400">Analyzing...</span>
                      )}
                      {item.status === "generating" && (
                        <span className="text-indigo-400">Generating...</span>
                      )}
                      {item.status === "analyzed" && !item.result && (
                        <span className="text-indigo-300/60">Ready · pick a style</span>
                      )}
                      {item.status === "error" && (
                        <span className="text-red-400 truncate block">
                          {item.error ?? "Error"}
                        </span>
                      )}
                      {item.status === "done" && item.result && (
                        <span className="text-gray-600">
                          {FAMILY_LABELS[
                            item.usedFamilyId ??
                              (item.result.familyId as FamilyId)
                          ] ?? item.result.familyId}{" "}
                          · {item.result.format}
                        </span>
                      )}
                      {item.status === "analyzed" && item.result && (
                        <span className="text-gray-600">
                          {FAMILY_LABELS[
                            item.usedFamilyId ??
                              (item.result.familyId as FamilyId)
                          ] ?? item.result.familyId}{" "}
                          · {item.result.format}
                        </span>
                      )}
                    </p>
                  </div>
                  {item.approved && (
                    <svg
                      className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Feedback button — pinned to sidebar bottom ─── */}
        <div className="shrink-0 border-t border-white/[0.06] flex justify-end px-4 py-3">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-1.5 text-[11px] text-gray-600 transition hover:text-gray-400"
          >
            💬 Leave feedback
          </button>
        </div>
      </div>

      {/* ── Download All Approved — fixed top-right ─────── */}
      {approvedCount > 0 && !processing && (
        <button
          onClick={handleDownloadAll}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:from-indigo-400 hover:to-violet-400 transition"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          Download All Approved ({approvedCount})
        </button>
      )}

      {/* ════ RIGHT PANEL — Detail View ═════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedItem ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
                <svg
                  className="h-7 w-7 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M3.75 12V6.75A2.25 2.25 0 016 4.5h12A2.25 2.25 0 0120.25 6.75V12"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Select an image from the queue to preview</p>
              <p className="text-[11px] text-gray-700 mt-1">Generate ads first, then click any row</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Filename bar */}
            <div className="shrink-0 px-6 py-3.5 border-b border-white/[0.06] text-center">
              <p className="text-sm font-medium text-gray-200 truncate">
                {selectedItem.file.name}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {selectedIdx + 1} of {queue.length}
              </p>
            </div>

            {/* Main content */}
            {(selectedItem.status === "done" || selectedItem.status === "analyzed") && selectedItem.imageId ? (
              <div className="flex-1 flex overflow-hidden">

                {/* Working area — left column: image + action bar */}
                <div className="flex-1 flex flex-col overflow-hidden">

                  {/* Ad image — fills all available vertical space */}
                  <div className="flex-1 flex items-center justify-center p-2 overflow-hidden relative">
                    {selectedItem.result ? (
                    <img
                      src={selectedItem.result.pngUrl}
                      alt="Generated ad"
                      className={
                        "max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl transition-opacity duration-200 " +
                        (detailLoading ? "opacity-30" : "opacity-100")
                      }
                    />
                    ) : (
                      <img
                        src={selectedItem.previewUrl}
                        alt=""
                        className="max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl opacity-60"
                        style={{
                          aspectRatio: selectedFormat === "1:1" ? "1/1" : selectedFormat === "9:16" ? "9/16" : "4/5",
                        }}
                      />
                    )}
                    {detailLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                      </div>
                    )}

                    {/* Prev arrow — left edge */}
                    {prevItem && (
                      <button
                        onClick={() => setSelectedItemId(prevItem.id)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-gray-300 backdrop-blur-sm hover:bg-black/70 hover:text-white transition"
                        title="Previous image"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}

                    {/* Next arrow — right edge */}
                    {nextItem && (
                      <button
                        onClick={() => setSelectedItemId(nextItem.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-gray-300 backdrop-blur-sm hover:bg-black/70 hover:text-white transition"
                        title="Next image"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Action bar — 3 main actions pinned below the image */}
                  {selectedItem.result && (
                    <div className="shrink-0 border-t border-white/[0.06] px-6 py-3 flex items-center gap-3">
                      {selectedItem.result.templateId !== "ai_surprise_svg" && (
                        <button
                          onClick={() => handleNewHeadline(selectedItem)}
                          disabled={detailLoading}
                          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm text-gray-300 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          New Headline
                        </button>
                      )}
                      <button
                        onClick={() => handleApprove(selectedItem.id, selectedItem.result!.id, !selectedItem.approved)}
                        disabled={detailLoading}
                        className={
                          "flex-1 rounded-xl border py-3 text-sm font-medium transition disabled:opacity-40 flex items-center justify-center gap-2 " +
                          (selectedItem.approved
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-emerald-500/30 hover:text-emerald-400")
                        }
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {selectedItem.approved ? "Approved" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleDownload(selectedItem.result!.pngUrl, selectedItem.result!.id)}
                        className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm text-gray-400 hover:bg-white/[0.08] hover:text-white transition flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                        </svg>
                        Download
                      </button>
                    </div>
                  )}
                </div>

                {/* Controls sidebar — right column: style + format picker */}
                <div className="w-[240px] shrink-0 flex flex-col border-l border-white/[0.06] overflow-y-auto">
                  <div className="p-5 space-y-5">
                    {/* SVG Surprise results are final — no lang/format/headline controls */}
                    {(() => { const _isSVGSurprise = selectedItem.result?.templateId === "ai_surprise_svg"; return _isSVGSurprise ? (
                      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 text-center">
                        <p className="text-xs font-semibold text-indigo-300">✨ AI Creative · 9:16</p>
                        <p className="mt-1 text-[11px] text-gray-500">Unique ad generated by Claude.<br />Approve or download below.</p>
                      </div>
                    ) : null; })()}

                    {/* Lang + Format — hidden for SVG surprise results (they are final, 9:16 only) */}
                    {selectedItem.result?.templateId !== "ai_surprise_svg" && (
                      <>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                            Language
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(["en", "de", "fr", "es"] as Language[]).map((l) => {
                              const active = ["en", "de"].includes(l);
                              return (
                                <button
                                  key={l}
                                  onClick={() => active && handleLangChange(l)}
                                  disabled={!active || detailLoading}
                                  title={active ? undefined : "Coming soon"}
                                  className={
                                    "rounded px-3 py-1.5 text-xs font-medium border transition " +
                                    (!active
                                      ? "opacity-30 cursor-not-allowed border-white/5 text-gray-600"
                                      : "disabled:opacity-40 " + (selectedLang === l ? pillActive : pillInactive))
                                  }
                                >
                                  {l.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                            Format
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(["4:5", "1:1", "9:16"] as Format[]).map((f) => (
                              <button
                                key={f}
                                onClick={() => handleFormatChange(f)}
                                disabled={detailLoading}
                                className={
                                  "rounded px-3 py-1.5 text-xs font-medium border transition disabled:opacity-40 " +
                                  (selectedFormat === f ? pillActive : pillInactive)
                                }
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-white/[0.06]" />
                      </>
                    )}

                    {/* Layout picker */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                        Layouts
                      </p>
                      {FAMILIES_IN_ORDER.map((familyId) => {
                        const familyTemplates = ALL_TEMPLATES.filter(
                          (t) => t.familyId === familyId
                        );
                        return (
                          <div key={familyId} className="space-y-1.5">
                            <p className="text-[11px] text-gray-600">
                              {FAMILY_LABELS[familyId]}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {familyTemplates.map((t) => (
                                <button
                                  key={t.templateId}
                                  onClick={() =>
                                    handleStyleChange(selectedItem, t.templateId)
                                  }
                                  disabled={detailLoading}
                                  onMouseEnter={() => setHoveredTemplate(t.templateId)}
                                  onMouseLeave={() => setHoveredTemplate(null)}
                                  className={
                                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 " +
                                    (selectedItem.result?.templateId === t.templateId
                                      ? pillActive
                                      : pillInactive)
                                  }
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {/* Other — layout pills, same style as family rows */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-gray-600">Other</p>
                        <div className="flex flex-wrap gap-1.5">
                          {LAYOUT_PREVIEWS.map((p) => (
                            <button
                              key={p.layout}
                              onClick={() => handlePreviewLayout(selectedItem, p.spec)}
                              disabled={detailLoading || !selectedItem.imageId}
                              onMouseEnter={() => setHoveredLayout(p.layout)}
                              onMouseLeave={() => setHoveredLayout(null)}
                              className={"rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 " + (activeLayout === p.layout && selectedItem.result?.templateId === "ai_surprise" ? pillActive : hoveredLayout === p.layout ? "border-white/30 bg-white/10 text-white" : pillInactive)}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* AI — Surprise Me */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-gray-600">AI</p>
                      <button
                        onClick={() => handleSurpriseMe(selectedItem)}
                        disabled={detailLoading || !selectedItem.imageId}
                        className="w-full rounded-lg border border-indigo-500/20 bg-indigo-500/10 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition disabled:opacity-40"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span>✨ Surprise Me</span>
                          <span className="text-[10px] font-normal opacity-50">1 credit</span>
                        </span>
                      </button>
                    </div>
                    {/* Thumbnail preview — static container so buttons don't shift */}
                    <div className="flex flex-col items-center gap-2" style={{ height: 264 }}>
                      {hoveredTemplate && templatePreviewsMap[selectedItem.imageId ?? ""]?.[hoveredTemplate] ? (
                        <>
                          <img
                            src={templatePreviewsMap[selectedItem.imageId ?? ""]![hoveredTemplate]!}
                            alt={hoveredTemplate}
                            style={{ width: 192, height: 240, objectFit: "cover", borderRadius: 10, flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.6)" }}
                          />
                          <p className="text-[10px] text-gray-500">
                            {ALL_TEMPLATES.find(t => t.templateId === hoveredTemplate)?.label}
                          </p>
                        </>
                      ) : hoveredLayout ? (() => {
                        const prev = LAYOUT_PREVIEWS.find(lp => lp.layout === hoveredLayout);
                        const previewUrl = layoutPreviewsMap[selectedItem.imageId ?? ""]?.[hoveredLayout];
                        return prev ? (
                          <>
                            <LayoutThumb p={prev} previewUrl={previewUrl} />
                            <p className="text-[10px] text-gray-500">{prev.label}</p>
                          </>
                        ) : null;
                      })() : null}
                    </div>


                  </div>
                </div>
              </div>
            ) : selectedItem.status === "error" ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <svg className="h-10 w-10 text-red-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-400">{selectedItem.error ?? "Generation failed"}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <p className="text-sm text-gray-600">
                  {selectedItem.status === "uploading"
                    ? "Uploading..."
                    : selectedItem.status === "analyzing"
                      ? "Analyzing..."
                      : selectedItem.status === "generating"
                        ? "Generating..."
                        : "Waiting to start..."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Developer Feedback Modal ─────────────────────── */}
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setFeedbackOpen(false)}
        >
          <div className="w-[420px] rounded-2xl bg-[#1a1a1a] border border-white/[0.08] p-6 flex flex-col gap-4 shadow-2xl">
            <p className="text-sm font-medium text-white">Leave feedback to developer</p>
            {feedbackSent ? (
              <p className="py-4 text-center text-sm text-green-400">Thanks! Feedback sent ✓</p>
            ) : (
              <>
                <textarea
                  autoFocus
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSendFeedback();
                  }}
                  placeholder="Bug report or improvement idea..."
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#111] p-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500/50 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setFeedbackOpen(false)}
                    className="text-xs text-gray-500 transition hover:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendFeedback}
                    disabled={!feedbackText.trim() || feedbackBusy}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {feedbackBusy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
