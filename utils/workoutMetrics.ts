import type { LoggedSet, WorkoutLog, WorkoutLogExercise } from "../types/Workout";

export function normalizeExerciseName(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

/** Reps for volume heuristics: single number, or average of a range like "8-12". */
export function parseRepsNumericForVolume(repsDone: string): number {
  const t = String(repsDone ?? "").trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (m) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  return 0;
}

function isLoggedSetRow(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** True when `sets` is the new per-set log array. */
export function isPerSetLogArray(sets: unknown): sets is unknown[] {
  return Array.isArray(sets) && sets.length > 0 && isLoggedSetRow(sets[0]);
}

/** Volume = sum over sets of (reps × weight); null/zero weight contributes 0. */
export function computeExerciseVolumeFromLoggedSets(sets: LoggedSet[] | undefined): number {
  if (!Array.isArray(sets) || sets.length === 0) return 0;
  let t = 0;
  for (const s of sets) {
    const r = s.reps;
    const w = s.weight;
    if (!Number.isFinite(r) || r <= 0) continue;
    if (w == null || !Number.isFinite(w) || w < 0) continue;
    t += r * w;
  }
  return Math.round(t * 100) / 100;
}

export function computeTotalVolume(exercises: WorkoutLogExercise[]): number {
  let total = 0;
  for (const ex of exercises) {
    const v =
      typeof ex.volume === "number" && Number.isFinite(ex.volume)
        ? ex.volume
        : computeExerciseVolumeFromLoggedSets(ex.sets);
    total += v;
  }
  return Math.round(total * 100) / 100;
}

/** Max weight used in the session for this exercise (for PRs / charts). */
export function getSessionMaxWeightFromLogExercise(ex: WorkoutLogExercise): number | null {
  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
    const row0 = ex.sets[0];
    if (typeof row0 === "object" && row0 !== null && "reps" in row0) {
      let m = -Infinity;
      for (const s of ex.sets) {
        if (s.weight != null && Number.isFinite(s.weight)) m = Math.max(m, s.weight);
      }
      return Number.isFinite(m) && m !== -Infinity ? m : null;
    }
  }
  const legacy = (ex as { weight?: unknown }).weight;
  if (typeof legacy === "number" && Number.isFinite(legacy)) return legacy;
  return null;
}

/**
 * Convert legacy log exercise (repsDone + single weight + set count) into per-set rows.
 * Evenly splits integer total reps across sets when repsDone is a plain number string.
 */
export function legacyExerciseToLoggedSets(ex: {
  sets?: unknown;
  repsDone?: unknown;
  reps?: unknown;
  weight?: unknown;
}): LoggedSet[] {
  const setCountRaw = Number(ex?.sets);
  const setCount = Number.isFinite(setCountRaw) && setCountRaw > 0 ? Math.floor(setCountRaw) : 1;

  const repsStr =
    ex?.repsDone != null ? String(ex.repsDone) : ex?.reps != null ? String(ex.reps) : "";
  const wRaw = ex?.weight;
  const w =
    wRaw == null || wRaw === ""
      ? null
      : Number.isFinite(Number(wRaw))
        ? Number(wRaw)
        : null;

  const trimmed = repsStr.trim();
  let perSetReps: number[] = [];

  if (/^\d+$/.test(trimmed)) {
    const total = Number(trimmed);
    const base = Math.floor(total / setCount);
    let rem = total - base * setCount;
    for (let i = 0; i < setCount; i++) {
      perSetReps.push(base + (rem > 0 ? 1 : 0));
      if (rem > 0) rem -= 1;
    }
  } else {
    const avg = parseRepsNumericForVolume(trimmed);
    perSetReps = Array(setCount).fill(Math.max(0, avg));
  }

  return perSetReps.map((reps, i) => ({
    setNumber: i + 1,
    reps: Math.max(0, reps),
    weight: w,
  }));
}

export interface LastSetResult {
  weight: number | null;
  reps: number;
}

/**
 * Returns the sets from the MOST RECENT log for each exercise name.
 * Assumes `logs` is sorted newest-first (as returned by getWorkoutHistory).
 * Used to display last-session results on exercise cards.
 */
export function buildLastResultsMapFromLogs(
  logs: WorkoutLog[]
): Map<string, LastSetResult[]> {
  const map = new Map<string, LastSetResult[]>();
  for (const log of logs) {
    const exercises = Array.isArray(log.exercises) && log.exercises.length > 0
      ? log.exercises
      : [];
    for (const ex of exercises) {
      const key = normalizeExerciseName(ex.name);
      if (!key || map.has(key)) continue;
      map.set(key, ex.sets.map((s) => ({ weight: s.weight, reps: s.reps })));
    }
  }
  return map;
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
              repsPlanned: String((log as any).reps ?? ""),
              sets: legacyExerciseToLoggedSets({
                sets: (log as any).sets ?? 1,
                repsDone: (log as any).reps,
                weight: (log as any).weight,
              }),
              rest: "",
              tempo: "",
              rpe: null,
            } as WorkoutLogExercise,
          ];

    for (const ex of list) {
      const key = normalizeExerciseName(ex.name);
      if (!key) continue;
      const maxW = getSessionMaxWeightFromLogExercise(ex as WorkoutLogExercise);
      if (maxW == null) continue;
      const prev = map.get(key) ?? 0;
      if (maxW > prev) map.set(key, maxW);
    }
  }

  return map;
}
