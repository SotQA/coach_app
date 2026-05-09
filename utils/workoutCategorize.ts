import {
  WORKOUT_CATEGORY_PATTERNS,
  type WorkoutCategory,
} from "@/constants/workoutCategories";

/**
 * Classify a workout name into a category. Returns "other" when no
 * pattern matches (matching the screen's prior inline behavior).
 *
 * NOTE: `null`/`undefined`/empty input maps to "other", not a separate
 * "unclassified" bucket — this preserves the behavior of the inline
 * function that this util replaces.
 */
export function categorizeWorkoutName(
  name: string | null | undefined,
): Exclude<WorkoutCategory, "all"> {
  const n = (name ?? "").toLowerCase();
  for (const { key, pattern } of WORKOUT_CATEGORY_PATTERNS) {
    if (pattern.test(n)) return key;
  }
  return "other";
}

/** True if a categorized log matches the active filter chip. */
export function logMatchesCategory(
  logCategory: Exclude<WorkoutCategory, "all">,
  filter: WorkoutCategory,
): boolean {
  if (filter === "all") return true;
  return logCategory === filter;
}
