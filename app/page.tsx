"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type RenderResultItem = {
  id: string;
  adSpecId: string;
  imageId: string;
  familyId: string;
  templateId: string;
  headlineId: string;
  format: string;
  pngUrl: string;
  approved: boolean;
  createdAt: string;
};

type FamilyId = "promo" | "testimonial" | "minimal" | "luxury";
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
  status: "idle" | "uploading" | "generating" | "done" | "error";
  result?: RenderResultItem;
  usedFamilyId?: FamilyId;
  approved: boolean;
  error?: string;
};

const FAMILY_LABELS: Record<FamilyId, string> = {
  promo: "Promo",
  testimonial: "Testimonial",
  minimal: "Minimal",
  luxury: "Luxury",
};

const ALL_TEMPLATES: { familyId: FamilyId; templateId: string; label: string }[] = [
  { familyId: "promo",       templateId: "boxed_text",             label: "Boxed" },
  { familyId: "testimonial", templateId: "quote_card",             label: "Quote" },
  { familyId: "testimonial", templateId: "star_review",            label: "Stars" },
  { familyId: "luxury",      templateId: "luxury_minimal_center",  label: "Minimal" },
  { familyId: "luxury",      templateId: "luxury_editorial_left",  label: "Editorial" },
  { familyId: "luxury",      templateId: "luxury_soft_frame",      label: "Frame" },
  { familyId: "luxury",      templateId: "luxury_soft_frame_open", label: "Frame Open" },
];

const FAMILIES_IN_ORDER: FamilyId[] = ["promo", "testimonial", "luxury"];

