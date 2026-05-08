/**
 * Date-range helpers used by workout calendar and compliance views.
 *
 * All functions operate in the device's LOCAL timezone (not UTC).
 * Timezone-correct date handling is deferred to a future phase.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Returns a YYYY-MM-DD key string in local timezone. */
export function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convenience: returns a YYYY-MM-DD key from a Date object. */
export function dayKeyFromDate(d: Date): string {
  return dayKeyFromMs(d.getTime());
}

/** True if two Date objects represent the same local calendar day. */
export function isSameDayLocal(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Monday of the week that contains `d`, at midnight local time. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/** Sunday (end of week) at 23:59:59.999 local time, for the week containing `d`. */
export function endOfWeek(d: Date): Date {
  const start = startOfWeekMonday(d);
  const end = new Date(start.getTime() + WEEK_MS - 1);
  return end;
}

/** First millisecond of the month containing `d` (day 1, midnight local). */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last millisecond of the month containing `d` (last day, 23:59:59.999 local). */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, -1);
}

/** Returns a new Date shifted by `delta` months (same day-of-month, clamped by month length). */
export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** True if two dates share the same local year and month. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * True if the timestamp falls within the current ISO week (Mon–Sun, local TZ).
 * Returns false for 0 / falsy values.
 */
export function isInCurrentWeek(ms: number): boolean {
  if (!ms) return false;
  const start = startOfWeekMonday(new Date()).getTime();
  return ms >= start && ms < start + WEEK_MS;
}

/**
 * True if the timestamp falls within the current calendar month (local TZ).
 * Compares year and month only — not UTC.
 */
export function isInCurrentMonth(ms: number, ref = new Date()): boolean {
  if (!ms) return false;
  const d = new Date(ms);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** Monday-based day index: Monday = 0, … Sunday = 6. */
export function mondayIndexFromDate(d: Date): number {
  return (d.getDay() + 6) % 7;
}
