"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export type SplitConfig = {
  secondImageId: string;
  secondImageUrl: string;
  dividerX: number;
  productPanX: number;
  secondPanX: number;
  swapped: boolean;
};

type QueueThumb = {
  id: string;
  url: string;
};

type Props = {
  productImageUrl: string;
  productImageId: string;
  queueThumbs: QueueThumb[];
  config: SplitConfig | null;
  onConfigChange: (cfg: SplitConfig) => void;
  onRender: (cfg: SplitConfig) => void;
  rendering?: boolean;
};

const DEFAULT_CONFIG = (sid: string, surl: string): SplitConfig => ({
  secondImageId: sid,
  secondImageUrl: surl,
  dividerX: 0.5,
  productPanX: 0.5,
  secondPanX: 0.5,
  swapped: false,
});

export default function SplitSceneEditor({
  productImageUrl,
  productImageId,
  queueThumbs,
  config,
  onConfigChange,
  onRender,
  rendering = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const draggingDivider = useRef(false);
  const draggingPanel = useRef<"product" | "second" | null>(null);
  const dragStartX = useRef(0);
  const dragStartPan = useRef(0);

  const cfg = config;

  const setConfig = useCallback(
    (patch: Partial<SplitConfig>) => {
      if (!cfg) return;
      onConfigChange({ ...cfg, ...patch });
    },
    [cfg, onConfigChange]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (draggingDivider.current && cfg) {
        const nx = Math.max(0.15, Math.min(0.85, (e.clientX - rect.left) / rect.width));
        setConfig({ dividerX: nx });
      }
      if (draggingPanel.current && cfg) {
        const dx = e.clientX - dragStartX.current;
        const panelW =
          draggingPanel.current === "product"
            ? rect.width * (cfg.swapped ? 1 - cfg.dividerX : cfg.dividerX)
            : rect.width * (cfg.swapped ? cfg.dividerX : 1 - cfg.dividerX);
        const delta = -dx / panelW;
        const newPan = Math.max(0, Math.min(1, dragStartPan.current + delta));
        if (draggingPanel.current === "product") {
          setConfig({ productPanX: newPan });
        } else {
          setConfig({ secondPanX: newPan });
        }
      }
    };
    const onUp = () => {
      draggingDivider.current = false;
      draggingPanel.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [cfg, setConfig]);

  const handlePickSecond = (thumb: QueueThumb) => {
    const newCfg: SplitConfig = cfg
      ? { ...cfg, secondImageId: thumb.id, secondImageUrl: thumb.url }
      : DEFAULT_CONFIG(thumb.id, thumb.url);
    onConfigChange(newCfg);
    setPickerOpen(false);
  };

  const dividerX = cfg?.dividerX ?? 0.5;
  const swapped = cfg?.swapped ?? false;
  const leftPct = (dividerX * 100).toFixed(1) + "%";
  const rightPct = ((1 - dividerX) * 100).toFixed(1) + "%";

  const productImg = (
    <div
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => {
        if (!cfg) return;
        e.preventDefault();
        draggingPanel.current = "product";
        dragStartX.current = e.clientX;
        dragStartPan.current = cfg.productPanX;
      }}
    >
      <img
        src={productImageUrl}
        alt="Product"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ objectPosition: ((cfg?.productPanX ?? 0.5) * 100).toFixed(1) + "% 50%" }}
        draggable={false}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">
        Product
      </div>
    </div>
  );

  const secondImg = cfg?.secondImageId ? (
    <div
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => {
        if (!cfg) return;
        e.preventDefault();
        draggingPanel.current = "second";
        dragStartX.current = e.clientX;
        dragStartPan.current = cfg.secondPanX;
      }}
    >
      <img
        src={cfg.secondImageUrl}
        alt="Second"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ objectPosition: (cfg.secondPanX * 100).toFixed(1) + "% 50%" }}
        draggable={false}
      />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded pointer-events-none">
        Second
      </div>
      <button
        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setPickerOpen(true)}
      >
        Change
      </button>
    </div>
  ) : (
    <button
      className="flex flex-col items-center justify-center w-full h-full gap-2 text-white/40 hover:text-white/70 transition-colors"
      onClick={() => setPickerOpen(true)}
    >
      <span className="text-4xl leading-none">+</span>
      <span className="text-xs">Pick image</span>
    </button>
  );

  const leftPanel = swapped ? secondImg : productImg;
  const rightPanel = swapped ? productImg : secondImg;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div
        ref={containerRef}
        className="relative w-full bg-[#111] rounded-lg overflow-hidden select-none"
        style={{ aspectRatio: "9/16", maxHeight: "60vh" }}
      >
        <div className="absolute top-0 left-0 h-full" style={{ width: leftPct }}>
          {leftPanel}
        </div>
        <div className="absolute top-0 right-0 h-full" style={{ width: rightPct }}>
          {rightPanel}
        </div>
        <div
          className="absolute top-0 h-full flex items-center justify-center cursor-ew-resize z-10"
          style={{ left: "calc(" + leftPct + " - 10px)", width: 20 }}
          onMouseDown={(e) => {
            e.preventDefault();
            draggingDivider.current = true;
          }}
        >
          <div className="w-1 h-12 rounded-full bg-indigo-400 shadow-lg" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex-1 py-1.5 rounded-lg text-sm border border-white/20 text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => cfg && setConfig({ swapped: !cfg.swapped })}
          disabled={!cfg?.secondImageId}
          title="Swap panels"
        >
          Swap
        </button>
        <button
          className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!cfg?.secondImageId || rendering}
          onClick={() => cfg && onRender(cfg)}
        >
          {rendering ? "Rendering..." : "Render Ad"}
        </button>
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#1a1f2e] rounded-xl p-4 w-80 max-h-[70vh] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-sm">Pick second image</span>
              <button
                className="text-white/50 hover:text-white text-lg leading-none"
                onClick={() => setPickerOpen(false)}
              >
                x
              </button>
            </div>
            <div className="overflow-y-auto grid grid-cols-3 gap-2">
              {queueThumbs.length === 0 && (
                <p className="col-span-3 text-white/40 text-xs text-center py-4">
                  No other images loaded
                </p>
              )}
              {queueThumbs.map((thumb) => (
                <button
                  key={thumb.id}
                  className="aspect-square overflow-hidden rounded-lg border-2 border-transparent hover:border-indigo-400 transition-colors"
                  onClick={() => handlePickSecond(thumb)}
                >
                  <img
                    src={thumb.url}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}