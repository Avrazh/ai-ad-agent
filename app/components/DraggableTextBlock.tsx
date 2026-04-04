"use client";
import { useRef, useState, useEffect } from "react";
import type { TextBox } from "@/lib/types";

interface Props {
  box: TextBox;
  containerW: number;
  containerH: number;
  onChange: (updated: TextBox) => void;
  onDelete: (id: string) => void;
  fontFamily?: string;
}

export function DraggableTextBlock({ box, containerW, containerH, onChange, onDelete, fontFamily = "Inter, sans-serif" }: Props) {
  const [local, setLocal] = useState(box);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ mouseX: 0, mouseY: 0 });
  const resizeRef = useRef({ mouseX: 0, mouseY: 0, startW: 0, startFs: 0 });
  const localRef = useRef(local);
  localRef.current = local;

  // Sync when parent swaps to a different box (e.g. switching images)
  useEffect(() => { setLocal(box); }, [box.id]);

  // Focus and position cursor at end when entering edit mode
  useEffect(() => {
    if (!editing || !editRef.current) return;
    const el = editRef.current;
    const displayText = local.bullets
      ? local.text.split("\n").map(l => `• ${l}`).join("\n")
      : local.text;
    el.innerText = displayText;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Global mouse move/up for drag and resize
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragRef.current.mouseX) / containerW;
        const dy = (e.clientY - dragRef.current.mouseY) / containerH;
        setLocal(cur => {
          const next = {
            ...cur,
            x: Math.max(0, Math.min(0.95, cur.x + dx)),
            y: Math.max(0, Math.min(0.95, cur.y + dy)),
          };
          localRef.current = next;
          return next;
        });
        dragRef.current = { mouseX: e.clientX, mouseY: e.clientY };
      }
      if (isResizing) {
        const dx = (e.clientX - resizeRef.current.mouseX) / containerW;
        const dy = (resizeRef.current.mouseY - e.clientY) / containerH; // up = bigger
        const nextW = Math.max(0.1, Math.min(1, resizeRef.current.startW + dx));
        const nextFs = Math.max(0.012, Math.min(0.18, resizeRef.current.startFs + dy * 0.5));
        setLocal(cur => {
          const next = { ...cur, w: nextW, fontSize: nextFs };
          localRef.current = next;
          return next;
        });
      }
    };
    const onUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      onChange(localRef.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, isResizing, containerW, containerH, onChange]);

  const displayText = local.bullets
    ? local.text.split("\n").map(l => `• ${l}`).join("\n")
    : local.text;

  const px = local.x * containerW;
  const py = local.y * containerH;
  const pw = local.w * containerW;
  const fs = local.fontSize * containerH;

  return (
    <div
      style={{
        position: "absolute",
        left: px, top: py,
        width: "fit-content",
        maxWidth: pw,
        padding: "2px 8px",
        boxSizing: "border-box",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: 20,
      }}
      onMouseDown={(e) => {
        if (editing) return;
        e.preventDefault();
        dragRef.current = { mouseX: e.clientX, mouseY: e.clientY };
        setIsDragging(true);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        setIsDragging(false);
        setEditing(true);
      }}
    >
      {/* Dashed selection border */}
      <div style={{
        position: "absolute",
        inset: "-6px",
        border: "1.5px dashed rgba(99,102,241,0.7)",
        borderRadius: 6,
        pointerEvents: "none",
      }} />

      {/* Color swatch — top-left */}
      <input
        ref={colorInputRef}
        type="color"
        value={local.color}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        onChange={(e) => {
          const next = { ...localRef.current, color: e.target.value };
          setLocal(next);
          onChange(next);
        }}
      />
      <div
        title="Change color"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); colorInputRef.current?.click(); }}
        style={{
          position: "absolute", top: -14, left: -14,
          width: 20, height: 20, borderRadius: "50%",
          background: local.color,
          border: "2px solid rgba(255,255,255,0.5)",
          cursor: "pointer", zIndex: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      />

      {/* Delete button — top-right */}
      <div
        title="Delete text box"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
        style={{
          position: "absolute", top: -14, right: -14,
          width: 20, height: 20, borderRadius: "50%",
          background: "#ef4444",
          cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Resize handle — bottom-right (drag X=width, drag Y=fontSize) */}
      <div
        title="Drag to resize (left/right = width, up/down = font size)"
        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          resizeRef.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            startW: localRef.current.w,
            startFs: localRef.current.fontSize,
          };
          setIsResizing(true);
        }}
        style={{
          position: "absolute", bottom: -14, right: -14,
          width: 20, height: 20, borderRadius: 4,
          background: "#6366f1",
          cursor: "nwse-resize", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 8L8 2M5 8L8 8L8 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Bold + Bullets mini toolbar — bottom-left */}
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{ position: "absolute", bottom: -26, left: -6, display: "flex", gap: 4 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            const next = { ...localRef.current, bold: !localRef.current.bold };
            setLocal(next);
            onChange(next);
          }}
          style={{
            background: local.bold ? "#6366f1" : "rgba(0,0,0,0.55)",
            color: "white", border: "none", borderRadius: 3,
            fontSize: 10, fontWeight: 700, padding: "2px 5px", cursor: "pointer",
          }}
        >B</button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const newBullets = !localRef.current.bullets;
            const next = { ...localRef.current, bullets: newBullets };
            setLocal(next);
            onChange(next);
            // If currently editing, rewrite the contentEditable content immediately
            if (editing && editRef.current) {
              const lines = editRef.current.innerText.split("\n");
              const stripped = lines.map(l => l.replace(/^•\s?/, ""));
              editRef.current.innerText = newBullets
                ? stripped.map(l => `• ${l}`).join("\n")
                : stripped.join("\n");
              // Move cursor to end
              const range = document.createRange();
              range.selectNodeContents(editRef.current);
              range.collapse(false);
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(range);
            }
          }}
          style={{
            background: local.bullets ? "#6366f1" : "rgba(0,0,0,0.55)",
            color: "white", border: "none", borderRadius: 3,
            fontSize: 10, padding: "2px 5px", cursor: "pointer",
          }}
        >•</button>
      </div>

      {/* Text content */}
      {editing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.currentTarget.blur(); return; }
            if (e.key === "Enter" && localRef.current.bullets) {
              e.preventDefault();
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode("\n• ");
                range.insertNode(node);
                range.setStartAfter(node);
                range.setEndAfter(node);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          }}
          onBlur={() => {
            const raw = editRef.current?.innerText ?? local.text;
            const cleaned = local.bullets
              ? raw.split("\n").map(l => l.replace(/^•\s?/, "")).join("\n")
              : raw;
            const next = { ...localRef.current, text: cleaned.replace(/\n$/, "") };
            setLocal(next);
            setEditing(false);
            onChange(next);
          }}
          style={{
            margin: 0,
            fontFamily: fontFamily,
            fontSize: `${fs}px`,
            fontWeight: local.bold ? 700 : 400,
            color: local.color,
            lineHeight: 1.3,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            outline: "none",
            cursor: "text",
            minHeight: `${fs * 1.3}px`,
          }}
        />
      ) : (
        <p style={{
          margin: 0,
          fontFamily: fontFamily,
          fontSize: `${fs}px`,
          fontWeight: local.bold ? 700 : 400,
          color: local.color,
          lineHeight: 1.3,
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}>
          {displayText || <span style={{ opacity: 0.4, fontStyle: "italic" }}>Double-click to edit</span>}
        </p>
      )}
    </div>
  );
}
