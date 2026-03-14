"use client";

import { useRef, useState, useEffect } from "react";

const FONT_SIZE_RATIO = 0.8148 * 0.12;
const BRAND_FONT_RATIO = 36 / 1080; // 36px at 1080px canvas width // TEXT_W% * font multiplier ≈ 9.78% of canvas width
const ZONE_TOP = 0.1484; // top of 4:5 safe zone within 9:16 canvas
const ZONE_BOTTOM = 0.7995;

const LETTER_SPACING: Record<string, string> = {
  tight: "-0.02em",
  normal: "0",
  wide: "0.12em",
  ultra: "0.25em",
};

type SurpriseSpecLite = {
  font?: string;
  fontWeight?: number;
  textColor?: string;
  letterSpacingKey?: string;
  textTransform?: string;
  textAlign?: string;
};

interface Props {
  imageUrl: string;
  subjectPos?: string;
  headline: string;
  subtext?: string;
  spec: SurpriseSpecLite;
  format: "9:16" | "4:5" | "1:1";
  initialY: number;
  initialFontScale?: number;
  disabled?: boolean;
  disableResize?: boolean;
  onApply: (y: number, fontScale: number) => void;
  renderOverlay?: (containerW: number) => React.ReactNode;
}

function resolveFont(f?: string): string {
  if (f === "bebas") return "var(--font-bebas), sans-serif";
  if (f === "serif") return "var(--font-playfair), serif";
  return "var(--font-geist-sans), sans-serif";
}

