"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CropEditorProps {
  imageUrl: string;
  imageNaturalW: number;
  imageNaturalH: number;
  format: "9:16" | "4:5" | "1:1";
  headline: string;
  initialCropX?: number;
  initialHeadlineY?: number;
  disabled?: boolean;
  onRender: (cropX: number, headlineY: number, fontScale: number) => void;
}

const FORMAT_RATIO: Record<"9:16" | "4:5" | "1:1", number> = {
  "9:16": 9 / 16,
  "4:5": 4 / 5,
  "1:1": 1,
};

export function CropEditor({
  imageUrl,
  imageNaturalW,
  imageNaturalH,
  format,
  headline,
  initialCropX = 0.5,
  initialHeadlineY = 0.15,
  disabled = false,
  onRender,
}: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cropXNorm, setCropXNorm] = useState<number>(initialCropX);
  const [headlineY, setHeadlineY] = useState(initialHeadlineY);
  const [fontScale, setFontScale] = useState(1.0);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const imgAspect = imageNaturalH > 0 ? imageNaturalW / imageNaturalH : 1;
  const containerAspect = containerSize.h > 0 ? containerSize.w / containerSize.h : 1;

  let renderedImgW: number;
  let renderedImgH: number;
  let imgLeft: number;
  let imgTop: number;

  if (containerSize.w === 0 || containerSize.h === 0) {
    renderedImgW = 0; renderedImgH = 0; imgLeft = 0; imgTop = 0;
  } else if (imgAspect > containerAspect) {
    renderedImgW = containerSize.w;
    renderedImgH = containerSize.w / imgAspect;
    imgLeft = 0;
    imgTop = (containerSize.h - renderedImgH) / 2;
  } else {
    renderedImgH = containerSize.h;
    renderedImgW = containerSize.h * imgAspect;
    imgLeft = (containerSize.w - renderedImgW) / 2;
    imgTop = 0;
  }

  const cropRatio = FORMAT_RATIO[format];
  const cropWinH = renderedImgH;
  const cropWinW = Math.min(cropWinH * cropRatio, renderedImgW);
  const maxCropLeft = renderedImgW - cropWinW;
  const cropWinLeft = imgLeft + cropXNorm * maxCropLeft;
  const cropWinTop = imgTop;
  // inset() values are relative to the image element edges, not the container
  const clipPath = `inset(${cropWinTop - imgTop}px ${(imgLeft + renderedImgW) - (cropWinLeft + cropWinW)}px ${(imgTop + renderedImgH) - (cropWinTop + cropWinH)}px ${cropWinLeft - imgLeft}px)`;

  const dragStartX = useRef<number | null>(null);
  const dragStartCropXNorm = useRef<number>(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartCropXNorm.current = cropXNorm;
    },
    [disabled, cropXNorm]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging.current || dragStartX.current === null || maxCropLeft <= 0) return;
      const next = Math.max(0, Math.min(1, dragStartCropXNorm.current + (e.clientX - dragStartX.current) / maxCropLeft));
      setCropXNorm(next);
    },
    [maxCropLeft]
  );

  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      isDragging.current = true;
      dragStartX.current = touch.clientX;
      dragStartCropXNorm.current = cropXNorm;
    },
    [disabled, cropXNorm]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current || dragStartX.current === null || maxCropLeft <= 0) return;
      const touch = e.touches[0];
      const next = Math.max(0, Math.min(1, dragStartCropXNorm.current + (touch.clientX - dragStartX.current) / maxCropLeft));
      setCropXNorm(next);
    },
    [maxCropLeft]
  );

  const handleTouchEnd = useCallback(() => { isDragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener("touchmove", handleTouchMove as EventListener, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove as EventListener);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchMove, handleTouchEnd]);

  const [hlDragging, setHlDragging] = useState(false);
  const [resizeDragging, setResizeDragging] = useState(false);
  const hlDragStartY = useRef<number>(0);
  const hlDragStartNorm = useRef<number>(0);

  const handleHlMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setHlDragging(true);
      hlDragStartY.current = e.clientY;
      hlDragStartNorm.current = headlineY;
    },
    [disabled, headlineY]
  );

  useEffect(() => {
    if (!hlDragging) return;
    const onMove = (e: MouseEvent) => {
      if (cropWinH <= 0) return;
      setHeadlineY(Math.max(0, Math.min(0.8, hlDragStartNorm.current + (e.clientY - hlDragStartY.current) / cropWinH)));
    };
    const onUp = () => setHlDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [hlDragging, cropWinH]);

  const resizeDragStartY = useRef<number>(0);
  const resizeDragStartScale = useRef<number>(1.0);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setResizeDragging(true);
      resizeDragStartY.current = e.clientY;
      resizeDragStartScale.current = fontScale;
    },
    [disabled, fontScale]
  );

  useEffect(() => {
    if (!resizeDragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = (resizeDragStartY.current - e.clientY) / (cropWinH * 0.3);
      setFontScale(Math.max(0.4, Math.min(2.5, resizeDragStartScale.current + delta)));
    };
    const onUp = () => setResizeDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeDragging, cropWinH]);

  const getCropXCenter = () => {
    if (renderedImgW <= 0) return initialCropX;
    return Math.max(0, Math.min(1, (cropXNorm * maxCropLeft + cropWinW / 2) / renderedImgW));
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-black select-none"
        style={{ cursor: disabled ? "default" : "ew-resize" }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {containerSize.w > 0 && (
          <>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: imgLeft,
                top: imgTop,
                width: renderedImgW,
                height: renderedImgH,
                filter: "blur(8px) brightness(0.45)",
                objectFit: "fill",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: imgLeft,
                top: imgTop,
                width: renderedImgW,
                height: renderedImgH,
                clipPath,
                objectFit: "fill",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: cropWinLeft,
                top: cropWinTop,
                width: cropWinW,
                height: cropWinH,
                border: "2px solid rgba(255,255,255,0.7)",
                boxSizing: "border-box",
                pointerEvents: "none",
                borderRadius: 2,
              }}
            />
            {maxCropLeft > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: cropWinLeft,
                  top: cropWinTop,
                  width: cropWinW,
                  height: cropWinH,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 12,
                  pointerEvents: "none",
                }}
              >
                <span style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  background: "rgba(0,0,0,0.45)",
                  borderRadius: 4,
                  padding: "2px 8px",
                  letterSpacing: "0.04em",
                }}>
                  Drag left/right to reposition
                </span>
              </div>
            )}
            {headline && (
              <div
                style={{
                  position: "absolute",
                  left: cropWinLeft + cropWinW * 0.0926,
                  top: cropWinTop + headlineY * cropWinH,
                  width: cropWinW * 0.8148,
                  cursor: disabled ? "default" : "ns-resize",
                  userSelect: "none",
                  zIndex: 10,
                }}
                onMouseDown={handleHlMouseDown}
              >
                <p style={{
                  color: "#ffffff",
                  fontFamily: "Georgia, 'Playfair Display', serif",
                  fontSize: Math.round(cropWinW * 0.8148 * 0.12 * fontScale),
                  fontWeight: 400,
                  lineHeight: 1.15,
                  textAlign: "center",
                  textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                  margin: 0,
                  wordBreak: "normal",
                  overflowWrap: "normal",
                  pointerEvents: "none",
                }}>
                  {headline}
                </p>
                {/* Resize handle — drag up/down to scale font */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 6,
                    cursor: disabled ? "default" : "ns-resize",
                    pointerEvents: disabled ? "none" : "auto",
                    padding: "4px 0",
                  }}
                  onMouseDown={handleResizeMouseDown}
                >
                  <div style={{
                    width: 28,
                    height: 3,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.55)",
                  }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-[#0a0d12]">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Drag the image to reposition the crop window.
          {headline ? " Drag headline text up/down to reposition it." : ""}
        </p>
        <button
          onClick={() => onRender(getCropXCenter(), headlineY, fontScale)}
          disabled={disabled || containerSize.w === 0}
          className="shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition flex items-center gap-2"
        >
          {disabled ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Rendering
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Render
            </>
          )}
        </button>
      </div>
    </div>
  );
}
