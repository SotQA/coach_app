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
  weeklyVolumeBars: { label: string; value: number }[];
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
  const weeklyTarget = useMemo(() => data?.group?.workoutsPerWeek ?? null, [data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rangeEndMs = useMemo(() => Date.now(), [data]);
  const rangeStartMs = useMemo(() => presetToStartMs(timePreset, rangeEndMs), [timePreset, rangeEndMs]);

  const normalizedLogs = useMemo(
    () => logs.map((l) => ({ log: l, _ms: logCompletedMs(l) })).filter((x) => x._ms > 0),
    [logs],
  );

  const logsInRange = useMemo(() => {
    if (rangeStartMs == null) return normalizedLogs.map((x) => x.log);
    return normalizedLogs.filter((x) => x._ms >= rangeStartMs).map((x) => x.log);
  }, [normalizedLogs, rangeStartMs]);

  const hasAnyLogs = normalizedLogs.length > 0;
  const hasMinimumData = logsInRange.length >= 2;

  const streakWeeks = useMemo(() => {
    const thisWeekStart = startOfWeekMondayMs(Date.now());
    const has = (start: number) => normalizedLogs.some((x) => x._ms >= start && x._ms < start + WEEK_MS);
    const thisHas = has(thisWeekStart);
    let week = thisHas ? thisWeekStart : thisWeekStart - WEEK_MS;
    let streak = 0;
    for (let i = 0; i < 104; i++) {
      if (!has(week)) break;
      streak++;
      week -= WEEK_MS;
    }
    return streak;
  }, [normalizedLogs]);

  const sessionsThisWeek = useMemo(() => {
    const start = startOfWeekMondayMs(Date.now());
    return normalizedLogs.filter((x) => x._ms >= start).length;
  }, [normalizedLogs]);

  const totalVolumeInRange = useMemo(
    () => totalVolumeFromLogs(logsInRange, null, null, rangeEndMs),
    [logsInRange, rangeEndMs],
  );

  const totalVolumeDeltaPct = useMemo(() => {
    if (rangeStartMs == null) return null;
    const len = rangeEndMs - rangeStartMs;
    const prevStart = rangeStartMs - len;
    const prevLogs = normalizedLogs.filter((x) => x._ms >= prevStart && x._ms < rangeStartMs).map((x) => x.log);
    return comparePeriods(logsInRange, prevLogs, null, "volume").deltaPct;
  }, [logsInRange, normalizedLogs, rangeStartMs, rangeEndMs]);

  const countsByDay = useMemo<Record<string, number>>(() => {
    const cutoff = Date.now() - 84 * 24 * 60 * 60 * 1000;
    const map: Record<string, number> = {};
    for (const { _ms } of normalizedLogs) {
      if (_ms < cutoff) continue;
      const k = dayKeyFromMs(_ms);
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [normalizedLogs]);

  const { strengthRows, hasMoreStrengthRows, allStrengthRows } = useMemo(() => {
    const freqMap = new Map<string, { displayName: string; count: number }>();
    for (const log of logsInRange) {
      const seen = new Set<string>();
      for (const ex of log.exercises ?? []) {
        const norm = normalizeExerciseName(ex.name);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        const e = freqMap.get(norm);
        if (e) e.count++;
        else freqMap.set(norm, { displayName: String(ex.name ?? "").trim(), count: 1 });
      }
    }
    const sorted = Array.from(freqMap.entries()).sort((a, b) => b[1].count - a[1].count);
    const prevPeriodStart = rangeStartMs != null ? rangeStartMs - (rangeEndMs - rangeStartMs) : null;

    const buildRow = (norm: string, displayName: string): StrengthRow => {
      const cur = peakE1RMFromLogs(logsInRange, norm, null, rangeEndMs);
      const prevLogs = prevPeriodStart != null && rangeStartMs != null
        ? normalizedLogs.filter((x) => x._ms >= prevPeriodStart! && x._ms < rangeStartMs!).map((x) => x.log)
        : [];
      const prev = prevLogs.length ? peakE1RMFromLogs(prevLogs, norm, null, rangeEndMs) : 0;
      const deltaKg = cur > 0 && prev > 0 ? Math.round((cur - prev) * 10) / 10 : null;
      const points = buildWeekly1RMSeries(logsInRange, norm, rangeStartMs, rangeEndMs).map((p) => p.value);
      return { exerciseName: displayName, currentE1RM: cur > 0 ? cur : null, deltaKg, points };
    };

    const allRows = sorted.map(([n, { displayName }]) => buildRow(n, displayName));
    const top5 = sorted.slice(0, 5).map(([n, { displayName }]) => buildRow(n, displayName)).filter((r) => r.currentE1RM != null);
    return { strengthRows: top5, hasMoreStrengthRows: sorted.length > 5, allStrengthRows: allRows.filter((r) => r.currentE1RM != null) };
  }, [logsInRange, normalizedLogs, rangeStartMs, rangeEndMs]);

  const weeklyVolumeBars = useMemo(() =>
    buildWeeklyVolumeVsLoad(logsInRange, null, rangeStartMs, rangeEndMs)
      .filter((w) => w.volume > 0)
      .map((w) => ({ label: weekLabel(w.weekStartMs), value: w.volume })),
    [logsInRange, rangeStartMs, rangeEndMs],
  );

  const recentPRs = useMemo(
    () => collectPRsInRange(logs, rangeStartMs, rangeEndMs).slice(0, 10),
    [logs, rangeStartMs, rangeEndMs],
  );

  const coachingSignals = useMemo((): CoachingSignal[] => {
    const thisWeekStart = startOfWeekMondayMs(Date.now());
    const prevWeekCount = normalizedLogs.filter(
      (x) => x._ms >= thisWeekStart - WEEK_MS && x._ms < thisWeekStart,
    ).length;
    const compliancePct = weeklyTarget
      ? compliancePercentFromLogs(logsInRange, weeklyTarget, rangeEndMs)
      : null;
    const compliancePrevDelta = weeklyTarget
      ? complianceDelta(prevWeekCount, sessionsThisWeek, weeklyTarget)
      : null;
    const volLoad = buildWeeklyVolumeVsLoad(logsInRange, null, rangeStartMs, rangeEndMs);
    const topNorm = strengthRows[0] ? normalizeExerciseName(strengthRows[0].exerciseName) : null;
    const weekly1RM = topNorm ? buildWeekly1RMSeries(logsInRange, topNorm, rangeStartMs, rangeEndMs) : [];
    const signals = buildCoachingSignals(weekly1RM, volLoad, compliancePct, compliancePrevDelta);

    const plateauSignals: CoachingSignal[] = [];
    for (const row of strengthRows) {
      const series = buildWeekly1RMSeries(logsInRange, normalizeExerciseName(row.exerciseName), rangeStartMs, rangeEndMs);
      const result = detectPlateau(series, 3);
      if (result.plateau) {
        plateauSignals.push({ text: `${row.exerciseName} 1RM hasn't grown in ${result.weeksWithoutGain} weeks.`, status: "yellow" });
      }
    }
    return [...signals, ...plateauSignals].slice(0, 8);
  }, [logsInRange, normalizedLogs, strengthRows, weeklyTarget, sessionsThisWeek, rangeStartMs, rangeEndMs]);

  return {
    loading, error, refreshing, onRefresh,
    hasAnyLogs, hasMinimumData,
    timePreset, setTimePreset, rangeStartMs, rangeEndMs, weeklyTarget,
    streakWeeks, sessionsThisWeek, totalVolumeInRange, totalVolumeDeltaPct,
    countsByDay,
    strengthRows, hasMoreStrengthRows, allStrengthRows,
    weeklyVolumeBars, recentPRs, coachingSignals,
  };
}
