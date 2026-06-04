import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { workoutService } from "@/services/workoutService";
import { trainingGroupService } from "@/services/trainingGroupService";
import type { WorkoutLog } from "@/types/Workout";
import type { TrainingGroup } from "@/types/TrainingGroup";
import {
  logCompletedMs,
  presetToStartMs,
  startOfWeekMondayMs,
  totalVolumeFromLogs,
  buildWeeklyVolumeVsLoad,
  buildWeekly1RMSeries,
  peakE1RMFromLogs,
  collectPRsInRange,
  detectPlateau,
  buildCoachingSignals,
  comparePeriods,
  compliancePercentFromLogs,
  complianceDelta,
  weekLabel,
  type TimeRangePreset,
  type CoachingSignal,
  type PRRecord,
} from "@/utils/coachProgressAnalytics";
import { normalizeExerciseName } from "@/utils/workoutMetrics";
import { dayKeyFromMs } from "@/utils/dateRanges";
import { logger } from "@/utils/logger";

export interface StrengthRow {
  exerciseName: string;
  currentE1RM: number | null;
  deltaKg: number | null;
  points: number[];
}

export interface UseStudentProgressResult {
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  onRefresh: () => void;

  hasAnyLogs: boolean;
  hasMinimumData: boolean;

  timePreset: TimeRangePreset;
  setTimePreset: (p: TimeRangePreset) => void;
  rangeStartMs: number | null;
  rangeEndMs: number;
  weeklyTarget: number | null;

  streakWeeks: number;
  sessionsThisWeek: number;
  totalVolumeInRange: number;
  totalVolumeDeltaPct: number | null;

  countsByDay: Record<string, number>;

  strengthRows: StrengthRow[];
  hasMoreStrengthRows: boolean;
  allStrengthRows: StrengthRow[];

  weeklyVolumeBars: Array<{ label: string; value: number }>;

  recentPRs: PRRecord[];

