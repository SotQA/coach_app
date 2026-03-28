import type { WorkoutLog, WorkoutLogExercise } from "../types/Workout";

export function normalizeExerciseName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

/** Reps for volume: single number, or average of a range like "8-12". */
export function parseRepsNumericForVolume(repsDone: string): number {
  const t = String(repsDone ?? "").trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  return 0;
}

export function computeExerciseVolume(
  sets: number,
  repsDone: string,
  weight: number | null
): number {
  if (weight === null || !Number.isFinite(weight) || weight < 0) return 0;
  const r = parseRepsNumericForVolume(repsDone);
  if (r <= 0 || !Number.isFinite(sets) || sets <= 0) return 0;
  return Math.round(sets * r * weight * 100) / 100;
}

export function computeTotalVolume(exercises: Pick<WorkoutLogExercise, "volume">[]): number {
  let t = 0;
  for (const ex of exercises) {
    const v = ex.volume;
    if (typeof v === "number" && Number.isFinite(v)) t += v;
  }
  return Math.round(t * 100) / 100;
}

/** Max logged weight per exercise name across history (for PR detection). */
export function buildBestWeightMapFromLogs(logs: WorkoutLog[]): Map<string, number> {
  const map = new Map<string, number>();

  for (const log of logs) {
    const list =
      Array.isArray(log.exercises) && log.exercises.length > 0
        ? log.exercises
        : [
            {
              name: (log as any).exercise ?? "Exercise",
              weight: (log as any).weight ?? null,
            } as WorkoutLogExercise,
          ];

    for (const ex of list) {
      const key = normalizeExerciseName(ex.name);
      if (!key) continue;
      const w = ex.weight;
      if (w == null || !Number.isFinite(Number(w))) continue;
      const n = Number(w);
      const prev = map.get(key) ?? 0;
      if (n > prev) map.set(key, n);
    }
  }

  return map;
}
