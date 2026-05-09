import { toMs } from "@/utils/dateConvert";
import { dayKeyFromMs, startOfWeekMonday } from "@/utils/dateRanges";
import type { TrainingGroup } from "@/types/TrainingGroup";
import type { WorkoutLog, WorkoutPlan } from "@/types/Workout";

function logCompletedMs(log: WorkoutLog): number {
  return toMs(log.completedAt ?? log.date);
}

/**
 * Counts today + each previous consecutive day with a logged workout.
 * Phase 1.7 behavior: if a log exists for today, streak starts at 1;
 * otherwise it starts at 0 and counts back from yesterday.
 */
export function currentStreakDays(logs: WorkoutLog[], now: Date = new Date()): number {
  if (logs.length === 0) return 0;
  const days = new Set<string>();
  for (const l of logs) {
    const ms = logCompletedMs(l);
    if (ms > 0) days.add(dayKeyFromMs(ms));
  }
  const keyFor = (d: Date) => dayKeyFromMs(d.getTime());
  const hasToday = days.has(keyFor(now));
  let streak = hasToday ? 1 : 0;
  const cursor = new Date(now.getTime());
  cursor.setDate(cursor.getDate() - 1);
  if (!hasToday && !days.has(keyFor(cursor))) return 0;
  while (days.has(keyFor(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Compliance % over the last 7 days vs weekly target (coach's workouts/week on the active group).
 * Returns null when the target is missing, zero, or non-finite (Phase 1.6 guard).
 * Result is clamped to [0, 999].
 */
export function compliancePercent(
  logs: WorkoutLog[],
  weeklyTarget: number | null | undefined,
  now: Date = new Date()
): number | null {
  const wpw = weeklyTarget ?? 0;
  if (!wpw || !Number.isFinite(wpw) || wpw <= 0) {
    return null;
  }
  const nowMs = now.getTime();
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const count7 = logs.filter((l) => {
    const ms = logCompletedMs(l);
    return ms >= weekAgo && ms <= nowMs;
  }).length;
  return Math.max(0, Math.min(999, Math.round((count7 / wpw) * 100)));
}

/** Same short date label as the pre-refactor screen (`MMM d` in local locale). */
export function lastWorkoutLabel(logs: WorkoutLog[], now: Date = new Date()): string | null {
  void now;
  const lastWorkoutMs = logs[0] ? logCompletedMs(logs[0]) : 0;
  if (lastWorkoutMs <= 0) return null;
  return new Date(lastWorkoutMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function buildPlanById(plans: WorkoutPlan[]): Map<string, WorkoutPlan> {
  const m = new Map<string, WorkoutPlan>();
  for (const p of plans) m.set(p.id, p);
  return m;
}

export interface WeeklyProgress {
  completed: number;
  target: number;
  ratio: number;
}

/**
 * Weekly progress for the current week-of-Monday (local midnight boundaries, same as pre-refactor `startOfWeekMs`).
 * Filters logs to those whose plan's `groupId` matches the active training group — preserves screen logic.
 */
export function weeklyProgress(
  logs: WorkoutLog[],
  latestGroup: TrainingGroup | null | undefined,
  planById: Map<string, WorkoutPlan>,
  now: Date = new Date()
): WeeklyProgress {
  const wpw = latestGroup?.workoutsPerWeek ?? 0;
  if (!latestGroup?.id || !wpw || wpw <= 0) {
    return { completed: 0, target: wpw, ratio: 0 };
  }
  const nowMs = now.getTime();
  const start = startOfWeekMonday(new Date(nowMs)).getTime();
  const end = nowMs;
  const completed = logs.filter((l) => {
    const ms = logCompletedMs(l);
    if (ms < start || ms > end) return false;
    const plan = planById.get(l.workoutPlanId);
    return plan?.groupId === latestGroup.id;
  }).length;
  const ratio = Math.max(0, Math.min(1, completed / wpw));
  return { completed, target: wpw, ratio };
}

export function assignedProgramBarPercent(
  compliancePercentValue: number | null,
  wp: WeeklyProgress
): number {
  if (typeof compliancePercentValue === "number" && Number.isFinite(compliancePercentValue)) {
    return Math.max(0, Math.min(100, Math.round(compliancePercentValue)));
  }
  return Math.round(wp.ratio * 100);
}

/** Mirrors inline avg duration: first ≤10 logs with finite durationSeconds > 0, floor of mean. */
export function averageRecentDurationSeconds(logs: WorkoutLog[]): number | null {
  const items = logs
    .map((l) =>
      typeof l.durationSeconds === "number" && Number.isFinite(l.durationSeconds) ? l.durationSeconds : null
    )
    .filter((n): n is number => n !== null && n > 0)
    .slice(0, 10);
  if (items.length === 0) return null;
  return Math.floor(items.reduce((a, b) => a + b, 0) / items.length);
}
