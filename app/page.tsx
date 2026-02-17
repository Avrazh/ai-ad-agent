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
  templateId: string;
  headlineId: string;
  pngUrl: string;
  approved: boolean;
  createdAt: string;
};

type TemplateId = "boxed_text" | "chat_bubble";

export default function Home() {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTemplates, setSelectedTemplates] = useState<TemplateId[]>([
    "boxed_text",
    "chat_bubble",
  ]);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState<string | null>(null);
  const [results, setResults] = useState<RenderResultItem[]>([]);

  // ── Upload ────────────────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResults([]);

    const formData = new FormData();
    formData.append("file", file);

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

    // Simulate step progress
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
          templateIds: selectedTemplates,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      clearInterval(stepInterval);
      setGenStep(null);
      setGenerating(false);
    }
  }, [image, generating, selectedTemplates]);

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
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const handleRegenerate = useCallback(
    async (resultId: string, mode: "headline" | "template" | "both") => {
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

  // ── Download approved ─────────────────────────────────────
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

  // ── Template toggle ───────────────────────────────────────
  const toggleTemplate = (id: TemplateId) => {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const approvedCount = results.filter((r) => r.approved).length;

  return (
    <div className="min-h-screen bg-[#0B0F14] p-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-white">AI Ad Agent</h1>
            <p className="text-sm text-gray-500">
              Upload a product photo, choose templates, generate ad creatives
            </p>
          </div>
          {approvedCount > 0 && (
            <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 text-xs font-medium text-indigo-300">
              {approvedCount} approved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          {/* ── Left column: Controls ───────────────────── */}
          <div className="space-y-4">
            {/* Upload */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={
                "flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 transition backdrop-blur-md " +
                (uploading
                  ? "border-indigo-500/40 bg-indigo-500/10"
                  : image
                    ? "border-white/10 bg-white/[0.06]"
                    : "border-white/20 bg-white/[0.04] hover:border-indigo-500/40 hover:bg-white/[0.08]")
              }
            >
              {image ? (
                <div className="w-full">
                  <img
                    src={image.url}
                    alt="Product"
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: 200 }}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {image.width} x {image.height}
                    </span>
                    <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 transition">
                      Replace
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </label>
                  </div>
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

            {/* Template selection */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-4">
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Templates
              </h3>
              <div className="flex gap-2">
                {(
                  [
                    { id: "boxed_text" as TemplateId, label: "Boxed Text" },
                    { id: "chat_bubble" as TemplateId, label: "Chat Bubble" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTemplate(t.id)}
                    className={
                      "rounded-xl px-3 py-2 text-xs font-medium border transition " +
                      (selectedTemplates.includes(t.id)
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                        : "bg-white/5 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-300")
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!image || generating || selectedTemplates.length === 0}
              className={
                "w-full rounded-2xl px-4 py-3 text-sm font-medium transition " +
                (!image || generating || selectedTemplates.length === 0
                  ? "bg-indigo-500/20 text-indigo-300/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 shadow-[0_0_20px_rgba(99,102,241,0.25)]")
              }
            >
              {generating ? "Generating..." : "Generate Ads"}
            </button>

            {error && (
              <p className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>

          {/* ── Right column: Gallery ───────────────────── */}
          <div>
            {results.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-300">
                  Generated Ads
                </h2>
                <span className="text-xs text-gray-500">
                  {approvedCount} / {results.length} approved
                </span>
              </div>
            )}

            {generating && results.length === 0 && (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <p className="text-sm text-gray-400">
                    {genStep || "Starting..."}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={
                    "overflow-hidden rounded-2xl transition backdrop-blur-md " +
                    (result.approved
                      ? "ring-2 ring-indigo-500/40 bg-white/[0.08] shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                      : "border border-white/10 bg-white/[0.06]")
                  }
                >
                  {/* Image with loading overlay during regen */}
                  <div className="relative">
                    <img
                      src={result.pngUrl}
                      alt="Generated ad"
                      className={
                        "w-full transition " +
                        (regeneratingId === result.id ? "opacity-40" : "")
                      }
                    />
                    {regeneratingId === result.id && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                      </div>
                    )}
                  </div>

                  <div className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
                          {result.templateId === "boxed_text"
                            ? "Boxed"
                            : "Bubble"}
                        </span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
                          4:5
                        </span>
                      </div>
                      <div className="flex gap-1.5">
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
                          onClick={() =>
                            handleApprove(result.id, !result.approved)
                          }
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
                    {/* Regenerate buttons */}
                    <div className="flex gap-1.5">
                      {(
                        [
                          { mode: "headline" as const, label: "New headline" },
                          { mode: "template" as const, label: "Switch template" },
                          { mode: "both" as const, label: "Both" },
                        ] as const
                      ).map((action) => (
                        <button
                          key={action.mode}
                          onClick={() =>
                            handleRegenerate(result.id, action.mode)
                          }
                          disabled={regeneratingId === result.id}
                          className="rounded-lg bg-white/5 border border-white/5 px-2 py-1 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300 hover:border-white/10 transition disabled:opacity-30"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!generating && results.length === 0 && image && (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-sm text-gray-600">
                  Select templates and click Generate
                </p>
              </div>
            )}

            {!image && (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-sm text-gray-600">
                  Upload a product photo to get started
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
