"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import Link from "next/link";
import { HeadlineDragOverlay } from "@/app/components/HeadlineDragOverlay";
import { LiveAdCanvas } from "@/app/components/LiveAdCanvas";
import { StarCardPreview } from "@/app/components/StarCardPreview";
import { BRAND_NAME } from "@/lib/customerConfig";
import { CropEditor } from "@/app/components/CropEditor";

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
  headlineText?: string;
  headlineFontScale?: number;
  subjectPos?: string;
  headlineYOverride?: number;
  attribution?: string;
  brandNameY?: number;
  brandNameFontScale?: number;
  lang?: string;
};

type FamilyId = "testimonial" | "minimal" | "luxury" | "ai";

type SurpriseLayout =
  | "split_right" | "full_overlay"
  | "bottom_bar" | "frame_overlay" | "postcard"
  | "vertical_text" | "clean_headline";

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
  headlineYOverride?: number;
  en: { headline: string; subtext: string };
  de: { headline: string; subtext: string };
};


// Test layout previews — one per layout type with distinct default aesthetics
const LAYOUT_PREVIEWS: { layout: SurpriseLayout; label: string; spec: SurpriseSpec }[] = [
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
    spec: { layout: "bottom_bar", bgColor: "#1A1A1A", textColor: "#FFFFFF", accentColor: "#FFFFFF", overlayOpacity: 0.6, font: "bebas", fontWeight: 900, letterSpacingKey: "tight", textTransform: "uppercase", textAlign: "center", headlineScale: "huge", accent: "none", preferredHeadlineLength: "short", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "frame_overlay", label: "Frame",
    spec: { layout: "frame_overlay", bgColor: "#0D0D0D", textColor: "#F5F0E8", accentColor: "#C8A96E", overlayOpacity: 0.6, font: "serif", fontWeight: 300, letterSpacingKey: "ultra", textTransform: "none", textAlign: "left", headlineScale: "medium", accent: "line", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "postcard", label: "Postcard",
    spec: { layout: "postcard", bgColor: "#F2EFE9", textColor: "#141414", accentColor: "#141414", overlayOpacity: 0.45, font: "serif", fontWeight: 700, letterSpacingKey: "tight", textTransform: "none", textAlign: "left", headlineScale: "medium", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "Collection" }, de: { headline: "Vorschau", subtext: "Kollektion" } },
  },
  {
    layout: "vertical_text", label: "Letters",
    spec: { layout: "vertical_text", bgColor: "#FFFFFF", textColor: "#1A1A1A", accentColor: "#1A1A1A", overlayOpacity: 0, font: "bebas", fontWeight: 400, letterSpacingKey: "normal", textTransform: "uppercase", textAlign: "left", headlineScale: "medium", accent: "none", preferredHeadlineLength: "short", en: { headline: "GLOW", subtext: "Collection" }, de: { headline: "GLANZ", subtext: "Kollektion" } },
  },
  {
    layout: "clean_headline", label: "Headline",
    spec: { layout: "clean_headline", bgColor: "#000000", textColor: "#ffffff", accentColor: "#ffffff", overlayOpacity: 0, font: "serif", fontWeight: 400, letterSpacingKey: "normal", textTransform: "none", textAlign: "center", headlineScale: "large", accent: "none", preferredHeadlineLength: "medium", en: { headline: "Preview", subtext: "" }, de: { headline: "Vorschau", subtext: "" } },
  },

];
type Language = "en" | "de" | "fr" | "es";
type Format = "9:16";


type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  imageId?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  status: "idle" | "uploading" | "analyzed" | "generating" | "done" | "error";
  result?: RenderResultItem;
  usedFamilyId?: FamilyId;
  usedSurpriseSpec?: SurpriseSpec;
  lang?: Language;
  approved: boolean;
  cropX: number;          // user-chosen horizontal crop center (0-1), default 0.5
  defaultHeadline?: string; // pre-fetched headline shown in CropEditor before first render
  headlineY?: number;       // persisted headline Y position across image switches
  headlineFontScale?: number; // persisted font scale across image switches
  brandNameY?: number;      // persisted brand name Y position across image switches
  brandNameFontScale?: number; // persisted brand name font scale across image switches
  headlineFont?: string;        // user-selected headline font family
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


const TONES: { angle: string; label: string }[] = [
  { angle: "benefit",      label: "Benefit"    },
  { angle: "curiosity",    label: "Curious"    },
  { angle: "urgency",      label: "Urgent"     },
  { angle: "emotional",    label: "Emotional"  },
  { angle: "aspirational", label: "Aspire"     },
  { angle: "story",        label: "Story"      },
  { angle: "contrast",     label: "Contrast"   },
];

interface Persona {
  id: string;
  segmentId: string;
  name: string;
  tones: string[];
  isCustom?: boolean;
}

const SEGMENT_LABELS: Record<string, string> = {
  seg_busy:   "Busy",
  seg_trend:  "Trend",
  seg_budget: "Budget",
  seg_short:  "Short Nails",
  seg_new:    "Newbies",
  seg_luxury: "Luxury",
  seg_custom: "My Personas",
};

let _itemCounter = 0;
function newItemId() {
  return `qi-${++_itemCounter}`;
}

// Resize + re-encode image to JPEG before upload to stay under the
// Vercel 4.5 MB serverless function payload limit.
const MAX_UPLOAD_PX = 1200; // longest side in pixels — keep low to avoid OOM with many images
const JPEG_QUALITY = 0.85;
const IMAGE_LIMIT = 100; // max images per session

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


const FAMILY_LABELS_STATIC: Record<string, string> = {
  testimonial: "Testimonial",
  minimal: "Minimal",
  luxury: "Luxury",
  ai: "AI Style",
};