export function LiveAdCanvas({
  imageUrl,
  subjectPos = "50% 50%",
  headline,
  subtext,
  spec,
  format,
  initialY,
  initialFontScale = 1.0,
  disabled,
  disableResize = false,
  onApply,
  renderOverlay,
  brandName,
  initialBrandY = 0.78,
  initialBrandFontScale = 1.0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(300);
  const [y, setY] = useState(initialY);
  const [fScale, setFScale] = useState(initialFontScale);
  const [isDragging, setIsDragging] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [autoTextColor, setAutoTextColor] = useState<string>("#ffffff");
  const [autoBrandColor, setAutoBrandColor] = useState<string>("#ffffff");
  const dragRef = useRef({ mouseY: 0, startY: 0 });
  const scaleRef = useRef({ mouseY: 0, startScale: 1.0 });

  const hasContent = !!(headline || renderOverlay);

  // Brand name overlay — independent drag/scale state
  const [brandY, setBrandY] = useState(initialBrandY);
  const [brandFScale, setBrandFScale] = useState(initialBrandFontScale);
  const [isBrandDragging, setIsBrandDragging] = useState(false);
  const [isBrandScaling, setIsBrandScaling] = useState(false);
  const brandDragRef = useRef({ mouseY: 0, startY: 0 });
  const brandScaleRef = useRef({ mouseY: 0, startScale: 1.0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    setContainerW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Reset when a different image is selected
  useEffect(() => { setY(initialY); }, [initialY]);
  useEffect(() => { setFScale(initialFontScale); }, [initialFontScale]);
  useEffect(() => { setBrandY(initialBrandY); }, [initialBrandY]);
  useEffect(() => { setBrandFScale(initialBrandFontScale); }, [initialBrandFontScale]);

  // Sample image pixels behind text block (skipped when renderOverlay handles its own colors) → pick white or dark text
  useEffect(() => {
    if (renderOverlay) return;
    if (isDragging || isScaling) return;
    const img = new Image();
    img.onload = () => {
      try {
        const containerAR = format === "9:16" ? 9 / 16 : format === "4:5" ? 4 / 5 : 1;
        const imgAR = img.naturalWidth / img.naturalHeight;
        let srcX: number, srcY: number, srcW: number, srcH: number;
        const [pxStr = "50%", pyStr = "50%"] = (subjectPos ?? "50% 50%").split(" ");
        const px = parseFloat(pxStr) / 100;
        const py = parseFloat(pyStr) / 100;
        if (imgAR > containerAR) {
          srcH = img.naturalHeight; srcW = srcH * containerAR;
          srcX = (img.naturalWidth - srcW) * px; srcY = 0;
        } else {
          srcW = img.naturalWidth; srcH = srcW / containerAR;
          srcX = 0; srcY = (img.naturalHeight - srcH) * py;
        }
        const SW = 160, SH = 60;
        const canvas = document.createElement("canvas");
        canvas.width = SW; canvas.height = SH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img,
          srcX + srcW * 0.0926, srcY + srcH * y, srcW * 0.8148, srcH * 0.14,
          0, 0, SW, SH
        );
        const data = ctx.getImageData(0, 0, SW, SH).data;
        let lum = 0;
        for (let i = 0; i < data.length; i += 4)
          lum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        setAutoTextColor(lum / (data.length / 4) > 0.55 ? "#1a1a1a" : "#ffffff");
      } catch { /* tainted canvas — keep current color */ }
    };
    img.src = imageUrl;
  }, [imageUrl, y, isDragging, isScaling, subjectPos, format, renderOverlay]);

  // Sample pixels behind brand name box → pick white or dark color
  useEffect(() => {
    if (!brandName) return;
    if (isBrandDragging || isBrandScaling) return;
    const img = new Image();
    img.onload = () => {
      try {
        const containerAR = format === "9:16" ? 9 / 16 : format === "4:5" ? 4 / 5 : 1;
        const imgAR = img.naturalWidth / img.naturalHeight;
        let srcX: number, srcY: number, srcW: number, srcH: number;
        const [pxStr = "50%", pyStr = "50%"] = (subjectPos ?? "50% 50%").split(" ");
        const px = parseFloat(pxStr) / 100;
        const py = parseFloat(pyStr) / 100;
        if (imgAR > containerAR) {
          srcH = img.naturalHeight; srcW = srcH * containerAR;
          srcX = (img.naturalWidth - srcW) * px; srcY = 0;
        } else {
          srcW = img.naturalWidth; srcH = srcW / containerAR;
          srcX = 0; srcY = (img.naturalHeight - srcH) * py;
        }
        const SW = 160, SH = 30;
        const canvas = document.createElement("canvas");
        canvas.width = SW; canvas.height = SH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img,
          srcX + srcW * 0.0926, srcY + srcH * brandY, srcW * 0.8148, srcH * 0.05,
          0, 0, SW, SH
        );
        const data = ctx.getImageData(0, 0, SW, SH).data;
        let lum = 0;
        for (let i = 0; i < data.length; i += 4)
          lum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        setAutoBrandColor(lum / (data.length / 4) > 0.55 ? "#1a1a1a" : "#ffffff");
      } catch { /* tainted canvas */ }
    };
    img.src = imageUrl;
  }, [imageUrl, brandY, isBrandDragging, isBrandScaling, subjectPos, format, brandName]);

  useEffect(() => {
    if (!isDragging && !isScaling && !isBrandDragging && !isBrandScaling) return;
    const containerH = containerRef.current?.getBoundingClientRect().height ?? 600;

    const onMove = (e: MouseEvent) => {
      if (isBrandDragging) {
        const dy = (e.clientY - brandDragRef.current.mouseY) / containerH;
        setBrandY(cur => Math.max(ZONE_TOP, Math.min(ZONE_BOTTOM - 0.04, cur + dy)));
        brandDragRef.current.mouseY = e.clientY;
      }
      if (isBrandScaling) {
        const dy = (brandScaleRef.current.mouseY - e.clientY) / containerH;
        setBrandFScale(cur => Math.max(0.4, Math.min(2.5, cur + dy * 4)));
        brandScaleRef.current.mouseY = e.clientY;
      }
      if (isDragging) {
        const dy = (e.clientY - dragRef.current.mouseY) / containerH;
        setY(cur => Math.max(ZONE_TOP, Math.min(ZONE_BOTTOM - 0.12, cur + dy)));
        dragRef.current.mouseY = e.clientY;
      }
      if (isScaling) {
        const dy = (scaleRef.current.mouseY - e.clientY) / containerH;
        setFScale(cur => Math.max(0.4, Math.min(2.5, cur + dy * 4)));
        scaleRef.current.mouseY = e.clientY;
      }
    };
    const onUp = () => { setIsDragging(false); setIsScaling(false); setIsBrandDragging(false); setIsBrandScaling(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging, isScaling, isBrandDragging, isBrandScaling]);

  const fontSize = containerW * FONT_SIZE_RATIO * fScale;
  const subtextSize = fontSize * 0.28;
  const fontFamily = resolveFont(spec.font);
  const fontWeight = spec.fontWeight ?? 400;
  const textColor = autoTextColor;
  const letterSpacing = LETTER_SPACING[spec.letterSpacingKey ?? "normal"] ?? "0";
  const textTransform = (spec.textTransform === "uppercase" ? "uppercase" : "none") as "uppercase" | "none";
  const textAlign = (spec.textAlign ?? "center") as "left" | "center" | "right";

  const brandFontSize = containerW * BRAND_FONT_RATIO * brandFScale;
  const aspectRatio = format === "9:16" ? "9/16" : format === "4:5" ? "4/5" : "1/1";

  return (
    <div className="relative h-full flex items-center justify-center">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        style={{ aspectRatio, height: "100%", width: "auto", maxWidth: "100%" }}
      >
        {/* Background photo */}
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: subjectPos }}
          draggable={false}
        />

        {/* Draggable text block */}
        <div
          onMouseDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            dragRef.current = { mouseY: e.clientY, startY: y };
            setIsDragging(true);
          }}
          style={{
            position: "absolute",
            left: "9.26%",
            width: "81.48%",
            top: `${y * 100}%`,
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            // Ensure a tappable hit area even when headline is empty (e.g. star_review mode)
            ...(!headline ? { minHeight: 48 } : {}),
          }}
        >
          {/* Selection outline when there is content */}
          {hasContent && (
            <div style={{
              position: "absolute",
              inset: "-6px -6px -6px -6px",
              border: "1.5px dashed rgba(99,102,241,0.7)",
              borderRadius: 6,
              pointerEvents: "none",
            }} />
          )}

          {/* Drag-bar fallback when no content */}
          {!hasContent && (
            <div style={{
              position: "absolute",
              left: 0, right: 0, top: "-1px",
              height: 2,
              background: "rgba(99,102,241,0.7)",
              pointerEvents: "none",
            }}>
              <div style={{
                position: "absolute",
                left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                background: "#6366f1",
                borderRadius: 12,
                padding: "3px 10px",
                display: "flex", alignItems: "center", gap: 4,
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}>
                <svg width="14" height="8" viewBox="0 0 14 8" fill="white" opacity="0.9">
                  <rect y="0" width="14" height="1.5" rx="1"/>
                  <rect y="3.25" width="14" height="1.5" rx="1"/>
                  <rect y="6.5" width="14" height="1.5" rx="1"/>
                </svg>
              </div>
            </div>
          )}

          {/* Scale handle — hidden when disableResize */}
          {!disableResize && (
          <div
            title="Drag up/down to resize"
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              scaleRef.current = { mouseY: e.clientY, startScale: fScale };
              setIsScaling(true);
            }}
            style={{
              position: "absolute",
              top: -14,
              right: -14,
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "#6366f1",
              cursor: "ns-resize",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1V9M2 4L5 1L8 4M2 6L5 9L8 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          )}

          {/* Content: custom overlay OR headline + subtext */}
          {renderOverlay ? renderOverlay(containerW) : (
            <>
              <p style={{
                margin: 0,
                fontFamily,
                fontSize: `${fontSize}px`,
                fontWeight,
                color: textColor,
                letterSpacing,
                textTransform,
                textAlign,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}>
                {headline}
              </p>

              {subtext && (
                <p style={{
                  margin: `${Math.round(fontSize * 0.25)}px 0 0`,
                  fontFamily: "var(--font-geist-sans), sans-serif",
                  fontSize: `${subtextSize}px`,
                  fontWeight: 400,
                  color: textColor,
                  textAlign,
                  letterSpacing: "0.05em",
                  lineHeight: 1.4,
                }}>
                  {subtext}
                </p>
              )}
            </>
          )}
        </div>

        {/* Loading spinner */}

        {/* Brand name overlay — independent draggable/resizable box */}
        {brandName && (
          <div
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              brandDragRef.current = { mouseY: e.clientY, startY: brandY };
              setIsBrandDragging(true);
            }}
            style={{
              position: "absolute",
              left: "9.26%",
              width: "81.48%",
              top: `${brandY * 100}%`,
              cursor: isBrandDragging ? "grabbing" : "grab",
              userSelect: "none",
            }}
          >
            {/* Dashed selection outline */}
            <div style={{
              position: "absolute",
              inset: "-6px -6px -6px -6px",
              border: "1.5px dashed rgba(234,179,8,0.7)",
              borderRadius: 6,
              pointerEvents: "none",
            }} />

            {/* Scale handle */}
            <div
              title="Drag up/down to resize brand name"
              onMouseDown={(e) => {
                if (disabled) return;
                e.preventDefault();
                e.stopPropagation();
                brandScaleRef.current = { mouseY: e.clientY, startScale: brandFScale };
                setIsBrandScaling(true);
              }}
              style={{
                position: "absolute",
                top: -14, right: -14,
                width: 20, height: 20,
                borderRadius: 4,
                background: "#ca8a04",
                cursor: "ns-resize",
                zIndex: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1V9M2 4L5 1L8 4M2 6L5 9L8 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Brand name text */}
            <p style={{
              margin: 0,
              fontFamily: "var(--font-playfair), serif",
              fontSize: `${brandFontSize}px`,
              fontWeight: 700,
              color: autoBrandColor,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.2,
            }}>
              {brandName}
            </p>
          </div>
        )}
        {disabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Controls outside canvas */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <span className="text-[10px] text-white/40 pointer-events-none">
          {disableResize ? (renderOverlay ? "Drag card to reposition" : "Drag bar to reposition") : "Drag text · ↕ handle to resize"}
        </span>
        <button
          onClick={() => onApply(y, fScale, brandName ? brandY : undefined, brandName ? brandFScale : undefined)}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-white transition shadow-lg"
        >
          Render & Save
        </button>
      </div>
    </div>
  );
}
