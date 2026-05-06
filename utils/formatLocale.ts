import type { SupportedLocale } from "../context/I18nContext";

// ─── Locale → BCP 47 tag ──────────────────────────────────────────────────────

const LOCALE_TAG: Record<SupportedLocale, string> = {
  en: "en-US",
  pl: "pl-PL",
  ru: "ru-RU",
};

export function localeTag(locale: SupportedLocale): string {
  return LOCALE_TAG[locale] ?? "en-US";
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(
  ms: number,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  try {
    return new Date(ms).toLocaleDateString(localeTag(locale), options);
  } catch {
    return new Date(ms).toLocaleDateString(undefined, options);
  }
}

export function formatDateShort(ms: number, locale: SupportedLocale): string {
  return formatDate(ms, locale, { month: "short", day: "numeric" });
}

export function formatDateFull(ms: number, locale: SupportedLocale): string {
  return formatDate(ms, locale, { year: "numeric", month: "short", day: "numeric" });
}

export function formatWeekday(locale: SupportedLocale): string {
  try {
    return new Date().toLocaleDateString(localeTag(locale), { weekday: "short" });
  } catch {
    return new Date().toLocaleDateString(undefined, { weekday: "short" });
  }
}

// ─── Number / weight formatting ───────────────────────────────────────────────

/**
 * Format a weight value using the locale's decimal separator.
 * Polish and Russian use a comma; English uses a period.
 *
 * @example formatWeight(75.5, "pl") → "75,5"
 * @example formatWeight(75.5, "en") → "75.5"
 */
export function formatWeight(value: number, locale: SupportedLocale): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      maximumFractionDigits: 2,
      useGrouping: false,
    }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Parse a weight string that may use either "." or "," as decimal separator.
 * Always returns a JS number (period-separated internally).
 */
export function parseWeightInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Normalise a decimal input string for the current locale:
 * strips invalid chars, allows one separator (. or ,), and keeps numeric.
 */
export function normalizeDecimalForLocale(text: string, locale: SupportedLocale): string {
  const separator = locale === "en" ? "." : ",";
  const opposite = separator === "." ? "," : ".";
  // Replace the opposite separator so users can type either
  let t = text.replace(opposite, separator).replace(new RegExp(`[^0-9${separator === "." ? "\\." : ","}]`, "g"), "");
  const firstSep = t.indexOf(separator);
  if (firstSep >= 0) {
    t = t.slice(0, firstSep + 1) + t.slice(firstSep + 1).replace(new RegExp(`[${separator === "." ? "\\." : ","}]`, "g"), "");
  }
  if (t.startsWith(separator)) t = `0${t}`;
  return t;
}