const QueueItemRow = memo(function QueueItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: QueueItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={
        "w-full flex items-center gap-3 px-4 py-3 text-left transition border-l-2 " +
        (isSelected
          ? "bg-indigo-500/[0.08] border-indigo-500/60"
          : "hover:bg-white/[0.03] border-transparent")
      }
    >
      <StatusIcon status={item.status} />
      <img
        src={item.previewUrl}
        alt=""
        loading="lazy"
        className="h-16 w-16 rounded-lg object-cover shrink-0 border border-white/10"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px]">
          {item.status === "uploading" && (
            <span className="text-indigo-400">Uploading...</span>
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
          {(item.status === "done" || item.status === "analyzed") && item.result && (
            <span className="text-gray-600">
              {FAMILY_LABELS_STATIC[item.usedFamilyId ?? item.result.familyId] ?? item.result.familyId}{" "}
              · {item.result.format}
            </span>
          )}
        </p>
      </div>
      {item.approved && (
        <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
});

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
  if (status === "uploading" || status === "generating")
    return <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />;
  if (status === "analyzed")
    return <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-indigo-400/60" />;
  return <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />;
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [selectedFormat, setSelectedFormat] = useState<Format>("9:16");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [brandByImage, setBrandByImage] = useState<Record<string, boolean>>({});
  // Static previews — pre-rendered thumbnails served from /previews/
  const sharedLayoutPreviews: Partial<Record<SurpriseLayout, string>> = Object.fromEntries(
    LAYOUT_PREVIEWS.map((p) => [p.layout, `/previews/${p.layout}.png`])
  );
  const sharedTemplatePreviews: Partial<Record<string, string>> = Object.fromEntries(
    ALL_TEMPLATES.map((t) => [t.templateId, `/previews/${t.templateId}.png`])
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [surprisePrompt, setSurprisePrompt] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [cropEditorItemId, setCropEditorItemId] = useState<string | null>(null);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const personaBtnRef = useRef<HTMLButtonElement>(null);
  const [addPersonaOpen, setAddPersonaOpen] = useState(false);
  const [addPersonaName, setAddPersonaName] = useState("");
  const [addPersonaDesc, setAddPersonaDesc] = useState("");
  const [addPersonaLoading, setAddPersonaLoading] = useState(false);
  const [surprisePanelOpen, setSurprisePanelOpen] = useState(false);
  const [ownHeadlineOpen, setOwnHeadlineOpen] = useState(false);
  const [ownHeadlineInput, setOwnHeadlineInput] = useState("");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaHeadlineMap, setPersonaHeadlineMap] = useState<Record<string, Record<string, string>>>({});
  const [personaByImage, setPersonaByImage] = useState<Record<string, string>>({});
  const [toneByImage, setToneByImage] = useState<Record<string, string>>({});

  const usedStyleIdsRef = useRef<string[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const adImgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  // Mirror queue + selectedItemId in refs so callbacks can read latest values
  // without being declared after derived variables that depend on state.
  const queueRef = useRef<QueueItem[]>([]);
  queueRef.current = queue;
  const selectedItemIdRef = useRef<string | null>(null);
  selectedItemIdRef.current = selectedItemId;
  const selectedLangRef = useRef<Language>("en");
  selectedLangRef.current = selectedLang;
  const selectedFormatRef = useRef<Format>("9:16");
  selectedFormatRef.current = selectedFormat;

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedItemId(id);
  }, []);

  // Auto-select first done item when nothing is selected.
  // Uses selectedItemIdRef (not state) to avoid stale closure — selectedItemId is
  // intentionally omitted from deps, but the ref always holds the latest value.
  const statusKey = queue.map((i) => i.status).join(",");
  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPersonas(data); })
      .catch(() => { /* leave personas as [] — select stays disabled */ });
    // Poll until persona headlines are available.
    // On cold start they are generated in the background during first upload,
    // so the initial fetch may return empty — retry every 2s until populated.
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 15; i++) {
        if (cancelled) return;
        try {
          const r = await fetch("/api/persona-headlines");
          if (!r.ok) return; // route error or 404 — stop polling, don't spam logs
          const data = await r.json();
          if (data && typeof data === "object" && Object.keys(data).length > 0) {
            setPersonaHeadlineMap(data);
            return;
          }
        } catch { /* ignore */ }
        await new Promise((res) => setTimeout(res, 2000));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const currentSelection = selectedItemIdRef.current;
    setQueue((prev) => {
      const hasSelection = prev.some((i) => i.id === currentSelection);
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
    usedStyleIdsRef.current = [];
    setSelectedItemId(null);
    setQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return imageFiles.map((file) => ({
        id: newItemId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "idle",
        approved: false,
        cropX: 0.5,
      }));
    });
  }, [clearServerData]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // ── Generate All ────────────────────────────────────────

  const handleGenerateAll = useCallback(async () => {
    if (processing) return;
    const itemsToProcess = queue.filter((item) => item.status === "idle");
    if (itemsToProcess.length === 0) return;

    setProcessing(true);

    // Process at most 3 images concurrently to avoid overwhelming Puppeteer
    const CONCURRENCY = 3;
    const results: PromiseSettledResult<void>[] = [];
    for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY) {
      const batch = itemsToProcess.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(batch.map(async (item) => {
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

        // Free browser memory: swap blob URL for server URL, then revoke the blob
        setQueue((prev) => prev.map((q) => {
          if (q.id !== item.id) return q;
          URL.revokeObjectURL(q.previewUrl);
          return { ...q, previewUrl: uploaded.url };
        }));

        // Step 2 — mark as analyzed; pick default headline from already-loaded map
        const activePersonaId = personaByImage[item.id] ?? personas[0]?.id;
        const firstHeadline = activePersonaId
          ? Object.values(personaHeadlineMap[activePersonaId] ?? {})[0]
          : undefined;
        updateItem(item.id, {
          status: "analyzed",
          imageId: uploaded.imageId,
          imageUrl: uploaded.url,
          imageWidth: uploaded.width,
          imageHeight: uploaded.height,
          ...(firstHeadline ? { defaultHeadline: firstHeadline } : {}),
        });

        // Step 3 — auto-render with clean_headline layout, center crop, default headline position
        updateItem(item.id, { status: "generating" });
        try {
          const defaultSpec = LAYOUT_PREVIEWS.find((p) => p.layout === "clean_headline")!.spec;
          const autoSpec = { ...defaultSpec, headlineYOverride: 0.1484, headlineFontScale: 1.0 };
          const autoRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageId: uploaded.imageId,
              imageUrl: uploaded.url,
              imageWidth: uploaded.width,
              imageHeight: uploaded.height,
              forceSurpriseSpec: autoSpec,
              lang: selectedLangRef.current,
              format: selectedFormatRef.current,
              showBrand: false,
              cropX: 0.5,
              headline: firstHeadline,
            }),
          });
          if (autoRes.ok) {
            const autoData = await autoRes.json();
            const autoResult: RenderResultItem = autoData.results[0];
            updateItem(item.id, {
              status: "done",
              result: autoResult,
              approved: false,
              usedFamilyId: "ai" as FamilyId,
              usedSurpriseSpec: autoSpec,
              cropX: 0.5,
            });

          } else {
            updateItem(item.id, { status: "analyzed" });
          }
        } catch {
          updateItem(item.id, { status: "analyzed" });
        }

      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
      }));
      results.push(...batchResults);
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
      format: Format,
      showBrandOverride?: boolean
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
            showBrand: showBrandOverride !== undefined ? showBrandOverride : showBrand,
            personaId: personaByImage[item.id] ?? personas[0]?.id,
            cropX: item.cropX ?? 0.5,
            headline: item.result?.headlineText ?? item.defaultHeadline ?? undefined,
            headlineYOverride: item.result?.headlineYOverride ?? item.usedSurpriseSpec?.headlineYOverride,
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
          lang,
          usedSurpriseSpec: undefined,
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
            userPrompt: surprisePrompt || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Surprise Me failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        updateItem(item.id, { result, approved: false, usedFamilyId: "ai" as FamilyId, lang: selectedLang });
      } catch (err) {
        console.error("Surprise Me error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem, selectedLang, surprisePrompt]
  );


  // ── Reference image selection ──
  const handleRefImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [header, base64] = dataUrl.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1]?.replace("image/", "") ?? "jpeg";
      setReferenceImage({ base64, mimeType, preview: dataUrl });
    };
    reader.readAsDataURL(compressed);
  }, []);

  // ── Inspired by Reference — same SVG pipeline as Surprise Me, guided by reference image ──
  const handleInspiredByReference = useCallback(
    async (item: QueueItem) => {
      if (!item.imageId || !referenceImage || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/surprise-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            lang: selectedLang,
            referenceImageBase64: referenceImage.base64,
            referenceImageMimeType: referenceImage.mimeType,
            userPrompt: surprisePrompt || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Inspired by reference failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        updateItem(item.id, { result, approved: false, usedFamilyId: "ai" as FamilyId, lang: selectedLang });
      } catch (err) {
        console.error("Inspired by reference error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, referenceImage, updateItem, selectedLang, surprisePrompt]
  );

  // Auto-generate when a reference image is uploaded via the AI Reference card
  useEffect(() => {
    if (referenceImage && selectedItem && selectedItem.imageId && !detailLoading) {
      handleInspiredByReference(selectedItem);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceImage]);

  // ── Preview a specific layout — no AI call, fixed spec ──
  const handlePreviewLayout = useCallback(
    async (item: QueueItem, spec: SurpriseSpec, langOverride?: Language, formatOverride?: Format, showBrandOverride?: boolean) => {
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
            lang: langOverride ?? selectedLangRef.current,
            format: formatOverride ?? selectedFormatRef.current,
            showBrand: showBrandOverride !== undefined ? showBrandOverride : showBrand,
            personaId: personaByImage[item.id] ?? personas[0]?.id,
            cropX: item.cropX ?? 0.5,
            headline: item.result?.headlineText ?? undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Preview layout failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        updateItem(item.id, { result, approved: false, usedFamilyId: "ai" as FamilyId, lang: langOverride ?? selectedLangRef.current, usedSurpriseSpec: spec });
      } catch (err) {
        console.error("Preview layout error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );



  // Convenience wrappers used by the three control types in the detail panel
  const handleStyleChange = useCallback(
    (item: QueueItem, templateId: string) =>
      handleRerender(item, templateId, selectedLang, selectedFormat),
    [handleRerender, selectedLang, selectedFormat]
  );

  // Shared helper: re-render existing ad via /api/switch (preserves headline, no AI call)
  const handleSwitch = useCallback(
    async (item: QueueItem, lang: Language, format: Format, showBrandOverride?: boolean) => {
      if (!item.result || detailLoading) return;
      setDetailLoading(true);
      try {
        const res = await fetch("/api/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultIds: [item.result.id], lang, format, ...(showBrandOverride !== undefined ? { showBrand: showBrandOverride } : {}) }),
        });
        if (!res.ok) throw new Error("Switch failed");
        const data = await res.json();
        const switched = data.results?.[0];
        if (switched?.result) {
          updateItem(item.id, { result: { ...item.result, ...switched.result }, approved: false, lang });
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
      if (!item) return;
      if (item.result) {
        handleSwitch(item, lang, selectedFormatRef.current);
      } else if (item.imageId) {
        // No render yet — auto-render with bottom_bar, passing the new lang explicitly
        handlePreviewLayout(item, { ...LAYOUT_PREVIEWS.find(p => p.layout === "clean_headline")!.spec }, lang, selectedFormatRef.current);
      }
    },
    [handleSwitch, handlePreviewLayout]
  );

  const handleFormatChange = useCallback(
    (format: Format) => {
      setSelectedFormat(format);
      const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
      if (!item) return;
      if (item.result) {
        handleSwitch(item, selectedLangRef.current, format);
      } else if (item.imageId) {
        // No render yet — auto-render with bottom_bar, passing the new format explicitly
        handlePreviewLayout(item, { ...LAYOUT_PREVIEWS.find(p => p.layout === "clean_headline")!.spec }, selectedLangRef.current, format);
      }
    },
    [handleSwitch, handlePreviewLayout]
  );

  // ── Tone-specific headline (from stage bar Tone buttons) ────
  const handleNewHeadlineWithTone = useCallback(
    async (item: QueueItem, angle: string) => {
      if (!item.result || !item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        // If active persona has this tone, use persona headline
        const activePersonaId = personaByImage[item.id] ?? personas[0]?.id;
        const activePersona = activePersonaId ? personas.find((p) => p.id === activePersonaId) : undefined;
        if (activePersona?.tones.includes(angle)) {
          const headline = personaHeadlineMap[activePersonaId]?.[angle];
          if (headline) {
            // Optimistic update — show headline immediately
            updateItem(item.id, { result: { ...item.result, headlineText: headline }, approved: false });
            setToneByImage(prev => ({ ...prev, [item.id]: angle }));
            const regenRes = await fetch("/api/regenerate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resultId: item.result.id, mode: "headline", angle: "own", customHeadline: headline }),
            });
            if (regenRes.ok) {
              const data = await regenRes.json();
              updateItem(item.id, { result: { ...data.result, subjectPos: item.result.subjectPos, attribution: data.result.attribution ?? item.result?.attribution }, approved: false });
            }
            return;
          }
        }
        // Fall back to copy pool
        const res = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId: item.result.id, mode: "headline", angle }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Regeneration failed");
        }
        const data = await res.json();
        updateItem(item.id, { result: { ...data.result, subjectPos: item.result.subjectPos, attribution: data.result.attribution ?? item.result?.attribution }, approved: false });
        setToneByImage(prev => ({ ...prev, [item.id]: angle }));
      } catch (err) {
        console.error("Tone headline error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem, personaByImage, personas, personaHeadlineMap]
  );

  // ── Persona headline ─────────────────────────────────────
  const TESTIMONIAL_TEMPLATES = new Set(["quote_card", "star_review"]);

  const handlePersonaHeadline = useCallback(
    async (item: QueueItem, personaId: string) => {
      if (!item.result || !item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const isTestimonial = TESTIMONIAL_TEMPLATES.has(item.result.templateId ?? "");

        if (!isTestimonial) {
          const persona = personas.find((p) => p.id === personaId);
          const firstTone = persona?.tones[0] ?? "";
          const headline = personaHeadlineMap[personaId]?.[firstTone] ?? Object.values(personaHeadlineMap[personaId] ?? {})[0];
          if (!headline) return;
          // Optimistic update for non-testimonial layouts
          updateItem(item.id, { result: { ...item.result, headlineText: headline }, approved: false });
          if (firstTone) setToneByImage(prev => ({ ...prev, [item.id]: firstTone }));
        }

        const regenRes = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isTestimonial
              ? { resultId: item.result.id, mode: "headline", personaId }
              : {
                  resultId: item.result.id,
                  mode: "headline",
                  angle: "own",
                  customHeadline: personaHeadlineMap[personaId]?.[personas.find((p) => p.id === personaId)?.tones[0] ?? ""]
                    ?? Object.values(personaHeadlineMap[personaId] ?? {})[0],
                }
          ),
        });
        if (!regenRes.ok) {
          const d = await regenRes.json();
          throw new Error(d.error || "Regeneration failed");
        }
        const data = await regenRes.json();
        updateItem(item.id, {
          result: {
            ...data.result,
            subjectPos: item.result.subjectPos,
            attribution: data.result.attribution ?? item.result?.attribution,
          },
          approved: false,
        });
      } catch (err) {
        console.error("Persona headline error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem, personas, personaHeadlineMap]
  );

  // ── Own headline (user-typed) ─────────────────────────────
  const handleOwnHeadline = useCallback(
    async (item: QueueItem, text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !item.result || detailLoading) return;
      setOwnHeadlineOpen(false);
      setDetailLoading(true);
      try {
        const res = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId: item.result.id, mode: "headline", angle: "own", customHeadline: trimmed }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Regeneration failed");
        }
        const data = await res.json();
        updateItem(item.id, { result: { ...data.result, subjectPos: data.result.subjectPos ?? item.result?.subjectPos,
              attribution: data.result.attribution ?? item.result?.attribution }, approved: false });
        setToneByImage(prev => ({ ...prev, [item.id]: "own" }));
      } catch (err) {
        console.error("Own headline error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, updateItem]
  );

  // ── Split Scene ──────────────────────────────────────────
  const handleSplitScene = useCallback(async () => {
    const currentId = selectedItemIdRef.current;
    const item = queueRef.current.find((q) => q.id === currentId);
    if (!item || !currentId) return;
    const activePersonaId = personaByImage[currentId] ?? personas[0]?.id;
    if (!activePersonaId) return;
    const PERSONA_SCENE: Record<string, string> = {
      per_busy_1:  "per_1", per_busy_2:  "per_1", per_busy_3:  "per_1",
      per_trend_1: "per_2", per_trend_2: "per_2", per_trend_3: "per_2",
      per_bud_1:   "per_3", per_bud_2:   "per_3", per_bud_3:   "per_3",
      per_short_1: "per_4", per_short_2: "per_4", per_short_3: "per_4",
      per_new_1:   "per_5", per_new_2:   "per_5", per_new_3:   "per_5",
      per_lux_1:   "per_6", per_lux_2:   "per_6", per_lux_3:   "per_6",
    };
    const sceneFile = PERSONA_SCENE[activePersonaId] ?? "per_1";
    const queueId = item.id;
    setQueue((prev) => prev.map((q) => q.id === queueId ? { ...q, status: "generating" } : q));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: item.imageId,
          forceTemplateId: "split_scene",
          scenePersonaId: sceneFile,
          lang: selectedLangRef.current,
          format: selectedFormatRef.current,
          personaId: activePersonaId ?? undefined,
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
      setQueue((prev) => prev.map((q) => q.id === queueId ? { ...q, status: "error" } : q));
    }
  }, [personaByImage, personas, setQueue]);

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
  const LAYOUT_SHORT: Record<string, string> = {
    // ai_surprise layout pill variants (from usedSurpriseSpec.layout)
    clean_headline: "headline",
    split_right: "splitright",
    full_overlay: "overlay",
    bottom_bar: "bottombar",
    frame_overlay: "frameoverlay",
    postcard: "postcard",
    vertical_text: "vertical",
    // named templates
    star_review: "stars",
    split_scene: "split",
    quote_card: "quote",
    luxury_editorial_left: "editorial",
    luxury_soft_frame_open: "frame",
    ai_surprise_svg: "ai",
  };

  function buildFilename(item: QueueItem): string {
    const lang = (item.result?.lang ?? item.lang ?? selectedLang).toUpperCase();
    const templateId = item.result?.templateId ?? "";
    const isAI = templateId === "ai_surprise_svg";
    // For ai_surprise layout pills, use the actual layout name from the spec
    const layoutKey = (templateId === "ai_surprise" && item.usedSurpriseSpec?.layout)
      ? item.usedSurpriseSpec.layout
      : templateId;
    const layoutShort = LAYOUT_SHORT[layoutKey] ?? layoutKey.replace(/_/g, "");
    if (isAI) return `${lang}_${layoutShort}`;
    const personaId = personaByImage[item.id] ?? personas[0]?.id;
    const personaName = personas.find(p => p.id === personaId)?.name ?? "";
    const personaSlug = personaName.toLowerCase().replace(/\s+/g, "");
    return personaSlug ? `${lang}_${personaSlug}_${layoutShort}` : `${lang}_${layoutShort}`;
  }

  const handleDownload = useCallback(async (pngUrl: string, item: QueueItem) => {
    try {
      const res = await fetch(pngUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = pngUrl.endsWith(".jpg") || pngUrl.includes(".jpg?") ? "jpg" : "png";
      a.download = `${buildFilename(item)}.${ext}`;
      // Must be in the DOM for Firefox/Safari to trigger the download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revocation so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [personas, personaByImage, selectedLang]);

  const handleDownloadAll = useCallback(async () => {
    const approved = queue.filter((item) => item.approved && item.result);
    for (let i = 0; i < approved.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 200));
      const item = approved[i];
      if (item.result) handleDownload(item.result.pngUrl, item);
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
    (item) => item.status === "uploading" || item.status === "generating"
  );
  // Only show rows that have started processing (hide idle ones)
  const visibleQueueItems = queue.filter((item) => item.status !== "idle");

  const selectedItem = queue.find((item) => item.id === selectedItemId) ?? null;
  const selectedIdx = selectedItem ? queue.indexOf(selectedItem) : -1;
  const showBrand = selectedItemId != null ? (brandByImage[selectedItemId] ?? false) : false;
  const activeLayout = selectedItem?.usedSurpriseSpec?.layout ?? null;
  const prevItem = selectedIdx > 0 ? queue[selectedIdx - 1] : null;
  const nextItem =
    selectedIdx >= 0 && selectedIdx < queue.length - 1
      ? queue[selectedIdx + 1]
      : null;

  const isSVGSurprise = selectedItem?.result?.templateId === "ai_surprise_svg";

  const activePersona = personas.find(
    (p) => p.id === (personaByImage[selectedItemId ?? ""] ?? personas[0]?.id)
  );
  const activeTones = activePersona
    ? TONES.filter((t) => activePersona.tones.includes(t.angle))
    : TONES;

  const isSplitScene = selectedItem?.result?.templateId === "split_scene";

  const isCleanHeadline =
    !!selectedItem?.result &&
    selectedItem.usedSurpriseSpec?.layout === "clean_headline";

  const isStarReview =
    !!selectedItem?.result &&
    selectedItem.result.templateId === "star_review";

  const isHeadlineDraggable =
    !!selectedItem?.result &&
    (selectedItem.usedSurpriseSpec?.layout === "clean_headline" ||
     selectedItem.result.templateId === "star_review" ||
     selectedItem.result.templateId === "split_scene");

  const initialHeadlineY = selectedItem?.headlineY
    ?? (selectedItem?.result
      ? (selectedItem.result.headlineYOverride
          ?? selectedItem.usedSurpriseSpec?.headlineYOverride
          ?? (selectedItem.result.templateId === "star_review" ? 0.2005 : selectedItem.result.templateId === "split_scene" ? 0.82 : 0.1484))
      : 0.1484);

  // ── Reposition headline ───────────────────────────────────

  const handleAddPersona = async (name: string, desc: string) => {
    setAddPersonaLoading(true);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc }),
      });
      if (!res.ok) throw new Error("Failed to create persona");
      const newPersona: Persona = await res.json();
      setPersonas((prev) => [...prev, newPersona]);
      // Fetch updated headlines for the new persona
      const hlRes = await fetch("/api/persona-headlines");
      if (hlRes.ok) setPersonaHeadlineMap(await hlRes.json());
      // Auto-select the new persona for the current image
      if (selectedItemId && selectedItem) {
        setPersonaByImage((prev) => ({ ...prev, [selectedItemId]: newPersona.id }));
        handlePersonaHeadline(selectedItem, newPersona.id);
      }
      setAddPersonaOpen(false);
      setAddPersonaName("");
      setAddPersonaDesc("");
      setPersonaDropdownOpen(false);
    } catch (err) {
      console.error("[add-persona]", err);
    } finally {
      setAddPersonaLoading(false);
    }
  };

  const handleReposition = useCallback(async (normalizedY: number, fontScale = 1.0, brandNameY?: number, brandNameFontScale?: number) => {
    if (!selectedItem?.result || detailLoading) return;
    setDetailLoading(true);
    try {
      const res = await fetch("/api/reposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: selectedItem.result.id, headlineYOverride: normalizedY, headlineFontScale: fontScale, showBrand, ...(brandNameY !== undefined ? { brandNameY } : {}), ...(brandNameFontScale !== undefined ? { brandNameFontScale } : {}), ...(selectedItem.headlineFont ? { headlineFont: selectedItem.headlineFont } : {}) }),
      });
      if (!res.ok) throw new Error("Reposition failed");
      const data = await res.json();
      updateItem(selectedItem.id, { result: { ...selectedItem.result, ...data.result }, approved: false });
      return data.result.id as string;
    } catch (err) {
      console.error("[reposition]", err);
    } finally {
      setDetailLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, detailLoading, updateItem]);

  // ── Crop render (from CropEditor) ──────────────────────
  const handleCropRender = useCallback(
    async (cropX: number, headlineY: number, fontScale: number) => {
      // CropEditor can be shown automatically (analyzed state) or via Reposition button
      const itemId = cropEditorItemId ?? selectedItemIdRef.current;
      const item = queueRef.current.find((i) => i.id === itemId);
      if (!item || !item.imageId || detailLoading) return;
      setDetailLoading(true);
      try {
        const defaultSpec = LAYOUT_PREVIEWS.find((p) => p.layout === "clean_headline")!.spec;
        const specWithHeadline = {
          ...defaultSpec,
          headlineYOverride: headlineY,
          headlineFontScale: fontScale,
        };
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            imageWidth: item.imageWidth,
            imageHeight: item.imageHeight,
            forceSurpriseSpec: specWithHeadline,
            lang: selectedLangRef.current,
            format: selectedFormatRef.current,
            showBrand: brandByImage[item.id] ?? false,
            cropX,
            headline: item.result?.headlineText ?? undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Crop render failed");
        }
        const data = await res.json();
        const result: RenderResultItem = data.results[0];
        // Store cropX on item so subsequent layout switches preserve it
        updateItem(item.id, {
          status: "done",
          result,
          approved: false,
          usedFamilyId: "ai" as FamilyId,
          lang: selectedLangRef.current,
          usedSurpriseSpec: specWithHeadline,
          cropX,
        });
        setCropEditorItemId(null);
      } catch (err) {
        console.error("Crop render error:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cropEditorItemId, detailLoading, updateItem, brandByImage]
  );

  const pillActive =
    "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_8px_rgba(99,102,241,0.12)]";
  const pillInactive =
    "bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300";

  // Close layout panel whenever the selected image changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLayoutPanelOpen(false); setOwnHeadlineOpen(false); setOwnHeadlineInput(""); setCropEditorItemId(null); }, [selectedItemId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft"  && prevItem) setSelectedItemId(prevItem.id);
      if (e.key === "ArrowRight" && nextItem) setSelectedItemId(nextItem.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevItem, nextItem]);

  // Sync format + lang controls to the selected image's last-used values
  useEffect(() => {
    const item = queueRef.current.find((i) => i.id === selectedItemId);
    if (!item) return;
    if (item.result?.format) setSelectedFormat(item.result.format as Format);
    if (item.lang) setSelectedLang(item.lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] text-white">

      {/* ════ LEFT PANEL ════════════════════════════════ */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-white/[0.06] overflow-hidden">

        {/* Title */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-white tracking-tight">AI Ad Agent</h1>

          </div>
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
                <QueueItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  onSelect={handleSelectItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Feedback button — pinned to sidebar bottom ─── */}
        <div className="shrink-0 border-t border-white/[0.06] flex items-center justify-between px-4 py-3">
          <span className="text-[10px] text-gray-700 font-mono select-none">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
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

      {/* ════ RIGHT PANEL — Stage Bar Design ══════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedItem ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
                <svg className="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M3.75 12V6.75A2.25 2.25 0 016 4.5h12A2.25 2.25 0 0120.25 6.75V12" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Select an image from the queue to preview</p>
              <p className="text-[11px] text-gray-700 mt-1">Generate ads first, then click any row</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── STAGE BAR ───────────────────────────────────── */}
            {(selectedItem.status === "done" || selectedItem.status === "analyzed") && selectedItem.imageId && (
              <div className="shrink-0 flex items-stretch border-b-2 border-white/[0.08] bg-[#0a0d12] overflow-x-auto pt-2" style={{ minHeight: 72 }}>

                {/* Stage: Layout */}
                <div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Layout</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => setLayoutPanelOpen((v) => !v)}
                      className={"flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium border transition " + (layoutPanelOpen ? pillActive : pillInactive)}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                      <span>Choose layout</span>
                      <svg className={"h-3.5 w-3.5 transition-transform " + (layoutPanelOpen ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Stage: Brand name */}
                <div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Brand</span>
                  <div className="flex items-center">
                    <div
                      onClick={() => { const next = !showBrand; if (selectedItemId) setBrandByImage(prev => ({ ...prev, [selectedItemId]: next })); }}
                      className={"w-12 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer " + (showBrand ? "bg-indigo-600" : "bg-white/10")}
                    >
                      <div className={"w-5 h-5 rounded-full bg-white shadow transition-transform " + (showBrand ? "translate-x-6" : "translate-x-0")} />
                    </div>
                  </div>
                </div>

                {/* Stage: Persona */}
                <div className="relative flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Persona</span>
                  <button
                    ref={personaBtnRef}
                    disabled={isSVGSurprise || detailLoading || personas.length === 0 || !selectedItem?.result}
                    onClick={() => setPersonaDropdownOpen((o) => !o)}
                    className="w-52 rounded-md px-2 py-1.5 text-sm bg-[#0d1117] border border-white/[0.08] text-gray-200 disabled:opacity-30 text-left flex items-center justify-between gap-2 hover:border-white/20 transition-colors"
                  >
                    <span className="truncate">
                      {personas.find((p) => p.id === (personaByImage[selectedItemId ?? ""] ?? personas[0]?.id))?.name ?? "Select persona"}
                    </span>
                    <svg className="w-3 h-3 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {personaDropdownOpen && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setPersonaDropdownOpen(false)} />
                    <div style={(() => { const r = personaBtnRef.current?.getBoundingClientRect(); return r ? { position: "fixed" as const, top: r.bottom + 6, left: r.left, zIndex: 9999 } : { display: "none" }; })()} className="bg-[#16191f] border border-white/[0.10] rounded-xl shadow-2xl p-3 w-[560px]">
                      <div className="grid grid-cols-3 gap-x-4 gap-y-0">
                        {Object.entries(SEGMENT_LABELS).map(([segId, segLabel]) => (
                          <div key={segId}>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 mt-1">{segLabel}</div>
                            {personas.filter((p) => p.segmentId === segId).map((p) => {
                              const isActive = p.id === (personaByImage[selectedItemId ?? ""] ?? personas[0]?.id);
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    if (!selectedItem || !selectedItemId) return;
                                    setPersonaByImage((prev) => ({ ...prev, [selectedItemId]: p.id }));
                                    handlePersonaHeadline(selectedItem, p.id);
                                    setPersonaDropdownOpen(false);
                                  }}
                                  className={"w-full text-left text-xs px-2 py-1 rounded-md transition-colors mb-0.5 " + (isActive ? "bg-indigo-600/25 text-indigo-300" : "text-gray-300 hover:bg-white/[0.06]")}
                                >
                                  {p.name}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {/* Add your own persona */}
                      <div className="mt-3 pt-3 border-t border-white/[0.08]">
                        {!addPersonaOpen ? (
                          <button
                            onClick={() => setAddPersonaOpen(true)}
                            className="w-full text-left text-xs px-2 py-1 rounded-md text-gray-500 hover:bg-white/[0.06] hover:text-gray-300 transition-colors flex items-center gap-1.5"
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2v8M2 6h8"/></svg>
                            Add your own
                          </button>
                        ) : (
                          <form
                            onSubmit={(e) => { e.preventDefault(); if (addPersonaName.trim() && addPersonaDesc.trim()) handleAddPersona(addPersonaName, addPersonaDesc); }}
                            className="flex flex-col gap-2"
                          >
                            <input
                              autoFocus
                              value={addPersonaName}
                              onChange={(e) => setAddPersonaName(e.target.value)}
                              placeholder="Name (e.g. The Minimalist)"
                              className="rounded-md px-2 py-1 text-xs bg-white/[0.06] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
                            />
                            <textarea
                              value={addPersonaDesc}
                              onChange={(e) => setAddPersonaDesc(e.target.value)}
                              placeholder="Description — who are they, what do they want?"
                              rows={2}
                              className="rounded-md px-2 py-1 text-xs bg-white/[0.06] border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button
                                type="submit"
                                disabled={addPersonaLoading || !addPersonaName.trim() || !addPersonaDesc.trim()}
                                className="flex-1 rounded-md px-2 py-1 text-xs font-medium bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-500 transition"
                              >
                                {addPersonaLoading ? "Creating…" : "Create"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddPersonaOpen(false); setAddPersonaName(""); setAddPersonaDesc(""); }}
                                className="rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Stage: Headline Tone — disabled (not hidden) for final SVG surprise */}
                <div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Headline Tone</span>
                  <div className="flex items-center gap-1.5">
                    {activeTones.map(({ angle, label }) => (
                      <button
                        key={angle}
                        onClick={() => selectedItem.result && handleNewHeadlineWithTone(selectedItem, angle)}
                        disabled={isSVGSurprise || detailLoading || !selectedItem.result}
                        className={"rounded-md px-3 py-1.5 text-sm font-medium border transition disabled:opacity-30 " + (toneByImage[selectedItemId ?? ""] === angle ? pillActive : pillInactive)}
                        title={`Get a ${label.toLowerCase()} headline`}
                      >
                        {label}
                      </button>
                    ))}

                    {/* "Your own" tone button */}
                    <button
                      onClick={() => { setOwnHeadlineOpen(o => !o); setOwnHeadlineInput(""); }}
                      disabled={isSVGSurprise || detailLoading || !selectedItem.result}
                      className={"rounded-md px-3 py-1.5 text-sm font-medium border transition disabled:opacity-30 " + (ownHeadlineOpen ? pillActive : pillInactive)}
                      title="Type your own headline"
                    >
                      Your own
                    </button>

                    {/* Inline input — shown when "Your own" is toggled open */}
                    {ownHeadlineOpen && (
                      <form
                        onSubmit={e => { e.preventDefault(); handleOwnHeadline(selectedItem, ownHeadlineInput); }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          autoFocus
                          value={ownHeadlineInput}
                          onChange={e => setOwnHeadlineInput(e.target.value)}
                          placeholder="Type headline…"
                          className="rounded-md px-3 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 w-52"
                        />
                        <button
                          type="submit"
                          disabled={!ownHeadlineInput.trim() || detailLoading}
                          className="rounded-md px-3 py-1.5 text-sm font-medium border border-white/20 text-white disabled:opacity-30 hover:bg-white/10 transition"
                        >
                          Apply
                        </button>
                      </form>
                    )}
                  </div>
                </div>


                {/* Stage: Font */}
                <div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Font</span>
                  <div className="flex items-center gap-1.5">
                    {([
                      { key: "Playfair Display", label: "Playfair" },
                      { key: "Montserrat",        label: "Montserrat" },
                    ] as { key: string; label: string }[]).map(({ key, label }) => {
                      const active = (selectedItem?.headlineFont ?? "Playfair Display") === key;
                      return (
                        <button
                          key={key}
                          onClick={() => selectedItemId && updateItem(selectedItemId, { headlineFont: key })}
                          disabled={isSVGSurprise || !selectedItem?.result}
                          className={"rounded-md px-3 py-1.5 text-sm font-medium border transition disabled:opacity-30 " + (active ? pillActive : pillInactive)}
                          style={{ fontFamily: `'${key}', sans-serif` }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Stage: Crop */}
                <div className="flex flex-col justify-center gap-1.5 px-5 border-r-2 border-l-2 border-white/[0.08] shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Crop</span>
                  <div className="flex items-center">
                    <button
                      onClick={() => setCropEditorItemId(cropEditorItemId === selectedItemId ? null : (selectedItemId ?? null))}
                      disabled={!selectedItem?.imageId || detailLoading}
                      className={"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition disabled:opacity-30 " + (cropEditorItemId === selectedItemId ? pillActive : pillInactive)}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21H3v-4M21 3h-4M3 7V3h4M17 3h4v4M3 17v4h4M21 17v4h-4" />
                      </svg>
                      <span>Reposition</span>
                    </button>
                  </div>
                </div>

                {/* ✨ AI Style — three generation modes */}
                <input ref={refFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefImageChange} />
                <div className="flex flex-col justify-center gap-1.5 px-5 border-l-2 border-white/[0.08] bg-indigo-950/20 shrink-0">
                  <div className="relative flex items-center gap-1.5 group">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/50">AI Style</span>
                    <div className="w-3.5 h-3.5 rounded-full border border-indigo-400/60 flex items-center justify-center cursor-default">
                      <span className="text-[9px] font-bold text-indigo-400/80 leading-none select-none">?</span>
                    </div>
                    <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-white/[0.08] bg-[#0f1318] px-4 py-3 text-[11px] text-gray-400 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                      <p className="font-semibold text-gray-200 mb-1.5">AI-generated ads</p>
                      <p className="mb-2">These buttons let Claude design a complete ad from scratch:</p>
                      <p className="mb-0.5"><span className="text-gray-200 font-medium">Generate</span> — AI picks layout, colors and copy automatically.</p>
                      <p className="mb-0.5"><span className="text-gray-200 font-medium">Reference</span> — Upload a style image for AI to match.</p>
                      <p className="mb-2"><span className="text-gray-200 font-medium">Prompt</span> — Describe the mood or concept in your own words.</p>
                      <p className="text-amber-400/80">Note: AI Style ads cannot have their headline, layout or tone changed afterwards.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">

                    {/* Card 1: Just Generate */}
                    <button
                      onClick={() => handleSurpriseMe(selectedItem)}
                      disabled={detailLoading || !selectedItem.imageId}
                      className={"flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 w-[72px] transition disabled:opacity-40 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-gray-400 hover:text-gray-200"}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="text-[10px] font-semibold leading-tight text-center">Generate</span>
                    </button>

                    {/* Card 2: AI Reference Image */}
                    <button
                      onClick={() => refFileInputRef.current?.click()}
                      disabled={detailLoading || !selectedItem.imageId}
                      className={"flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 w-[72px] transition disabled:opacity-40 " + (referenceImage ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-gray-400 hover:text-gray-200")}
                    >
                      {referenceImage ? (
                        <img src={referenceImage.preview} alt="ref" className="w-6 h-6 rounded object-cover border border-indigo-400/30" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      )}
                      <span className="text-[10px] font-semibold leading-tight text-center">Reference</span>
                    </button>

                    {/* Card 3: With Prompt */}
                    <button
                      onClick={() => setSurprisePanelOpen((v) => !v)}
                      disabled={!selectedItem.imageId || detailLoading}
                      className={"flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 w-[72px] transition disabled:opacity-40 " + (surprisePanelOpen || surprisePrompt ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-gray-400 hover:text-gray-200")}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                      </svg>
                      <span className="text-[10px] font-semibold leading-tight text-center">Prompt</span>
                    </button>

                  </div>
                </div>
                {/* Spacer fills remaining right space */}
                <div className="flex-1 min-w-4" />              </div>
            )}


            {/* ── PROMPT PANEL (below stage bar, opened by With Prompt card) ── */}
            {surprisePanelOpen && selectedItem.imageId && (
              <div className="shrink-0 border-b border-white/[0.06] bg-[#0f1318] px-5 py-4">
                <textarea
                  value={surprisePrompt}
                  onChange={(e) => setSurprisePrompt(e.target.value)}
                  placeholder="Describe the mood, style, or concept you want..."
                  rows={5}
                  className="w-full resize-none rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] px-3 py-2.5 text-sm text-indigo-100 placeholder:text-indigo-400/30 outline-none focus:border-indigo-400/50 transition leading-relaxed"
                />
                <div className="flex items-center justify-between mt-3">
                  {surprisePrompt
                    ? <button onClick={() => setSurprisePrompt("")} className="text-xs text-indigo-400/50 hover:text-indigo-300 transition">Clear</button>
                    : <span />}
                  <button
                    onClick={() => { handleSurpriseMe(selectedItem); setSurprisePanelOpen(false); }}
                    disabled={detailLoading || !surprisePrompt.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-1.5 text-xs font-semibold text-white transition"
                  >
                    ✨ Generate
                  </button>
                </div>
              </div>
            )}

            {/* ── LAYOUT PANEL (expandable below stage bar) ── */}
            {layoutPanelOpen && selectedItem.imageId && (
              <div className="shrink-0 border-b border-white/[0.06] bg-[#0f1318] px-4 py-3 flex items-start gap-4">
                <div className="flex gap-2.5 items-start overflow-x-auto flex-1 min-w-0">
                  {/* Template options — Quote, Stars, Editorial, Frame Open */}
                  {ALL_TEMPLATES.filter(t => t.templateId === "star_review").map((t) => {
                    const previewUrl = sharedTemplatePreviews[t.templateId];
                    const isActive = selectedItem.result?.templateId === t.templateId;
                    return (
                      <button
                        key={t.templateId}
                        onClick={() => { handleStyleChange(selectedItem, t.templateId); setLayoutPanelOpen(false); }}
                        disabled={detailLoading}
                        className={"flex flex-col items-center gap-1 rounded-xl border p-1.5 transition disabled:opacity-40 shrink-0 " + (isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.08] hover:border-white/25 bg-white/[0.02]")}
                      >
                        <div className="w-[80px] h-[100px] rounded-lg overflow-hidden bg-white/[0.04] flex items-center justify-center">
                          {previewUrl
                            ? <img src={previewUrl} className="w-full h-full object-cover" alt={t.label} />
                            : <div className="h-3 w-3 animate-spin rounded-full border border-indigo-400/50 border-t-transparent" />}
                        </div>
                        <span className={"text-[10px] shrink-0 " + (isActive ? "text-indigo-300" : "text-gray-500")}>{t.label}</span>
                      </button>
                    );
                  })}

                  {/* Divider between templates and layouts */}
                  {/* <div className="w-px self-stretch bg-white/[0.06] mx-1 shrink-0" /> */}

                  {/* Layout options — Split Right, Full Overlay, etc. */}
                  {LAYOUT_PREVIEWS.filter(p => p.layout === "clean_headline").map((p) => {
                    const previewUrl = sharedLayoutPreviews[p.layout];
                    const isActive = activeLayout === p.layout && selectedItem.result?.templateId === "ai_surprise";
                    return (
                      <button
                        key={p.layout}
                        onClick={() => { const currentY = selectedItem.result?.headlineYOverride ?? selectedItem.usedSurpriseSpec?.headlineYOverride; handlePreviewLayout(selectedItem, { ...p.spec, ...(currentY !== undefined ? { headlineYOverride: currentY } : {}) }); setLayoutPanelOpen(false); }}
                        disabled={detailLoading}
                        className={"flex flex-col items-center gap-1 rounded-xl border p-1.5 transition disabled:opacity-40 shrink-0 " + (isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.08] hover:border-white/25 bg-white/[0.02]")}
                      >
                        <div className="w-[80px] h-[100px] rounded-lg overflow-hidden bg-white/[0.04] flex items-center justify-center">
                          {previewUrl
                            ? <img src={previewUrl} className="w-full h-full object-cover" alt={p.label} />
                            : <div className="h-3 w-3 animate-spin rounded-full border border-indigo-400/50 border-t-transparent" />}
                        </div>
                        <span className={"text-[10px] shrink-0 " + (isActive ? "text-indigo-300" : "text-gray-500")}>{p.label}</span>
                      </button>
                    );
                  })}

                  {/* Split Scene pill */}
                  {(() => {
                    const isActive = selectedItem.result?.templateId === "split_scene";
                    return (
                      <button
                        key="split_scene"
                        onClick={() => { handleSplitScene(); setLayoutPanelOpen(false); }}
                        disabled={detailLoading || !selectedItem.imageId}
                        className={"flex flex-col items-center gap-1 rounded-xl border p-1.5 transition disabled:opacity-40 shrink-0 " + (isActive ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.08] hover:border-white/25 bg-white/[0.02]")}
                      >
                        <div className="w-[80px] h-[100px] rounded-lg overflow-hidden bg-white/[0.04] flex items-center justify-center">
                          <div className="w-full h-full flex" style={{ background: "#1a1a2e" }}>
                            <div className="flex-1 h-full" style={{ background: "#2a2a3e" }} />
                            <div className="w-px h-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                            <div className="flex-1 h-full" style={{ background: "#1a1a2e" }} />
                          </div>
                        </div>
                        <span className={"text-[10px] shrink-0 " + (isActive ? "text-indigo-300" : "text-gray-500")}>Split Scene</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── SVG Surprise notice (final, not editable) ── */}
            {isSVGSurprise && (
              <div className="shrink-0 px-6 py-2 border-b border-white/[0.06] flex justify-center">
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-center">
                  <p className="text-xs font-semibold text-indigo-300">✨ AI Creative · 9:16</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Unique ad generated by Claude. Approve or download below.</p>
                </div>
              </div>
            )}


            {/* ── MAIN CONTENT ─────────────────────────────── */}
            {(selectedItem.status === "done" || selectedItem.status === "analyzed") && selectedItem.imageId ? (
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Crop Editor: shown when user clicks Reposition */}
                {cropEditorItemId === selectedItemId && selectedItem.imageUrl ? (
                  <CropEditor
                    imageUrl={selectedItem.imageUrl}
                    imageNaturalW={selectedItem.imageWidth ?? 1080}
                    imageNaturalH={selectedItem.imageHeight ?? 1920}
                    format={selectedFormat}
                    headline={selectedItem.result?.headlineText ?? selectedItem.usedSurpriseSpec?.en?.headline ?? selectedItem.defaultHeadline ?? ""}
                    initialCropX={selectedItem.cropX ?? 0.5}
                    initialHeadlineY={initialHeadlineY}
                    disabled={detailLoading}
                    onRender={handleCropRender}
                  />
                ) : (
                <>{/* Ad image — full width, fills all remaining space */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
                  {selectedItem.result ? (
                    <div className="relative h-full flex items-center justify-center">
                      {isCleanHeadline ? (
                        <LiveAdCanvas
                          key={selectedItemId ?? ""}
                          imageUrl={selectedItem.imageUrl ?? selectedItem.result.pngUrl}
                          subjectPos={selectedItem.result.subjectPos}
                          headline={selectedItem.result.headlineText ?? selectedItem.usedSurpriseSpec?.en?.headline ?? ""}
                          subtext={selectedItem.usedSurpriseSpec?.en?.subtext}
                          spec={selectedItem.usedSurpriseSpec ?? {}}
                          format={selectedItem.result.format as "9:16" | "4:5" | "1:1"}
                          initialY={initialHeadlineY}
                          initialFontScale={selectedItem.headlineFontScale ?? selectedItem.result.headlineFontScale ?? 1.0}
                          disabled={detailLoading}
                          onApply={handleReposition}
                          onChange={(y, scale, bY, bScale) => updateItem(selectedItemId!, { headlineY: y, headlineFontScale: scale, ...(bY !== undefined ? { brandNameY: bY } : {}), ...(bScale !== undefined ? { brandNameFontScale: bScale } : {}) })}
                          brandName={showBrand ? BRAND_NAME : undefined}
                          initialBrandY={selectedItem.brandNameY ?? selectedItem.result?.brandNameY}
                          initialBrandFontScale={selectedItem.brandNameFontScale ?? selectedItem.result?.brandNameFontScale}
                          headlineFont={selectedItem.headlineFont ?? "Playfair Display"}
                        />
                      ) : isStarReview ? (
                        <LiveAdCanvas
                          key={selectedItemId ?? ""}
                          imageUrl={selectedItem.imageUrl ?? selectedItem.result.pngUrl}
                          subjectPos={selectedItem.result.subjectPos}
                          headline=""
                          spec={{}}
                          format={selectedItem.result.format as "9:16" | "4:5" | "1:1"}
                          initialY={initialHeadlineY}
                          disableResize
                          disabled={detailLoading}
                          onApply={handleReposition}
                          onChange={(y, scale, bY, bScale) => updateItem(selectedItemId!, { headlineY: y, headlineFontScale: scale, ...(bY !== undefined ? { brandNameY: bY } : {}), ...(bScale !== undefined ? { brandNameFontScale: bScale } : {}) })}
                          brandName={showBrand ? BRAND_NAME : undefined}
                          initialBrandY={selectedItem.brandNameY ?? selectedItem.result?.brandNameY}
                          initialBrandFontScale={selectedItem.brandNameFontScale ?? selectedItem.result?.brandNameFontScale}
                          headlineFont={selectedItem.headlineFont ?? "Playfair Display"}
                          renderOverlay={(cw) => (
                            <StarCardPreview
                              quote={selectedItem.result!.headlineText ?? ""}
                              attribution={selectedItem.result!.attribution ?? ""}
                              containerW={cw}
                            />
                          )}
                        />
                      ) : isSplitScene ? (
                        <LiveAdCanvas
                          key={selectedItemId ?? ""}
                          imageUrl={selectedItem.result.pngUrl}
                          subjectPos={selectedItem.result.subjectPos}
                          headline={selectedItem.result.headlineText ?? ""}
                          spec={{}}
                          format={selectedItem.result.format as "9:16" | "4:5" | "1:1"}
                          initialY={initialHeadlineY}
                          disabled={detailLoading}
                          onApply={handleReposition}
                          onChange={(y, scale, bY, bScale) => updateItem(selectedItemId!, { headlineY: y, headlineFontScale: scale, ...(bY !== undefined ? { brandNameY: bY } : {}), ...(bScale !== undefined ? { brandNameFontScale: bScale } : {}) })}
                          brandName={showBrand ? BRAND_NAME : undefined}
                          initialBrandY={selectedItem.brandNameY ?? selectedItem.result?.brandNameY}
                          initialBrandFontScale={selectedItem.brandNameFontScale ?? selectedItem.result?.brandNameFontScale}
                          headlineFont={selectedItem.headlineFont ?? "Playfair Display"}
                        />
                      ) : (
                        <img
                          ref={adImgRef}
                          src={selectedItem.result.pngUrl}
                          alt="Generated ad"
                          className={"max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl transition-opacity duration-200 " + (detailLoading ? "opacity-30" : "opacity-100")}
                        />
                      )}
                    </div>
                  ) : (
                    <img
                      src={selectedItem.previewUrl}
                      alt=""
                      className="max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl opacity-40"
                      style={{ aspectRatio: "9/16" }}
                    />
                  )}
                  {!selectedItem.result && selectedItem.status === "analyzed" && !detailLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                      <p className="text-xs text-gray-500">Rendering ad…</p>
                    </div>
                  )}
                  {detailLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                    </div>
                  )}
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

                {/* Action bar */}
                {selectedItem.result && (
                  <div className="shrink-0 border-t border-white/[0.06] px-6 py-3 flex items-center gap-3">
                    <button
                      onClick={async () => {
                        if (!selectedItem.result) return;
                        if (!selectedItem.approved) {
                          // Auto-render with current headline position, then approve
                          const y = selectedItem.headlineY ?? initialHeadlineY;
                          const scale = selectedItem.headlineFontScale ?? selectedItem.result.headlineFontScale ?? 1.0;
                          const bY = selectedItem.brandNameY ?? selectedItem.result.brandNameY;
                          const bScale = selectedItem.brandNameFontScale ?? selectedItem.result.brandNameFontScale;
                          const newId = await handleReposition(y, scale, bY, bScale);
                          await handleApprove(selectedItem.id, newId ?? selectedItem.result.id, true);
                        } else {
                          await handleApprove(selectedItem.id, selectedItem.result.id, false);
                        }
                      }}
                      disabled={detailLoading}
                      className={"flex-1 rounded-xl border py-3 text-sm font-medium transition disabled:opacity-40 flex items-center justify-center gap-2 " + (selectedItem.approved ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-emerald-500/30 hover:text-emerald-400")}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {selectedItem.approved ? "Approved" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleDownload(selectedItem.result!.pngUrl, selectedItem)}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm text-gray-400 hover:bg-white/[0.08] hover:text-white transition flex items-center justify-center gap-2"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                      </svg>
                      Download
                    </button>
                  </div>
                )}
              </>
              )}
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
                  {selectedItem.status === "uploading" ? "Uploading..."
                    : selectedItem.status === "generating" ? "Generating..."
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