  coachingSignals: CoachingSignal[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function useStudentProgress(
  user: { id: string; role: string } | null | undefined,
): UseStudentProgressResult {
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("8w");
  const [refreshing, setRefreshing] = useState(false);

  const fetcher = useCallback(async (): Promise<{ logs: WorkoutLog[]; group: TrainingGroup | null }> => {
    if (!user || !["student", "athlete"].includes(user.role)) {
      throw new Error("You must be logged in.");
    }
    const [logsResult, groupResult] = await Promise.allSettled([
      workoutService.getWorkoutHistory(user.id),
      trainingGroupService.getLatestGroupForStudentId(user.id),
    ]);

    const logs =
      logsResult.status === "fulfilled" && Array.isArray(logsResult.value)
        ? logsResult.value
        : [];

    let group: TrainingGroup | null = null;
    if (groupResult.status === "fulfilled") {
      group = groupResult.value;
    } else {
      logger.warn("[useStudentProgress] training group fetch failed", groupResult.reason);
    }

    return { logs, group };
  }, [user]);

  const { data, loading, error, reload } = useAsyncData<{
    logs: WorkoutLog[];
    group: TrainingGroup | null;
  }>(fetcher, [fetcher]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  const logs = useMemo(() => data?.logs ?? [], [data]);
  const group = useMemo(() => data?.group ?? null, [data]);
  const weeklyTarget = useMemo(() => group?.workoutsPerWeek ?? null, [group]);

  // Stable "now" — recalculated only when the data changes, not on every render.
  const rangeEndMs = useMemo(() => Date.now(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const rangeStartMs = useMemo(
    () => presetToStartMs(timePreset, rangeEndMs),
    [timePreset, rangeEndMs],
  );

  // Normalize every log with a cached _ms so derivations avoid repeated calls.
  const normalizedLogs = useMemo(
    () =>
      logs
        .map((l) => ({ log: l, _ms: logCompletedMs(l) }))
        .filter((x) => x._ms > 0),
    [logs],
  );

  const logsInRange = useMemo(() => {
    if (rangeStartMs == null) return normalizedLogs.map((x) => x.log);
    return normalizedLogs
      .filter((x) => x._ms >= rangeStartMs)
      .map((x) => x.log);
  }, [normalizedLogs, rangeStartMs]);

  const hasAnyLogs = normalizedLogs.length > 0;
  const hasMinimumData = logsInRange.length >= 2;

  // ── Section 3.1 ─────────────────────────────────────────────────────────────

  const streakWeeks = useMemo(() => {
    const thisWeekStart = startOfWeekMondayMs(Date.now());
    const hasSessionInWeek = (start: number) =>
      normalizedLogs.some((x) => x._ms >= start && x._ms < start + WEEK_MS);

    const thisWeekHasSessions = hasSessionInWeek(thisWeekStart);
    let weekStart = thisWeekHasSessions ? thisWeekStart : thisWeekStart - WEEK_MS;
    let streak = 0;

    for (let i = 0; i < 104; i++) {
      if (!hasSessionInWeek(weekStart)) break;
      streak++;
      weekStart -= WEEK_MS;
    }
    return streak;
  }, [normalizedLogs]);

  const sessionsThisWeek = useMemo(() => {
    const thisWeekStart = startOfWeekMondayMs(Date.now());
    return normalizedLogs.filter((x) => x._ms >= thisWeekStart).length;
  }, [normalizedLogs]);

  const totalVolumeInRange = useMemo(
    () => totalVolumeFromLogs(logsInRange, null, null, rangeEndMs),
    [logsInRange, rangeEndMs],
  );

  const totalVolumeDeltaPct = useMemo(() => {
    if (rangeStartMs == null) return null;
    const periodLen = rangeEndMs - rangeStartMs;
    const prevStart = rangeStartMs - periodLen;
    const prevLogs = normalizedLogs
      .filter((x) => x._ms >= prevStart && x._ms < rangeStartMs)
      .map((x) => x.log);
    return comparePeriods(logsInRange, prevLogs, null, "volume").deltaPct;
  }, [logsInRange, normalizedLogs, rangeStartMs, rangeEndMs]);

  // ── Section 3.2: heatmap (fixed 12-week scope) ───────────────────────────────

  const countsByDay = useMemo<Record<string, number>>(() => {
    const cutoff = Date.now() - 84 * 24 * 60 * 60 * 1000;
    const map: Record<string, number> = {};
    for (const { _ms } of normalizedLogs) {
      if (_ms < cutoff) continue;
      const key = dayKeyFromMs(_ms);
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [normalizedLogs]);

  // ── Section 3.3: strength sparklines ────────────────────────────────────────

  const { strengthRows, hasMoreStrengthRows, allStrengthRows } = useMemo(() => {
    const freqMap = new Map<string, { displayName: string; count: number }>();
    for (const log of logsInRange) {
      const seen = new Set<string>();
      for (const ex of log.exercises ?? []) {
        const norm = normalizeExerciseName(ex.name);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        const entry = freqMap.get(norm);
        if (entry) {
          entry.count++;
        } else {
          freqMap.set(norm, { displayName: String(ex.name ?? "").trim(), count: 1 });
        }
      }
    }

    const sortedEntries = Array.from(freqMap.entries()).sort((a, b) => b[1].count - a[1].count);

    const prevPeriodStart = rangeStartMs != null
      ? rangeStartMs - (rangeEndMs - rangeStartMs)
      : null;

    const buildRow = (norm: string, displayName: string): StrengthRow => {
      const currentE1RM = peakE1RMFromLogs(logsInRange, norm, null, rangeEndMs);
      let deltaKg: number | null = null;
      if (prevPeriodStart != null && rangeStartMs != null) {
        const prevLogs = normalizedLogs
          .filter((x) => x._ms >= prevPeriodStart && x._ms < rangeStartMs)
          .map((x) => x.log);
        const prevE1RM = peakE1RMFromLogs(prevLogs, norm, null, rangeEndMs);
        if (currentE1RM > 0 && prevE1RM > 0) {
          deltaKg = Math.round((currentE1RM - prevE1RM) * 10) / 10;
        }
      }
      const points = buildWeekly1RMSeries(logsInRange, norm, rangeStartMs, rangeEndMs).map(
        (p) => p.value,
      );
      return {
        exerciseName: displayName,
        currentE1RM: currentE1RM > 0 ? currentE1RM : null,
        deltaKg,
        points,
      };
    };

    const allRows = sortedEntries.map(([norm, { displayName }]) => buildRow(norm, displayName));
    const top5Rows = sortedEntries
      .slice(0, 5)
      .map(([norm, { displayName }]) => buildRow(norm, displayName))
      .filter((r) => r.currentE1RM != null);

    return {
      strengthRows: top5Rows,
      hasMoreStrengthRows: sortedEntries.length > 5,
      allStrengthRows: allRows.filter((r) => r.currentE1RM != null),
    };
  }, [logsInRange, normalizedLogs, rangeStartMs, rangeEndMs]);

  // ── Section 3.4: weekly volume bars ─────────────────────────────────────────

  const weeklyVolumeBars = useMemo(() => {
    const series = buildWeeklyVolumeVsLoad(logsInRange, null, rangeStartMs, rangeEndMs);
    return series
      .filter((w) => w.volume > 0)
      .map((w) => ({ label: weekLabel(w.weekStartMs), value: w.volume }));
  }, [logsInRange, rangeStartMs, rangeEndMs]);

  // ── Section 3.5: recent PRs ──────────────────────────────────────────────────

  const recentPRs = useMemo(
    () => collectPRsInRange(logs, rangeStartMs, rangeEndMs).slice(0, 10),
    [logs, rangeStartMs, rangeEndMs],
  );

  // ── Section 3.6: coaching signals ────────────────────────────────────────────

  const coachingSignals = useMemo((): CoachingSignal[] => {
    const thisWeekStart = startOfWeekMondayMs(Date.now());
    const prevWeekStart = thisWeekStart - WEEK_MS;
    const prevWeekCount = normalizedLogs.filter(
      (x) => x._ms >= prevWeekStart && x._ms < thisWeekStart,
    ).length;
    const compliancePct = weeklyTarget
      ? compliancePercentFromLogs(logsInRange, weeklyTarget, rangeEndMs)
      : null;
    const compliancePrevDelta = weeklyTarget
      ? complianceDelta(prevWeekCount, sessionsThisWeek, weeklyTarget)
      : null;

    const volLoad = buildWeeklyVolumeVsLoad(logsInRange, null, rangeStartMs, rangeEndMs);
    const topExNorm = strengthRows[0]
      ? normalizeExerciseName(strengthRows[0].exerciseName)
      : null;
    const weekly1RM = topExNorm
      ? buildWeekly1RMSeries(logsInRange, topExNorm, rangeStartMs, rangeEndMs)
      : [];

    const signals = buildCoachingSignals(weekly1RM, volLoad, compliancePct, compliancePrevDelta);

    const plateauSignals: CoachingSignal[] = [];
    for (const row of strengthRows) {
      const norm = normalizeExerciseName(row.exerciseName);
      const series = buildWeekly1RMSeries(logsInRange, norm, rangeStartMs, rangeEndMs);
      const result = detectPlateau(series, 3);
      if (result.plateau) {
        plateauSignals.push({
          text: `${row.exerciseName} 1RM hasn't grown in ${result.weeksWithoutGain} weeks.`,
          status: "yellow",
        });
      }
    }

    return [...signals, ...plateauSignals].slice(0, 8);
  }, [logsInRange, normalizedLogs, strengthRows, weeklyTarget, sessionsThisWeek, rangeStartMs, rangeEndMs]);

  return {
    loading,
    error,
    refreshing,
    onRefresh,
    hasAnyLogs,
    hasMinimumData,
    timePreset,
    setTimePreset,
    rangeStartMs,
    rangeEndMs,
    weeklyTarget,
    streakWeeks,
    sessionsThisWeek,
    totalVolumeInRange,
    totalVolumeDeltaPct,
    countsByDay,
    strengthRows,
    hasMoreStrengthRows,
    allStrengthRows,
    weeklyVolumeBars,
    recentPRs,
    coachingSignals,
  };
}
