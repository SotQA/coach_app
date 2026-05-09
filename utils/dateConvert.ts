import { logger } from "@/utils/logger";

/**
 * Normalize any "date-like" value to a millisecond timestamp.
 * Accepts: Firestore Timestamp, JS Date, ISO string, number, null/undefined.
 * Returns 0 on any failure (the existing "unknown date" sentinel used across the app).
 */
export function toMs(value: unknown): number {
  if (value == null) return 0;
  try {
    // Firestore Timestamp duck-type
    if (typeof (value as any)?.toDate === "function") {
      return (value as any).toDate().getTime();
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : 0;
    }
    return 0;
  } catch (e) {
    logger.warn("[dateConvert] toMs failed", e, value);
    return 0;
  }
}

/** Convenience: returns a Date object, or null if unparseable. */
export function toDate(value: unknown): Date | null {
  const ms = toMs(value);
  return ms > 0 ? new Date(ms) : null;
}
