"use client";

import { useState, useCallback } from "react";

type UploadedImage = {
  imageId: string;
  url: string;
  width: number;
  height: number;
};

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

const FAMILY_LABELS: Record<FamilyId, string> = {
  promo: "Promo",
  testimonial: "Testimonial",
  minimal: "Minimal",
  luxury: "Luxury",
};

const STYLE_LABELS: Record<string, string> = {
  boxed_text: "Boxed",
  quote_card: "Quote",
  star_review: "Stars",
  luxury_minimal_center: "Minimal",
  luxury_editorial_left: "Editorial",
  luxury_soft_frame: "Frame",
  luxury_soft_frame_open: "Frame Open",
};

export default function Home() {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-image state
  const [selectedFamilies, setSelectedFamilies] = useState<FamilyId[]>([
    "promo",
    "testimonial",
  ]);
  const [lastGeneratedFamilies, setLastGeneratedFamilies] = useState<FamilyId[]>([]);
  const [selectedLang, setSelectedLang] = useState<Language>("en");
  const [selectedFormat, setSelectedFormat] = useState<Format>("4:5");
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [results, setResults] = useState<RenderResultItem[]>([]);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [allStylesMode, setAllStylesMode] = useState(false);
  const [lastAllStylesMode, setLastAllStylesMode] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  // ── Upload ────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResults([]);
    setLastGeneratedFamilies([]);
    setExpandedFamily(null);

    const formData = new FormData();
    formData.append("file", file);
    if (image?.url) formData.append("previousImageUrl", image.url);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data: UploadedImage = await res.json();
      setImage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!image || generating) return;
    setGenerating(true);
    setError(null);
    setResults([]);

    const steps = [
      "Analyzing image...",
      "Finding safe zones...",
      "Generating headlines...",
      "Rendering creatives...",
    ];
    let stepIdx = 0;
    setGenStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) setGenStep(steps[stepIdx]);
    }, 800);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: image.imageId,
          imageUrl: image.url,
          imageWidth: image.width,
          imageHeight: image.height,
          familyIds: selectedFamilies,
          lang: selectedLang,
          format: selectedFormat,
          showAllStyles: allStylesMode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResults(data.results);
      setLastGeneratedFamilies([...selectedFamilies]);
      setLastAllStylesMode(allStylesMode);
      setExpandedFamily(data.results[0]?.familyId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      clearInterval(stepInterval);
      setGenStep(null);
      setGenerating(false);
    }
  }, [image, generating, selectedFamilies, selectedLang, selectedFormat]);

  // ── Switch (lang/format view filter) ─────────────────────
  const handleSwitch = useCallback(
    async (resultIds: string[], lang?: Language, format?: Format) => {
      setSwitching(true);
      setError(null);
      try {
        const res = await fetch("/api/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultIds, lang, format }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Switch failed");
        }
        const data = await res.json();
        setResults((prev) => {
          let next = [...prev];
          for (const item of data.results) {
            next = next.map((r) =>
              r.id === item.replacedId ? item.result : r
            );
          }
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Switch failed");
      } finally {
        setSwitching(false);
      }
    },
    []
  );

  // ── Approve ───────────────────────────────────────────────
  const handleApprove = useCallback(
    async (resultId: string, approved: boolean) => {
      try {
        const res = await fetch("/api/approve", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId, approved }),
        });
        if (!res.ok) return;

        setResults((prev) =>
          prev.map((r) => (r.id === resultId ? { ...r, approved } : r))
        );
      } catch {
        // silent fail for approval toggle
      }
    },
    []
  );

  // ── Regenerate ─────────────────────────────────────────────
  const handleRegenerate = useCallback(
    async (resultId: string, mode: "headline" | "style") => {
      setRegeneratingId(resultId);
      try {
        const res = await fetch("/api/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultId, mode }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Regeneration failed");
        }
        const data = await res.json();
        setResults((prev) =>
          prev.map((r) => (r.id === data.replacedId ? data.result : r))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Regeneration failed");
      } finally {
        setRegeneratingId(null);
      }
    },
    []
  );

  // ── Download ──────────────────────────────────────────────
  const handleDownload = useCallback(async (pngUrl: string, id: string) => {
    const res = await fetch(pngUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ad-${id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Family toggle (multi-select) ─────────────────────────
  const toggleFamily = (id: FamilyId) => {
    setSelectedFamilies((prev: FamilyId[]) =>
      prev.includes(id) ? prev.filter((f: FamilyId) => f !== id) : [...prev, id]
    );
  };

  // ── Language select (single-select + auto-switch) ─────────
  const selectLang = (lang: Language) => {
    if (lang === selectedLang) return;
    setSelectedLang(lang);
    if (results.length > 0) {
      handleSwitch(results.map((r) => r.id), lang, undefined);
    }
  };

  // ── Format select (single-select + auto-switch) ──────────
  const selectFormat = (format: Format) => {
    if (format === selectedFormat) return;
    setSelectedFormat(format);
    if (results.length > 0) {
      handleSwitch(results.map((r) => r.id), undefined, format);
    }
  };

  const familiesChanged =
    [...selectedFamilies].sort().join() !== [...lastGeneratedFamilies].sort().join();
  const modeChanged = allStylesMode !== lastAllStylesMode;
  const canGenerate =
    !!image && !generating && selectedFamilies.length > 0 && (results.length === 0 || familiesChanged || modeChanged);

  // ── Pill style helper ─────────────────────────────────────
  const pillActive =
    "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]";
  const pillInactive =
    "bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300";

  // ── Family grouping ───────────────────────────────────────
  const familiesInResults = [...new Set(results.map((r) => r.familyId))];
  const resultsByFamily: Record<string, RenderResultItem[]> = {};
  for (const f of familiesInResults) {
    resultsByFamily[f] = results.filter((r) => r.familyId === f);
  }

  // ── Pile renderer ─────────────────────────────────────────
  const pileStyles = [
    { rotate: 0,  tx: 0,  ty: 0,  z: 3 },
    { rotate: -4, tx: -5, ty: 5,  z: 2 },
    { rotate: -8, tx: -10, ty: 10, z: 1 },
  ];

  const renderPile = (familyId: string) => {
    const cards = resultsByFamily[familyId] ?? [];
    const isExpanded = expandedFamily === familyId;
    const preview = cards.slice(0, 3);

    return (
      <button
        key={familyId}
        onClick={() => setExpandedFamily(isExpanded ? null : familyId)}
        className="flex flex-col items-center gap-3 group focus:outline-none"
      >
        {/* Stacked card deck */}
        <div className="relative" style={{ width: 148, height: 196 }}>
          {preview.map((card, idx) => {
            const s = pileStyles[idx] ?? pileStyles[pileStyles.length - 1];
            return (
              <div
                key={card.id}
                className={
                  "absolute rounded-xl border shadow-lg transition-all duration-200 " +
                  (isExpanded ? "border-indigo-500/40" : "border-white/15 group-hover:border-white/30")
                }
                style={{
                  top: 0,
                  left: 0,
                  width: 148,
                  height: 196,
                  transform: `rotate(${s.rotate}deg) translate(${s.tx}px, ${s.ty}px)`,
                  zIndex: s.z,
                  backgroundImage: `url(${card.pngUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: "#1a1f28",
                }}
              />
            );
          })}
          {/* Glow ring when expanded */}
          {isExpanded && (
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                zIndex: 4,
                boxShadow: "0 0 0 2px rgba(99,102,241,0.6), 0 0 24px rgba(99,102,241,0.2)",
              }}
            />
          )}
        </div>

        {/* Label */}
        <div className="text-center space-y-0.5">
          <p className={
            "text-sm font-semibold transition " +
            (isExpanded
              ? "text-indigo-300"
              : "text-white group-hover:text-indigo-300")
          }>
            {FAMILY_LABELS[familyId as FamilyId] ?? familyId}
          </p>
          <p className="text-xs text-gray-600">
            {cards.length} style{cards.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Chevron indicator */}
        <svg
          className={"h-4 w-4 transition-transform " + (isExpanded ? "rotate-180 text-indigo-400" : "text-gray-600 group-hover:text-gray-400")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  };

  // ── Card renderer ─────────────────────────────────────────
  const renderCard = (result: RenderResultItem) => (
    <div
      key={result.id}
      className={
        "overflow-hidden rounded-2xl transition backdrop-blur-md " +
        (result.approved
          ? "ring-2 ring-indigo-500/40 bg-white/[0.08] shadow-[0_0_20px_rgba(99,102,241,0.1)]"
          : "border border-white/10 bg-white/[0.06]")
      }
    >
      <div className="relative">
        <img
          src={result.pngUrl}
          alt="Generated ad"
          className={"w-full transition " + (regeneratingId === result.id ? "opacity-40" : "")}
        />
        {regeneratingId === result.id && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex gap-1.5 flex-wrap">
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
            {FAMILY_LABELS[result.familyId as FamilyId] ?? result.familyId}
          </span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
            {STYLE_LABELS[result.templateId] ?? result.templateId}
          </span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
            {result.format || "4:5"}
          </span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
            {selectedLang.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleRegenerate(result.id, "headline")}
            disabled={regeneratingId === result.id}
            className="rounded-lg bg-white/5 border border-white/5 px-2 py-1 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300 hover:border-white/10 transition disabled:opacity-30"
          >
            New headline
          </button>
          <button
            onClick={() => handleRegenerate(result.id, "style")}
            disabled={regeneratingId === result.id}
            className="rounded-lg bg-white/5 border border-white/5 px-2 py-1 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300 hover:border-white/10 transition disabled:opacity-30"
          >
            New style
          </button>
          {result.approved && (
            <button
              onClick={() => handleDownload(result.pngUrl, result.id)}
              className="rounded-lg px-2 py-1 text-[10px] font-medium bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white transition"
              title="Download"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleApprove(result.id, !result.approved)}
            className={
              "rounded-lg px-3 py-1 text-xs font-medium border transition " +
              (result.approved
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                : "bg-white/5 text-gray-400 border-white/10 hover:border-indigo-500/30 hover:text-indigo-300")
            }
          >
            {result.approved ? "Approved" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0F14] flex">
      {/* ── Left sidebar (working area) ─────────────────── */}
      <aside className="w-[340px] shrink-0 border-r border-white/10 p-5 space-y-5 overflow-y-auto h-screen sticky top-0">
        {/* Header */}
        <div>
          <h1 className="mb-1 text-xl font-bold text-white">AI Ad Agent</h1>
          <p className="text-[11px] text-gray-500">
            Upload a photo, choose options, generate ads
          </p>
        </div>

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={
            "flex flex-col items-center justify-center rounded-2xl border border-dashed p-6 transition backdrop-blur-md " +
            (uploading
              ? "border-indigo-500/40 bg-indigo-500/10"
              : image
                ? "border-white/10 bg-white/[0.06]"
                : "border-white/20 bg-white/[0.04] hover:border-indigo-500/40 hover:bg-white/[0.08]")
          }
        >
          {image ? (
            <div className="flex w-full items-center gap-3">
              <img
                src={image.url}
                alt="Product"
                className="h-20 w-20 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">Product image</p>
                <p className="text-xs text-gray-500">
                  {image.width} x {image.height}
                </p>
              </div>
              <label className="cursor-pointer shrink-0 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-300 transition">
                Replace
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          ) : uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              <p className="text-sm text-indigo-300">Uploading...</p>
            </div>
          ) : (
            <>
              <svg
                className="mb-3 h-8 w-8 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16v-8m0 0l-3 3m3-3l3 3M6.75 20.25h10.5A2.25 2.25 0 0019.5 18V8.25a2.25 2.25 0 00-2.25-2.25H15l-1.5-1.5h-3L9 6H6.75A2.25 2.25 0 004.5 8.25V18a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <p className="text-sm text-gray-400">
                Drop image or{" "}
                <label className="cursor-pointer font-medium text-indigo-400 hover:text-indigo-300">
                  browse
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </label>
              </p>
              <p className="mt-1 text-[10px] text-gray-600">PNG, JPG, or WebP</p>
            </>
          )}
        </div>

        {/* Controls (visible after upload) */}
        {image && (
          <div className="space-y-4">
            {/* Families (multi-select) */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Families
              </h3>
              <div className="flex flex-wrap gap-2">
                {(["promo", "testimonial", "luxury"] as FamilyId[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => toggleFamily(id)}
                    className={
                      "rounded-xl px-3 py-2 text-xs font-medium border transition " +
                      (selectedFamilies.includes(id) ? pillActive : pillInactive)
                    }
                  >
                    {FAMILY_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            {/* View mode */}
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Style view
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setAllStylesMode(false)}
                  className={
                    "rounded-xl px-3 py-2 text-xs font-medium border transition " +
                    (!allStylesMode ? pillActive : pillInactive)
                  }
                >
                  1 per family
                </button>
                <button
                  onClick={() => setAllStylesMode(true)}
                  className={
                    "rounded-xl px-3 py-2 text-xs font-medium border transition " +
                    (allStylesMode ? pillActive : pillInactive)
                  }
                >
                  All styles
                </button>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={
                "w-full rounded-2xl px-6 py-2.5 text-sm font-medium transition " +
                (!canGenerate
                  ? "bg-indigo-500/20 text-indigo-300/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]")
              }
            >
              {generating ? "Generating..." : "Generate Ads"}
            </button>

            {/* Error */}
            {error && (
              <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </aside>

      {/* ── Right side (results grid) ──────────────────── */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Generation loading */}
        {generating && results.length === 0 && (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-sm text-gray-400">
                {genStep || "Starting..."}
              </p>
            </div>
          </div>
        )}

        {/* Album piles + expanded view */}
        {results.length > 0 && (
          <div className="relative">
            {/* Switching overlay */}
            {switching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                  <span className="text-sm text-indigo-300">Switching...</span>
                </div>
              </div>
            )}

            {/* Filter bar: Language (left) + Format (right) */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Lang</span>
                <div className="flex gap-1">
                  {(["en", "de", "fr", "es"] as Language[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => selectLang(l)}
                      disabled={switching}
                      className={
                        "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition disabled:opacity-50 " +
                        (selectedLang === l ? pillActive : pillInactive)
                      }
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {(["4:5", "1:1", "9:16"] as Format[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => selectFormat(f)}
                      disabled={switching}
                      className={
                        "rounded-lg px-2.5 py-1 text-[11px] font-medium border transition disabled:opacity-50 " +
                        (selectedFormat === f ? pillActive : pillInactive)
                      }
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Format</span>
              </div>
            </div>

            {/* Pile row — always visible */}
            <div className="flex gap-12 justify-center pb-4 mb-2">
              {familiesInResults.map((familyId) => renderPile(familyId))}
            </div>

            {/* Expanded section — slides in below piles */}
            {expandedFamily && resultsByFamily[expandedFamily] && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">
                      {FAMILY_LABELS[expandedFamily as FamilyId] ?? expandedFamily}
                    </h2>
                    <span className="rounded-md bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-400">
                      {resultsByFamily[expandedFamily].length} style{resultsByFamily[expandedFamily].length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedFamily(null)}
                    className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-300 transition"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                    Collapse
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resultsByFamily[expandedFamily].map((result) => renderCard(result))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!generating && results.length === 0 && (
          <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
            <p className="text-sm text-gray-600">
              {image
                ? "Select families and click Generate"
                : "Upload a product photo to get started"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
