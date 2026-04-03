/** Format Firestore Timestamp, ISO string, or Date for display. */
export function formatLogWhen(value: unknown): string {
  if (value == null) return "—";
  try {
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "—";
    }
    if (value instanceof Date) return value.toLocaleString();
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date ? d.toLocaleString() : "—";
    }
  } catch {
    /* ignore */
  }
  return "—";
}
