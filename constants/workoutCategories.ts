/**
 * Workout-name → category classification.
 *
 * The patterns are tested against `workoutName.toLowerCase()` in
 * `utils/workoutCategorize.ts`. They exist as regex (rather than plain
 * keyword arrays) because some patterns rely on `\s*` to match variants
 * like "warm up" / "warmup" / "warm  up" — moving to `.includes()` would
 * regress that behavior.
 */

export type WorkoutCategory =
  | "all"
  | "strength"
  | "hypertrophy"
  | "cardio"
  | "mobility"
  | "other";

export interface WorkoutCategoryChip {
  key: WorkoutCategory;
  label: string;
}

/** Display order for the filter-chip row. "all" must be first. */
export const WORKOUT_CATEGORY_ORDER: readonly WorkoutCategoryChip[] = [
  { key: "all", label: "All" },
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Hypertrophy" },
  { key: "cardio", label: "Cardio" },
  { key: "mobility", label: "Mobility" },
  { key: "other", label: "Other" },
] as const;

/**
 * Patterns used to classify a workout name. Order matters — the first
 * match wins. "other" is the fallback when no pattern matches.
 *
 * Patterns are case-insensitive (the `i` flag) so the lowercased input is
 * an implementation detail, not a requirement.
 */
export const WORKOUT_CATEGORY_PATTERNS: ReadonlyArray<{
  key: Exclude<WorkoutCategory, "all" | "other">;
  pattern: RegExp;
}> = [
  { key: "cardio", pattern: /cardio|conditioning|run|bike|rower|hiit/i },
  { key: "mobility", pattern: /mobility|stretch|yoga|recovery|warm\s*up/i },
  {
    key: "strength",
    pattern: /strength|heavy|power|squat|deadlift|bench|press|5×5|5x5/i,
  },
  { key: "hypertrophy", pattern: /hyper|pump|volume|accessory|isolation/i },
] as const;
