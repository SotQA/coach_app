/** Live timer: mm:ss, or hh:mm:ss when ≥ 1 hour. */
export function formatElapsedForTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/** History row, e.g. "52 min", "1 h 5 min", "45 sec". */
export function formatDurationForHistory(seconds: number | undefined | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.floor(seconds);
  if (s === 0) return null;
  if (s < 60) return `${s} sec`;
  const minTotal = Math.round(s / 60);
  if (minTotal < 60) return `${minTotal} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}
