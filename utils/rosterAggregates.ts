import type { StudentSummary } from "../types/StudentSummary";
import type { WorkoutLog } from "../types/Workout";
import { logCompletedMs, sessionsInRollingWindow, startOfWeekMondayMs } from "./coachProgressAnalytics";

export type RosterStatus = "ahead" | "ontrack" | "slipping" | "lagging";

export interface RosterEntry {
  student: StudentSummary;
  status: RosterStatus;
  attentionScore: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  sessionsInPeriod: number;
  weeklyTarget: number | null;
  /** 4-element array: sessions per week oldest→newest, index 3 = current week. */
  sessionsPerWeekSeries: number[];
  /** Consecutive weeks with ≥1 session counting back from the current week. */
  streakWeeks: number;
  /** Populated by prCountInPeriod after buildRosterEntry. */
  prsInPeriod?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Score is `max(0, target*2 - sessionsLast14Days)`. Higher score means
 * the student is more behind. Use this to sort the attention list.
 * Defaults safely when target is null or non-positive (returns 0 → "ontrack").
 */
export function computeAttentionScore(
  sessionsLast14Days: number,
  weeklyTarget: number | null | undefined,
): number {
  if (!weeklyTarget || weeklyTarget <= 0) return 0;
  return Math.max(0, weeklyTarget * 2 - sessionsLast14Days);
}

/**
 * Map a score + recent-week trend to a status bucket.
 * - "ahead":   exceeding target this week
 * - "ontrack": meeting or close to target
 * - "slipping": below target but trending the right way OR was on track last week
 * - "lagging": well below target and not improving
 */
export function statusFromCounts(
  sessionsThisWeek: number,
  sessionsLastWeek: number,
  weeklyTarget: number | null,
): RosterStatus {
  if (!weeklyTarget || weeklyTarget <= 0) return "ontrack";

  if (sessionsThisWeek > weeklyTarget) return "ahead";
  if (sessionsThisWeek >= weeklyTarget) return "ontrack";

  const trending = sessionsThisWeek >= sessionsLastWeek;
  const wasOnTrack = sessionsLastWeek >= weeklyTarget;

  if (trending || wasOnTrack) return "slipping";
  return "lagging";
}

/**
 * Build a per-student roster entry from a student summary and their
 * recent logs. Assumes logs are filtered for THIS student already.
 */
export function buildRosterEntry(
  student: StudentSummary,
  logs: WorkoutLog[],
  weeklyTarget: number | null,
  nowMs: number,
): RosterEntry {
  const thisWeekStart = startOfWeekMondayMs(nowMs);
  const lastWeekStart = thisWeekStart - WEEK_MS;

  const sessionsThisWeek = sessionsInRollingWindow(logs, thisWeekStart, nowMs);
  const sessionsLastWeek = sessionsInRollingWindow(logs, lastWeekStart, thisWeekStart - 1);
  const sessionsLast14Days = sessionsInRollingWindow(logs, nowMs - 14 * DAY_MS, nowMs);
  const sessionsInPeriod = sessionsInRollingWindow(logs, nowMs - 28 * DAY_MS, nowMs);

  // 4-week sparkline: index 0 = 3 weeks ago, index 3 = this week
  const sessionsPerWeekSeries = [3, 2, 1, 0].map((weeksBack) => {
    const wStart = thisWeekStart - weeksBack * WEEK_MS;
    const wEnd = weeksBack === 0 ? nowMs : wStart + WEEK_MS;
    return sessionsInRollingWindow(logs, wStart, wEnd);
  });

  // Consecutive weeks with ≥1 session going back from current week
  const streakWeeks = (() => {
    let streak = 0;
    for (let i = 0; i < 52; i++) {
      const wStart = thisWeekStart - i * WEEK_MS;
      const wEnd = i === 0 ? nowMs : wStart + WEEK_MS;
      const hasSession = logs.some((l) => {
        const ms = logCompletedMs(l);
        return ms >= wStart && ms < wEnd;
      });
      if (!hasSession) break;
      streak++;
    }
    return streak;
  })();

  const attentionScore = computeAttentionScore(sessionsLast14Days, weeklyTarget);
  const status = statusFromCounts(sessionsThisWeek, sessionsLastWeek, weeklyTarget);

  return {
    student,
    status,
    attentionScore,
    sessionsThisWeek,
    sessionsLastWeek,
    sessionsInPeriod,
    weeklyTarget,
    sessionsPerWeekSeries,
    streakWeeks,
  };
}

export interface RosterSummary {
  total: number;
  activeLast14d: number;
  onTrackThisWeek: number;
  percentOnTrack: number;
}

/**
 * Aggregate a fully built roster into a top-line summary.
 */
export function computeRosterSummary(entries: RosterEntry[]): RosterSummary {
  const total = entries.length;
  const activeLast14d = entries.filter((e) => e.sessionsThisWeek > 0 || e.sessionsLastWeek > 0).length;
  const onTrackThisWeek = entries.filter(
    (e) => e.status === "ahead" || e.status === "ontrack",
  ).length;
  const percentOnTrack =
    total > 0 ? Math.round((onTrackThisWeek / total) * 100) : 0;

  return { total, activeLast14d, onTrackThisWeek, percentOnTrack };
}

/**
 * Descending sort by attention score. Stable on score ties (preserves order).
 */
export function sortByAttentionDesc(entries: RosterEntry[]): RosterEntry[] {
  return [...entries].sort((a, b) => b.attentionScore - a.attentionScore);
}

/**
 * Count PR exercises (isPr === true) across all roster logs, bucketed by studentId.
 * Call this once with the full set of recent logs, then populate `prsInPeriod` on entries.
 */
export function prCountInPeriod(
  _entries: RosterEntry[],
  allRosterLogs: WorkoutLog[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of allRosterLogs) {
    const count = (log.exercises ?? []).filter((ex) => ex.isPr === true).length;
    if (count > 0) {
      map.set(log.studentId, (map.get(log.studentId) ?? 0) + count);
    }
  }
  return map;
}

/**
 * Return the top N entries sorted descending by the given metric.
 */
export function topByMetric<T extends RosterEntry>(
  entries: T[],
  metric: "streak" | "prsInPeriod" | "sessionsInPeriod",
  limit: number,
): T[] {
  const getValue = (e: T): number => {
    if (metric === "streak") return e.streakWeeks;
    if (metric === "prsInPeriod") return e.prsInPeriod ?? 0;
    return e.sessionsInPeriod;
  };
  return [...entries].sort((a, b) => getValue(b) - getValue(a)).slice(0, limit);
}
