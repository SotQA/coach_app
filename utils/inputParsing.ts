/**
 * Helpers for parsing user-typed numeric input fields.
 * All functions accept comma or dot as the decimal separator.
 */

/**
 * Normalize a raw text value to a decimal string suitable for numeric input display.
 * - Replaces commas with dots.
 * - Strips non-numeric, non-dot characters.
 * - Collapses multiple dots to a single dot.
 * - Prepends "0" when the string starts with ".".
 * Returns the normalized string (may still be "" for empty input).
 */
export function normalizeDecimalInput(text: string): string {
  let t = text.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = t.indexOf(".");
  if (firstDot >= 0) {
    t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
  }
  if (t.startsWith(".")) t = `0${t}`;
  return t;
}

/**
 * Parse a user-typed weight string to a number.
 * Accepts commas as decimal separators.
 * Returns `null` for empty strings or unparseable values.
 * Callers that need a zero fallback should write: `parseKgInput(t) ?? 0`.
 */
export function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Parse a user-typed float string to a number.
 * More permissive than parseKgInput: allows multiple dots (collapses them).
 * Returns `null` for empty strings or unparseable values.
 */
export function parseFloatInput(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "")
    .replace(/\.(?=.*\.)/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
