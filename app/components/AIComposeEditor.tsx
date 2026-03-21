"use client";

import { useRef, useState, useCallback, useEffect } from "react";

type QueueThumb = {
  id: string;
  url: string;
  imageId: string;
};

type NodePos = { x: number; y: number };

type Props = {
  queueThumbs: QueueThumb[];
  onSave: (imageId: string, imageUrl: string) => void;
  onClose: () => void;
};

const DEFAULT_PROMPT = "";

const MAX_PX = 1024;
const JPEG_Q = 0.82;

// Resize + encode any image source to a small JPEG base64 string
function compressToBase64(img: HTMLImageElement): string {
  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > MAX_PX || h > MAX_PX) {
    if (w >= h) { h = Math.round((h * MAX_PX) / w); w = MAX_PX; }
    else        { w = Math.round((w * MAX_PX) / h); h = MAX_PX; }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", JPEG_Q).split(",")[1];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Convert file → compressed base64
async function fileToBase64(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return compressToBase64(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Convert image URL → compressed base64
async function urlToBase64(url: string): Promise<string> {
  const img = await loadImage(url);
  return compressToBase64(img);
}

export default function AIComposeEditor({ queueThumbs, onSave, onClose }: Props) {
  // Node positions (canvas-relative)
  const [posA, setPosA] = useState<NodePos>({ x: 60, y: 120 });
  const [posB, setPosB] = useState<NodePos>({ x: 60, y: 360 });
  const [posPrompt, setPosPrompt] = useState<NodePos>({ x: 360, y: 220 });
  const [posResult, setPosResult] = useState<NodePos>({ x: 660, y: 140 });

  // Image selections
  const [imageA, setImageA] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [imageB, setImageB] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<"A" | "B" | null>(null);

  // Prompt
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageId: string; imageUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag state
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ node: "A" | "B" | "prompt" | "result"; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Node drag handlers
  const onMouseDown = useCallback((node: "A" | "B" | "prompt" | "result", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = node === "A" ? posA : node === "B" ? posB : node === "prompt" ? posPrompt : posResult;
    dragging.current = { node, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [posA, posB, posPrompt, posResult]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      const dy = e.clientY - dragging.current.startY;
      const newPos = { x: dragging.current.origX + dx, y: dragging.current.origY + dy };
      if (dragging.current.node === "A") setPosA(newPos);
      else if (dragging.current.node === "B") setPosB(newPos);
      else if (dragging.current.node === "prompt") setPosPrompt(newPos);
      else setPosResult(newPos);
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Image loading
  const handleFileInput = useCallback(async (slot: "A" | "B", file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      if (slot === "A") setImageA({ base64, previewUrl });
      else setImageB({ base64, previewUrl });
    } catch {
      // silently ignore
    }
  }, []);

  const handleQueuePick = useCallback(async (slot: "A" | "B", thumb: QueueThumb) => {
    setPickerFor(null);
    try {
      const base64 = await urlToBase64(thumb.url);
      if (slot === "A") setImageA({ base64, previewUrl: thumb.url });
      else setImageB({ base64, previewUrl: thumb.url });
    } catch {
      // silently ignore
    }
  }, []);

  // Generation
  const handleGenerate = useCallback(async () => {
    if (!imageA || !imageB || generating) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageA: imageA.base64, imageB: imageB.base64, prompt }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Generation failed");
      setResult({ imageId: data.imageId, imageUrl: data.imageUrl });
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  }, [imageA, imageB, prompt, generating]);

  // Node dimensions
  const IMG_W = 130, IMG_H = 160;
  const PROMPT_W = 240, PROMPT_H = 200;
  const RESULT_W = 340, RESULT_H = 440;

  // Connection anchor points (center-right / center-left of nodes)
  const anchorARight = { x: posA.x + IMG_W, y: posA.y + IMG_H / 2 };
  const anchorBRight = { x: posB.x + IMG_W, y: posB.y + IMG_H / 2 };
  const anchorPromptLeft = { x: posPrompt.x, y: posPrompt.y + PROMPT_H / 2 };
  const anchorPromptRight = { x: posPrompt.x + PROMPT_W, y: posPrompt.y + PROMPT_H / 2 };
  const anchorResultLeft = { x: posResult.x, y: posResult.y + RESULT_H / 2 };

  function bezier(from: NodePos, to: NodePos) {
    const cx = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${cx} ${from.y}, ${cx} ${to.y}, ${to.x} ${to.y}`;
  }

  // File drop handling
  const handleDrop = useCallback((slot: "A" | "B", e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileInput(slot, file);
  }, [handleFileInput]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#080b0f]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span className="text-indigo-400 text-lg">✦</span>
          <span className="text-sm font-semibold text-white">AI Creative Layout</span>
          <span className="text-[11px] text-gray-500 ml-1">Image A = reference layout · Image B = your product</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/[0.08] hover:border-white/20 transition"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Exit Studio
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ background: "radial-gradient(ellipse at 30% 50%, #0d1020 0%, #080b0f 100%)" }}
      >
        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* A → Prompt */}
          <path d={bezier(anchorARight, anchorPromptLeft)} fill="none" stroke="#6366f1" strokeWidth="2" strokeOpacity="0.5" filter="url(#glow)" />
          <circle cx={anchorARight.x} cy={anchorARight.y} r="4" fill="#6366f1" opacity="0.8" />
          <circle cx={anchorPromptLeft.x} cy={anchorPromptLeft.y} r="4" fill="#6366f1" opacity="0.8" />

          {/* B → Prompt */}
          <path d={bezier(anchorBRight, anchorPromptLeft)} fill="none" stroke="#6366f1" strokeWidth="2" strokeOpacity="0.5" filter="url(#glow)" />
          <circle cx={anchorBRight.x} cy={anchorBRight.y} r="4" fill="#6366f1" opacity="0.8" />

          {/* Prompt → Result */}
          <path d={bezier(anchorPromptRight, anchorResultLeft)} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeOpacity={generating ? "0.9" : "0.5"} strokeDasharray={generating ? "6 4" : "none"} filter="url(#glow)">
            {generating && (
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.5s" repeatCount="indefinite" />
            )}
          </path>
          <circle cx={anchorPromptRight.x} cy={anchorPromptRight.y} r="4" fill="#8b5cf6" opacity="0.8" />
          <circle cx={anchorResultLeft.x} cy={anchorResultLeft.y} r="4" fill="#8b5cf6" opacity="0.8" />
        </svg>

        {/* ── Node A ── */}
        <ImageNode
          label="A · Reference Layout"
          pos={posA}
          w={IMG_W}
          h={IMG_H}
          image={imageA}
          onDragStart={(e) => onMouseDown("A", e)}
          onDrop={(e) => handleDrop("A", e)}
          onDragOver={(e) => e.preventDefault()}
          onPickClick={() => setPickerFor("A")}
          onFileInput={(f) => handleFileInput("A", f)}
        />

        {/* ── Node B ── */}
        <ImageNode
          label="B · Your Product"
          pos={posB}
          w={IMG_W}
          h={IMG_H}
          image={imageB}
          onDragStart={(e) => onMouseDown("B", e)}
          onDrop={(e) => handleDrop("B", e)}
          onDragOver={(e) => e.preventDefault()}
          onPickClick={() => setPickerFor("B")}
          onFileInput={(f) => handleFileInput("B", f)}
        />

        {/* ── Prompt Node ── */}
        <div
          className="absolute"
          style={{ left: posPrompt.x, top: posPrompt.y, width: PROMPT_W, zIndex: 10 }}
        >
          <div
            className="rounded-xl border border-indigo-500/30 bg-[#0d1117] overflow-hidden shadow-xl cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => onMouseDown("prompt", e)}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-indigo-500/10">
              <span className="text-indigo-400 text-xs">⚙</span>
              <span className="text-[11px] font-semibold text-indigo-300">Prompt</span>
            </div>
            <div className="p-2" onMouseDown={(e) => e.stopPropagation()}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-gray-300 p-2 resize-none focus:outline-none focus:border-indigo-500/50"
                rows={5}
                placeholder="Optional: extra creative direction (e.g. 'make it darker', 'add a gold border')"
              />
              <button
                onClick={handleGenerate}
                disabled={!imageA || !imageB || generating}
                className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: (!imageA || !imageB || generating) ? undefined : "linear-gradient(135deg, #6366f1, #8b5cf6)", backgroundColor: (!imageA || !imageB || generating) ? "#1e1e2e" : undefined, color: "white" }}
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3 w-3 rounded-full border border-indigo-400/50 border-t-transparent animate-spin inline-block" />
                    Generating…
                  </span>
                ) : "✦ Generate"}
              </button>
              {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
            </div>
          </div>
        </div>

        {/* ── Result Node ── */}
        <div
          className="absolute"
          style={{ left: posResult.x, top: posResult.y, width: RESULT_W, zIndex: 10 }}
        >
          <div
            className="rounded-xl border border-purple-500/30 bg-[#0d1117] overflow-hidden shadow-xl cursor-grab active:cursor-grabbing"
            onMouseDown={(e) => onMouseDown("result", e)}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-purple-500/10">
              <span className="text-purple-400 text-xs">✦</span>
              <span className="text-[11px] font-semibold text-purple-300">Result</span>
            </div>
            <div className="p-2" onMouseDown={(e) => e.stopPropagation()}>
              <div
                className="rounded-lg overflow-hidden flex items-center justify-center"
                style={{ width: RESULT_W - 16, height: Math.round((RESULT_W - 16) * (16 / 9)), background: "#0a0a14" }}
              >
                {generating ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-5 rounded-full border-2 border-purple-400/50 border-t-transparent animate-spin" />
                    <span className="text-[9px] text-gray-500">Generating…</span>
                  </div>
                ) : result ? (
                  <img src={result.imageUrl} alt="result" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-600">Output</span>
                )}
              </div>
              {result && (
                <button
                  onClick={() => onSave(result.imageId, result.imageUrl)}
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
                >
                  Save to Queue
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hint */}
        {!imageA && !imageB && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-gray-600 pointer-events-none">
            Drag nodes to reposition · click a node to load an image from your queue or drop a file
          </div>
        )}
      </div>

      {/* Queue picker modal */}
      {pickerFor && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPickerFor(null)}
        >
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#0d1117] p-5 w-[380px] max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white">Pick image for {pickerFor === "A" ? "Node A" : "Node B"}</span>
              <button onClick={() => setPickerFor(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
            </div>

            {queueThumbs.length > 0 ? (
              <>
                <p className="text-[11px] text-gray-500 mb-3">From queue:</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {queueThumbs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleQueuePick(pickerFor, t)}
                      className="rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500/70 transition aspect-square"
                    >
                      <img src={t.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-gray-500 mb-4">No images in queue yet.</p>
            )}

            <p className="text-[11px] text-gray-500 mb-2">Or upload a file:</p>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] py-3 cursor-pointer hover:border-indigo-500/50 transition text-[11px] text-gray-400">
              <span>📁</span> Choose file
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { handleFileInput(pickerFor, file); setPickerFor(null); }
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ImageNode sub-component ──────────────────────────────────────────────────

type ImageNodeProps = {
  label: string;
  pos: NodePos;
  w: number;
  h: number;
  image: { base64: string; previewUrl: string } | null;
  onDragStart: (e: React.MouseEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onPickClick: () => void;
  onFileInput: (f: File) => void;
};

function ImageNode({ label, pos, w, h, image, onDragStart, onDrop, onDragOver, onPickClick, onFileInput }: ImageNodeProps) {
  const HEADER_H = 30;
  const CONTENT_H = h - HEADER_H;

  return (
    <div
      className="absolute"
      style={{ left: pos.x, top: pos.y, width: w, zIndex: 10 }}
    >
      <div
        className="rounded-xl border border-white/[0.1] bg-[#0d1117] overflow-hidden shadow-xl cursor-grab active:cursor-grabbing"
        onMouseDown={onDragStart}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="flex items-center gap-2 px-3 border-b border-white/[0.06] bg-white/[0.03]" style={{ height: HEADER_H }}>
          <span className="text-gray-500 text-[10px]">⬛</span>
          <span className="text-[11px] font-semibold text-gray-300">{label}</span>
        </div>
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{ height: CONTENT_H, background: "#09090f" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {image ? (
            <>
              <img src={image.previewUrl} alt={label} className="w-full h-full object-cover" />
              <button
                onClick={onPickClick}
                className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-[9px] text-gray-300 hover:bg-black/90 transition"
              >
                Change
              </button>
            </>
          ) : (
            <button
              onClick={onPickClick}
              className="flex flex-col items-center gap-1.5 text-gray-600 hover:text-gray-400 transition"
            >
              <span className="text-2xl">+</span>
              <span className="text-[10px]">Load image</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
