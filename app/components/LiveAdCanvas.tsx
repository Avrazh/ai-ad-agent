"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { DraggableTextBlock } from "./DraggableTextBlock";
import type { TextBox } from "@/lib/types";

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
  onChange?: (y: number, fontScale: number, brandY?: number, brandFScale?: number) => void;
  onColorChange?: (headlineColor: string | null, brandColor: string | null) => void;
  onHeadlineChange?: (newHeadline: string) => void;
  renderOverlay?: (containerW: number) => React.ReactNode;
  brandName?: string;
  initialBrandY?: number;
  initialBrandFontScale?: number;
  headlineFont?: string;
  initialHeadlineColor?: string;
  initialBrandColor?: string;
  textBoxes?: TextBox[];
  hideHeadline?: boolean;
  onTextBoxesChange?: (boxes: TextBox[]) => void;
  onHideHeadlineChange?: (hide: boolean) => void;
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
  onChange,
  onColorChange,
  onHeadlineChange,
  renderOverlay,
  brandName,
  initialBrandY = 0.78,
  initialBrandFontScale = 1.0,
  headlineFont,
  initialHeadlineColor,
  initialBrandColor,
  textBoxes: textBoxesProp,
  hideHeadline,
  onTextBoxesChange,
  onHideHeadlineChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(300);
  const [y, setY] = useState(initialY);
  const [fScale, setFScale] = useState(initialFontScale);
  const [isDragging, setIsDragging] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [autoTextColor, setAutoTextColor] = useState<string>("#ffffff");
  const [autoBrandColor, setAutoBrandColor] = useState<string>("#ffffff");
  const [userHeadlineColor, setUserHeadlineColor] = useState<string | null>(initialHeadlineColor ?? null);
  const [userBrandColor, setUserBrandColor] = useState<string | null>(initialBrandColor ?? null);
  const headlineColorInputRef = useRef<HTMLInputElement>(null);
  const brandColorInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ mouseY: 0, startY: 0 });
  const scaleRef = useRef({ mouseY: 0, startScale: 1.0 });

  // Refs to capture current y/fScale/brandY/brandFScale inside event handlers (state is stale in closures)
  const yRef = useRef(initialY);
  const fScaleRef = useRef(initialFontScale);
  const brandYRef = useRef(initialBrandY);
  const brandFScaleRef = useRef(initialBrandFontScale);

  const hasContent = !!(headline || renderOverlay);

  // Brand name overlay — independent drag/scale state
  const [brandY, setBrandY] = useState(initialBrandY);
  const [brandFScale, setBrandFScale] = useState(initialBrandFontScale);
  const [isBrandDragging, setIsBrandDragging] = useState(false);
  const [isBrandScaling, setIsBrandScaling] = useState(false);
  const brandDragRef = useRef({ mouseY: 0, startY: 0 });
  const brandScaleRef = useRef({ mouseY: 0, startScale: 1.0 });
  const [editingHeadline, setEditingHeadline] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<TextBox[]>(textBoxesProp ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBoxes(textBoxesProp ?? []); }, [JSON.stringify(textBoxesProp)]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    setContainerW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Reset when a different image is selected
  useEffect(() => { setY(initialY); yRef.current = initialY; }, [initialY]);
  useEffect(() => { setFScale(initialFontScale); fScaleRef.current = initialFontScale; }, [initialFontScale]);
  useEffect(() => { setBrandY(initialBrandY); brandYRef.current = initialBrandY; }, [initialBrandY]);
  useEffect(() => { setBrandFScale(initialBrandFontScale); brandFScaleRef.current = initialBrandFontScale; }, [initialBrandFontScale]);
  useEffect(() => { setUserHeadlineColor(initialHeadlineColor ?? null); }, [initialHeadlineColor]);
  useEffect(() => { setUserBrandColor(initialBrandColor ?? null); }, [initialBrandColor]);

  // Focus and position cursor at end when entering edit mode
  useEffect(() => {
    if (!editingHeadline || !editRef.current) return;
    const el = editRef.current;
    el.innerText = headline;
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingHeadline]);

  // Inject Google Fonts link for selected headline font and Krona One (brand name)
  useEffect(() => {
    const toLoad: { id: string; url: string }[] = [
      { id: 'gfont-Krona-One', url: 'https://fonts.googleapis.com/css2?family=Krona+One' },
    ];
    if (headlineFont === 'Montserrat')
      toLoad.push({ id: 'gfont-Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700' });
    for (const { id, url } of toLoad) {
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  }, [headlineFont]);

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
        setAutoTextColor(lum / (data.length / 4) > 0.72 ? "#1a1a1a" : "#ffffff");
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
        setBrandY(cur => {
          const next = Math.max(ZONE_TOP, Math.min(ZONE_BOTTOM - 0.04, cur + dy));
          brandYRef.current = next;
          return next;
        });
        brandDragRef.current.mouseY = e.clientY;
      }
      if (isBrandScaling) {
        const dy = (brandScaleRef.current.mouseY - e.clientY) / containerH;
        setBrandFScale(cur => {
          const next = Math.max(0.4, Math.min(2.5, cur + dy * 4));
          brandFScaleRef.current = next;
          return next;
        });
        brandScaleRef.current.mouseY = e.clientY;
      }
      if (isDragging) {
        const dy = (e.clientY - dragRef.current.mouseY) / containerH;
        setY(cur => {
          const next = Math.max(ZONE_TOP, Math.min(ZONE_BOTTOM - 0.12, cur + dy));
          yRef.current = next;
          return next;
        });
        dragRef.current.mouseY = e.clientY;
      }
      if (isScaling) {
        const dy = (scaleRef.current.mouseY - e.clientY) / containerH;
        setFScale(cur => {
          const next = Math.max(0.4, Math.min(2.5, cur + dy * 4));
          fScaleRef.current = next;
          return next;
        });
        scaleRef.current.mouseY = e.clientY;
      }
    };
    const onUp = () => {
      setIsDragging(false);
      setIsScaling(false);
      setIsBrandDragging(false);
      setIsBrandScaling(false);
      onChange?.(yRef.current, fScaleRef.current, brandName ? brandYRef.current : undefined, brandName ? brandFScaleRef.current : undefined);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging, isScaling, isBrandDragging, isBrandScaling, onChange]);

  const fontSize = containerW * FONT_SIZE_RATIO * fScale;
  const subtextSize = fontSize * 0.28;
  const fontFamily = headlineFont ? `'${headlineFont}', sans-serif` : resolveFont(spec.font);
  const fontWeight = spec.fontWeight ?? 400;
  const textColor = userHeadlineColor ?? autoTextColor;
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
        {!hideHeadline && <div
          onMouseDown={(e) => {
            if (disabled || editingHeadline) return;
            e.preventDefault();
            dragRef.current = { mouseY: e.clientY, startY: y };
            setIsDragging(true);
          }}
          onDoubleClick={(e) => {
            if (disabled || renderOverlay || !headline) return;
            e.preventDefault();
            setIsDragging(false);
            setEditingHeadline(true);
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

          {/* Color swatch button — top-left of headline outline */}
          {hasContent && !renderOverlay && (
            <>
              <input
                ref={headlineColorInputRef}
                type="color"
                value={userHeadlineColor ?? autoTextColor}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                onChange={(e) => {
                  setUserHeadlineColor(e.target.value);
                  onColorChange?.(e.target.value, null);
                }}
              />
              <div
                title="Change text color"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); headlineColorInputRef.current?.click(); }}
                style={{
                  position: "absolute",
                  top: -14, left: -14,
                  width: 20, height: 20,
                  borderRadius: "50%",
                  background: userHeadlineColor ?? autoTextColor,
                  border: "2px solid rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  zIndex: 10,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              />
            </>
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
              {editingHeadline ? (
                <div
                  ref={editRef}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        const nl = document.createTextNode("\n");
                        range.insertNode(nl);
                        range.setStartAfter(nl);
                        range.setEndAfter(nl);
                        sel.removeAllRanges();
                        sel.addRange(range);
                      }
                    }
                    if (e.key === "Escape") {
                      setEditingHeadline(false);
                    }
                  }}
                  onBlur={() => {
                    const newText = (editRef.current?.innerText ?? headline).replace(/\n$/, "");
                    setEditingHeadline(false);
                    if (newText !== headline) onHeadlineChange?.(newText);
                  }}
                  style={{
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
                    whiteSpace: "pre-wrap",
                    outline: "none",
                    cursor: "text",
                    minHeight: `${fontSize * 1.2}px`,
                  }}
                />
              ) : (
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
                  whiteSpace: "pre-wrap",
                }}>
                  {headline}
                </p>
              )}

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
        </div>}

        {/* User-added free-form text boxes */}
        {boxes.map(box => (
          <DraggableTextBlock
            key={box.id}
            box={box}
            containerW={containerW}
            containerH={containerRef.current?.getBoundingClientRect().height ?? 600}
            onChange={(updated) => {
              const next = boxes.map(b => b.id === updated.id ? updated : b);
              setBoxes(next);
              onTextBoxesChange?.(next);
            }}
            onDelete={(id) => {
              const next = boxes.filter(b => b.id !== id);
              setBoxes(next);
              onTextBoxesChange?.(next);
            }}
          />
        ))}

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

            {/* Color swatch button — top-left of brand outline */}
            <>
              <input
                ref={brandColorInputRef}
                type="color"
                value={userBrandColor ?? autoBrandColor}
                style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                onChange={(e) => {
                  setUserBrandColor(e.target.value);
                  onColorChange?.(null, e.target.value);
                }}
              />
              <div
                title="Change brand name color"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); brandColorInputRef.current?.click(); }}
                style={{
                  position: "absolute",
                  top: -14, left: -14,
                  width: 20, height: 20,
                  borderRadius: "50%",
                  background: userBrandColor ?? autoBrandColor,
                  border: "2px solid rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  zIndex: 10,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                }}
              />
            </>

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
              fontFamily: "'Krona One', sans-serif",
              fontSize: `${brandFontSize}px`,
              fontWeight: 700,
              color: userBrandColor ?? autoBrandColor,
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

      {/* Add Text + Hide headline controls */}
      {!disabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button
            onClick={() => {
              const newBox: TextBox = {
                id: crypto.randomUUID(),
                text: "Your text here",
                x: 0.1, y: 0.45,
                w: 0.8,
                fontSize: 0.04,
                color: "#ffffff",
                bold: false,
                bullets: false,
              };
              const next = [...boxes, newBox];
              setBoxes(next);
              onTextBoxesChange?.(next);
            }}
            style={{
              background: "#6366f1", color: "white", border: "none",
              borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer",
            }}
          >+ Add Text</button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a1a1aa", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={hideHeadline ?? false}
              onChange={(e) => onHideHeadlineChange?.(e.target.checked)}
            />
            Hide headline
          </label>
        </div>
      )}
    </div>
  );
}
