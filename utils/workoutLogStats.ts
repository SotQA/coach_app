import type { WorkoutLog, WorkoutLogExercise } from "@/types/Workout";
import { computeExerciseVolumeFromLoggedSets } from "@/utils/workoutMetrics";

type LogLike = WorkoutLog & { exercises: WorkoutLogExercise[] };

/**
 * Total volume (kg) for a session. Prefers the precomputed
 * `log.totalVolume` if present and valid; otherwise sums per-exercise
 * volumes (using `ex.volume` when valid, falling back to per-set compute).
 *
 * Behavior matches the inline implementation that previously lived in
 * `app/student/workoutHistory.tsx`.
 */
export function sessionVolumeKg(log: LogLike): number {
  if (
    typeof log.totalVolume === "number" &&
    Number.isFinite(log.totalVolume) &&
    log.totalVolume > 0
  ) {
    return log.totalVolume;
  }
  let sum = 0;
  for (const ex of log.exercises) {
    const v =
      typeof ex.volume === "number" && Number.isFinite(ex.volume)
        ? ex.volume
        : computeExerciseVolumeFromLoggedSets(ex.sets ?? []);
    sum += v;
  }
  return sum;
}

/** Count of exercises in this log marked as a PR. */
export function countPrs(log: LogLike): number {
  return (log.exercises ?? []).filter((e) => e.isPr).length;
}

/** Compact volume label: "—" when zero/invalid, "1.2k kg" when ≥1000, else "{n} kg". */
export function formatVolumeCompact(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${Math.round(kg)} kg`;
}