let _itemCounter = 0;
function newItemId() {
  return `qi-${++_itemCounter}`;
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
  if (status === "uploading" || status === "generating")
    return <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />;
  return <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" />;
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [selectedFormat, setSelectedFormat] = useState<Format>("4:5");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // ── File handling ───────────────────────────────────────
  const handleFiles = useCallback((files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

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
  }, []);

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
    const lang = selectedLang;
    const format = selectedFormat;

    for (const item of itemsToProcess) {
      try {
        updateItem(item.id, { status: "uploading" });
        const form = new FormData();
        form.append("file", item.file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        if (!uploadRes.ok) {
          const d = await uploadRes.json();
          throw new Error(d.error || "Upload failed");
        }
        const uploaded = await uploadRes.json();

        updateItem(item.id, {
          status: "generating",
          imageId: uploaded.imageId,
          imageUrl: uploaded.url,
          imageWidth: uploaded.width,
          imageHeight: uploaded.height,
        });
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: uploaded.imageId,
            imageUrl: uploaded.url,
            imageWidth: uploaded.width,
            imageHeight: uploaded.height,
            autoFamily: true,
            excludeStyleIds: usedStyleIdsRef.current,
            lang,
            format,
          }),
        });
        if (!genRes.ok) {
          const d = await genRes.json();
          throw new Error(d.error || "Generation failed");
        }
        const genData = await genRes.json();
        const result: RenderResultItem = genData.results[0];

        usedStyleIdsRef.current = [...usedStyleIdsRef.current, result.templateId];
        updateItem(item.id, {
          status: "done",
          result,
          usedFamilyId: result.familyId as FamilyId,
        });
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    setProcessing(false);
  }, [processing, queue, selectedLang, selectedFormat, updateItem]);

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

  // Convenience wrappers used by the three control types in the detail panel
  const handleStyleChange = useCallback(
    (item: QueueItem, templateId: string) =>
      handleRerender(item, templateId, selectedLang, selectedFormat),
    [handleRerender, selectedLang, selectedFormat]
  );

  const handleLangChange = useCallback(
    (lang: Language) => {
      setSelectedLang(lang);
      const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
      if (item?.result) {
        handleRerender(item, item.result.templateId, lang, selectedFormat);
      }
    },
    [handleRerender, selectedFormat]
  );

  const handleFormatChange = useCallback(
    (format: Format) => {
      setSelectedFormat(format);
      const item = queueRef.current.find((i) => i.id === selectedItemIdRef.current);
      if (item?.result) {
        handleRerender(item, item.result.templateId, selectedLang, format);
      }
    },
    [handleRerender, selectedLang]
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
      <div className="w-[300px] shrink-0 flex flex-col border-r border-white/[0.06] overflow-hidden">

        {/* Title */}
        <div className="shrink-0 px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <h1 className="text-sm font-bold text-white tracking-tight">AI Ad Agent</h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            AI picks best template · visual diversity guaranteed
          </p>
        </div>

        {/* Drop zone — always visible, Choose Folder inside */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={
            "shrink-0 mx-3 mt-3 rounded-xl border border-dashed transition " +
            (queue.length > 0
              ? "border-white/10 bg-white/[0.02] px-3 py-3"
              : "border-white/15 bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.04] px-3 py-5 cursor-pointer")
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
              <span className="text-[11px] text-gray-400 flex-1">
                {queue.length} image{queue.length !== 1 ? "s" : ""}
              </span>
              {!processing && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                    className="text-[10px] text-gray-600 hover:text-indigo-400 transition"
                  >
                    Change
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQueue((prev) => {
                        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                        return [];
                      });
                      usedStyleIdsRef.current = [];
                      setSelectedItemId(null);
                    }}
                    className="text-[10px] text-gray-600 hover:text-red-400 transition"
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
              <p className="text-[11px] text-gray-500">
                Drop images or click to choose a folder
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
        <div className="shrink-0 px-3 py-2">
          <button
            onClick={handleGenerateAll}
            disabled={processing || idleCount === 0}
            className={
              "w-full rounded-xl py-2 text-[12px] font-semibold transition " +
              (processing || idleCount === 0
                ? "bg-indigo-500/15 text-indigo-400/50 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.25)]")
            }
          >
            {processing
              ? `Processing ${activeIndex + 1} of ${queue.length}...`
              : idleCount > 0
                ? `Generate All (${idleCount})`
                : "Generate All"}
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
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition border-l-2 " +
                    (selectedItemId === item.id
                      ? "bg-indigo-500/[0.08] border-indigo-500/60"
                      : "hover:bg-white/[0.03] border-transparent")
                  }
                >
                  <StatusIcon status={item.status} />
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover shrink-0 border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12px] text-gray-300 leading-tight">
                      {item.file.name}
                    </p>
                    <p className="text-[10px] mt-0.5">
                      {item.status === "uploading" && (
                        <span className="text-indigo-400">Uploading...</span>
                      )}
                      {item.status === "generating" && (
                        <span className="text-indigo-400">Generating...</span>
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

      </div>

      {/* ── Download All Approved — fixed top-right ─────── */}
      {approvedCount > 0 && !processing && (
        <button
          onClick={handleDownloadAll}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-[11px] font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:from-indigo-400 hover:to-violet-400 transition"
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
            <div className="shrink-0 px-6 py-3 border-b border-white/[0.06] text-center">
              <p className="text-[13px] font-medium text-gray-200 truncate">
                {selectedItem.file.name}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {selectedIdx + 1} of {queue.length}
              </p>
            </div>

            {/* Main content */}
            {selectedItem.status === "done" && selectedItem.result ? (
              <div className="flex-1 flex overflow-hidden">

                {/* Ad image — takes up most of the space */}
                <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
                  <img
                    src={selectedItem.result.pngUrl}
                    alt="Generated ad"
                    className={
                      "max-h-full max-w-full rounded-2xl border border-white/10 object-contain shadow-2xl transition-opacity duration-200 " +
                      (detailLoading ? "opacity-30" : "opacity-100")
                    }
                  />
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

                {/* Controls sidebar — right side of right panel */}
                <div className="w-[220px] shrink-0 flex flex-col border-l border-white/[0.06] overflow-y-auto">
                  <div className="p-4 space-y-5">

                    {/* Lang */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
                        Language
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(["en", "de", "fr", "es"] as Language[]).map((l) => (
                          <button
                            key={l}
                            onClick={() => handleLangChange(l)}
                            disabled={detailLoading}
                            className={
                              "rounded px-2 py-1 text-[10px] font-medium border transition disabled:opacity-40 " +
                              (selectedLang === l ? pillActive : pillInactive)
                            }
                          >
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Format */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
                        Format
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(["4:5", "1:1", "9:16"] as Format[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => handleFormatChange(f)}
                            disabled={detailLoading}
                            className={
                              "rounded px-2 py-1 text-[10px] font-medium border transition disabled:opacity-40 " +
                              (selectedFormat === f ? pillActive : pillInactive)
                            }
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Style picker */}
                    <div className="space-y-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-600">
                        Style
                      </p>
                      {FAMILIES_IN_ORDER.map((familyId) => {
                        const familyTemplates = ALL_TEMPLATES.filter(
                          (t) => t.familyId === familyId
                        );
                        return (
                          <div key={familyId} className="space-y-1">
                            <p className="text-[9px] text-gray-700">
                              {FAMILY_LABELS[familyId]}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {familyTemplates.map((t) => (
                                <button
                                  key={t.templateId}
                                  onClick={() =>
                                    handleStyleChange(selectedItem, t.templateId)
                                  }
                                  disabled={detailLoading}
                                  className={
                                    "rounded-lg border px-2 py-1 text-[10px] font-medium transition disabled:opacity-40 " +
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
                    </div>

                    <div className="border-t border-white/[0.06]" />

                    {/* Actions */}
                    <div className="space-y-2">
                      <button
                        onClick={() => handleNewHeadline(selectedItem)}
                        disabled={detailLoading}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
                      >
                        New Headline
                      </button>
                      <button
                        onClick={() =>
                          handleApprove(
                            selectedItem.id,
                            selectedItem.result!.id,
                            !selectedItem.approved
                          )
                        }
                        disabled={detailLoading}
                        className={
                          "w-full rounded-xl border py-2 text-[11px] font-medium transition disabled:opacity-40 " +
                          (selectedItem.approved
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : "border-white/10 bg-white/5 text-gray-400 hover:border-emerald-500/30 hover:text-emerald-400")
                        }
                      >
                        {selectedItem.approved ? "✓ Approved" : "Approve"}
                      </button>
                      <button
                        onClick={() =>
                          handleDownload(
                            selectedItem.result!.pngUrl,
                            selectedItem.result!.id
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-[11px] text-gray-400 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-1.5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                        </svg>
                        Download PNG
                      </button>
                    </div>

                    {/* Original photo */}
                    <div className="border-t border-white/[0.06] pt-3">
                      <p className="text-[9px] text-gray-700 mb-1.5">Original</p>
                      <img
                        src={selectedItem.previewUrl}
                        alt="Original"
                        className="w-full rounded-lg object-cover border border-white/10 opacity-60"
                      />
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
                    : selectedItem.status === "generating"
                      ? "Generating..."
                      : "Waiting to start..."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
