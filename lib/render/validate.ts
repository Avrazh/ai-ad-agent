import type { NormRect } from "@/lib/types";

/**
 * Validate that a zone rect is within canvas bounds (0–1 normalized).
 * Returns true if valid, false if out of bounds.
 */
export function isValidZone(zone: NormRect): boolean {
  return (
    zone.x >= 0 &&
    zone.y >= 0 &&
    zone.x + zone.w <= 1.01 && // small epsilon for rounding
    zone.y + zone.h <= 1.01 &&
    zone.w > 0 &&
    zone.h > 0
  );
}

/**
 * Clamp a zone to stay within canvas bounds.
 */
export function clampZone(zone: NormRect): NormRect {
  const x = Math.max(0, Math.min(zone.x, 1));
  const y = Math.max(0, Math.min(zone.y, 1));
  const w = Math.min(zone.w, 1 - x);
  const h = Math.min(zone.h, 1 - y);
  return { x, y, w, h };
}
