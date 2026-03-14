"use client";
import { useRef, useState, useCallback, useEffect } from "react";

// 4:5 zone bounds as fraction of canvas height
const ZONE_TOP = 0.2005;
const ZONE_BOTTOM = 0.7995;

type Props = {
  imgRef: React.RefObject<HTMLImageElement | null>;
  initialY: number;          // normalized 0-1 starting position
  onApply: (y: number) => void;
  disabled?: boolean;
};

export function HeadlineDragOverlay({ imgRef, initialY, onApply, disabled }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [dragY, setDragY] = useState<number>(initialY);
  const [isDragging, setIsDragging] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset when initialY changes (new render)
  useEffect(() => {
    setDragY(initialY);
    setHasChanged(false);
    setEditMode(false);
  }, [initialY]);

  const getImgRect = useCallback(() => {
    return imgRef.current?.getBoundingClientRect() ?? null;
  }, [imgRef]);

  const clampY = (y: number) => Math.max(ZONE_TOP, Math.min(ZONE_BOTTOM - 0.05, y));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = getImgRect();
    if (!rect) return;
    const relY = (e.clientY - rect.top) / rect.height;
    setDragY(clampY(relY));
    setHasChanged(true);
  }, [isDragging, getImgRect]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleApply = useCallback(() => {
    onApply(dragY);
    setHasChanged(false);
    setEditMode(false);
  }, [dragY, onApply]);

  const handleCancel = useCallback(() => {
    setDragY(initialY);
    setHasChanged(false);
    setEditMode(false);
  }, [initialY]);

  if (!editMode) {
    return (
      <button
        onClick={() => setEditMode(true)}
        disabled={disabled}
        className="absolute top-2 right-2 z-20 rounded-full bg-black/50 p-1.5 text-white/70 hover:bg-black/70 hover:text-white transition-colors"
        title="Adjust headline position"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    );
  }

  // In edit mode -- show zone guides + drag handle
  return (
    <div ref={overlayRef} className="absolute inset-0 z-20" style={{ cursor: isDragging ? "grabbing" : "default" }}>
      {/* Zone boundary guides */}
      <div className="absolute left-0 right-0 border-t border-dashed border-white/30" style={{ top: `${ZONE_TOP * 100}%` }} />
      <div className="absolute left-0 right-0 border-t border-dashed border-white/30" style={{ top: `${ZONE_BOTTOM * 100}%` }} />

      {/* Drag handle bar */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center"
        style={{ top: `${dragY * 100}%`, transform: "translateY(-50%)" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="w-full h-1 bg-indigo-400/40"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {/* Grip pill */}
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 rounded-full px-3 py-1 flex items-center gap-1 shadow-lg select-none"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <svg width="16" height="10" viewBox="0 0 16 10" fill="white" opacity="0.9">
              <rect y="0" width="16" height="2" rx="1"/>
              <rect y="4" width="16" height="2" rx="1"/>
              <rect y="8" width="16" height="2" rx="1"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Apply / Cancel buttons */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        <button
          onClick={handleCancel}
          className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 hover:bg-black/80"
        >
          Cancel
        </button>
        {hasChanged && (
          <button
            onClick={handleApply}
            disabled={disabled}
            className="rounded-full bg-indigo-600 px-3 py-1 text-xs text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            Apply
          </button>
        )}
      </div>

      {/* Hint label */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white/60 pointer-events-none">
        Drag to reposition headline
      </div>
    </div>
  );
}
