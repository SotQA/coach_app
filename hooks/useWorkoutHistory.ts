import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  normalizeLoggedExercise,
  workoutService,
} from "@/services/workoutService";
import type { WorkoutLog, WorkoutLogExercise } from "@/types/Workout";
import { toMs } from "@/utils/dateConvert";
import {
  addMonths,
  dayKeyFromDate,
  dayKeyFromMs,
  isSameMonth,
  mondayIndexFromDate,
  startOfMonth,
} from "@/utils/dateRanges";
import { categorizeWorkoutName } from "@/utils/workoutCategorize";
import {
  WORKOUT_CATEGORY_ORDER,
  type WorkoutCategory,
  type WorkoutCategoryChip,
} from "@/constants/workoutCategories";
import { sessionVolumeKg } from "@/utils/workoutLogStats";

/**
 * A normalized history log with derived fields the calendar/list need.
 * `_ms` and `_category` are private to this hook and its consumers —
 * downstream code should not expect them on a vanilla `WorkoutLog`.
 */
export type LogWithMeta = WorkoutLog & {
  exercises: WorkoutLogExercise[];
  _ms: number;
  _category: Exclude<WorkoutCategory, "all">;
};

/** Calendar grid cell. `pad` cells render blank; `day` cells render a date. */
export type CalCell =
  | { kind: "pad" }
  | { kind: "day"; date: Date; dayNum: number };

export interface DayAggregate {
  count: number;
  volume: number;
}

export interface UseWorkoutHistoryResult {
  // ── Data ────────────────────────────────────────────────────────────
  loading: boolean;
  loadError: Error | null;
  refreshing: boolean;
  onRefresh: () => void;
  reload: () => void;

  hasAnyLogs: boolean;
  filteredLogs: LogWithMeta[];
  logsForSelectedDay: LogWithMeta[];

  // ── Calendar ────────────────────────────────────────────────────────
  visibleMonth: Date;
  monthLabel: string;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  calendarCells: CalCell[];
  countsByDay: Record<string, DayAggregate>;
  heatOpacity: (count: number) => number;
  todayKey: string;

  // ── Selection ───────────────────────────────────────────────────────
  selectedDayKey: string | null;
  setSelectedDayKey: (k: string | null) => void;
  selectedDayLabel: string;

  // ── Filter ──────────────────────────────────────────────────────────
  filterCategory: WorkoutCategory;
  setFilterCategory: (c: WorkoutCategory) => void;
  chipsPresent: readonly WorkoutCategoryChip[];

  // ── Expand/collapse ─────────────────────────────────────────────────
  expandedLogId: string | null;
  toggleLogExpanded: (id: string) => void;
}

/**
 * Owns all state and derivations for the WorkoutHistory screen:
 * data load, month navigation, filter chip selection, day selection,
 * and per-card expand/collapse. The screen becomes a thin renderer.
 *
 * Behavior is preserved verbatim from the pre-refactor inline implementation.
 */
export function useWorkoutHistory(
  user: { id: string; role: string } | null | undefined,
): UseWorkoutHistoryResult {
  // ── Local state ───────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<WorkoutCategory>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // ── Data load ─────────────────────────────────────────────────────────
  const fetcher = useCallback(async (): Promise<WorkoutLog[]> => {
    if (!user || user.role !== "student") {
      throw new Error("You must be logged in as a student.");
    }
    const history = await workoutService.getWorkoutHistory(user.id);
    return Array.isArray(history) ? history : [];
  }, [user]);

  const {
    data: fetchedLogs,
    loading,
    error: loadError,
    reload,
  } = useAsyncData<WorkoutLog[]>(fetcher, [fetcher]);

  const logs = useMemo(() => fetchedLogs ?? [], [fetchedLogs]);

  const normalizedLogs = useMemo<LogWithMeta[]>(() => {
    return logs.map((log) => {
      const exercises: WorkoutLogExercise[] =
        Array.isArray(log.exercises) && log.exercises.length > 0
          ? log.exercises
          : [
              normalizeLoggedExercise({
                name: log.exercise ?? "Exercise",
                sets: log.sets ?? 1,
                repsPlanned: String(log.reps ?? ""),
                repsDone: String(log.reps ?? ""),
                weight: log.weight ?? null,
              } as Record<string, unknown>),
            ];
      const when =
        (log as { completedAt?: unknown; date?: unknown }).completedAt ??
        (log as { date?: unknown }).date;
      const ms = toMs(when);
      const name = log.workoutName || "Workout";
      return {
        ...log,
        exercises,
        _ms: ms,
        _category: categorizeWorkoutName(name),
      };
    });
  }, [logs]);

  // ── Refresh handling ──────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  // ── Derived: month label, in-month + filtered logs ────────────────────
  const monthLabel = useMemo(
    () =>
      visibleMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [visibleMonth],
  );

  const logsInVisibleMonth = useMemo(() => {
    const y = visibleMonth.getFullYear();
    const m = visibleMonth.getMonth();
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    return normalizedLogs.filter(
      (l) => l._ms >= start && l._ms <= end && l._ms > 0,
    );
  }, [normalizedLogs, visibleMonth]);

  const filteredLogs = useMemo(() => {
    if (filterCategory === "all") return logsInVisibleMonth;
    return logsInVisibleMonth.filter((l) => l._category === filterCategory);
  }, [logsInVisibleMonth, filterCategory]);

  const chipsPresent = useMemo<readonly WorkoutCategoryChip[]>(() => {
    const set = new Set<WorkoutCategory>(["all"]);
    for (const l of logsInVisibleMonth) {
      set.add(l._category === "other" ? "other" : l._category);
    }
    return WORKOUT_CATEGORY_ORDER.filter((c) => set.has(c.key));
  }, [logsInVisibleMonth]);

  // ── Per-day aggregates and heatmap ────────────────────────────────────
  const countsByDay = useMemo(() => {
    const map: Record<string, DayAggregate> = {};
    for (const l of filteredLogs) {
      const k = dayKeyFromMs(l._ms);
      if (!map[k]) map[k] = { count: 0, volume: 0 };
      map[k].count += 1;
      map[k].volume += sessionVolumeKg(l);
    }
    return map;
  }, [filteredLogs]);

  const maxSessionsInMonth = useMemo(() => {
    let max = 0;
    for (const v of Object.values(countsByDay)) {
      if (v.count > max) max = v.count;
    }
    return max;
  }, [countsByDay]);

  const heatOpacity = useCallback(
    (count: number): number => {
      if (count <= 0) return 0;
      if (maxSessionsInMonth <= 0) return 0.35;
      const t = count / maxSessionsInMonth;
      return 0.2 + t * 0.75;
    },
    [maxSessionsInMonth],
  );

  // ── Calendar cells ────────────────────────────────────────────────────
  const calendarCells = useMemo<CalCell[]>(() => {
    const y = visibleMonth.getFullYear();
    const m = visibleMonth.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const pad = mondayIndexFromDate(first);
    const cells: CalCell[] = [];
    for (let i = 0; i < pad; i++) cells.push({ kind: "pad" });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ kind: "day", date: new Date(y, m, d), dayNum: d });
    }
    while (cells.length % 7 !== 0) cells.push({ kind: "pad" });
    return cells;
  }, [visibleMonth]);

  const todayKey = dayKeyFromDate(new Date());

  // ── Selection ─────────────────────────────────────────────────────────
  const logsForSelectedDay = useMemo(() => {
    if (!selectedDayKey) return [];
    return filteredLogs
      .filter((l) => dayKeyFromMs(l._ms) === selectedDayKey)
      .sort((a, b) => b._ms - a._ms);
  }, [filteredLogs, selectedDayKey]);

  // Auto-select a sensible day when month or filter changes.
  // Behavior: today (if in current month and has a log under filter), else
  // most recent in-month log day; null when no logs are visible.
  const monthFilterKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${filterCategory}`;
  const prevMonthFilterKey = useRef<string>("");

  useEffect(() => {
    if (filteredLogs.length === 0) {
      setSelectedDayKey(null);
      prevMonthFilterKey.current = monthFilterKey;
      return;
    }

    const monthOrFilterChanged =
      prevMonthFilterKey.current !== monthFilterKey;
    prevMonthFilterKey.current = monthFilterKey;

    if (!monthOrFilterChanged) {
      return;
    }

    const y = visibleMonth.getFullYear();
    const m = visibleMonth.getMonth();
    const inMonth = (ms: number) => {
      const d = new Date(ms);
      return d.getFullYear() === y && d.getMonth() === m;
    };

    const today = new Date();
    if (isSameMonth(today, visibleMonth)) {
      const tk = todayKey;
      if (filteredLogs.some((l) => dayKeyFromMs(l._ms) === tk)) {
        setSelectedDayKey(tk);
        return;
      }
    }
    let bestMs = 0;
    for (const l of filteredLogs) {
      if (!inMonth(l._ms)) continue;
      if (l._ms > bestMs) bestMs = l._ms;
    }
    setSelectedDayKey(bestMs ? dayKeyFromMs(bestMs) : null);
  }, [
    filteredLogs,
    visibleMonth,
    monthFilterKey,
    filterCategory,
    todayKey,
  ]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return "";
    const [yy, mm, dd] = selectedDayKey.split("-").map(Number);
    const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDayKey]);

  // ── Month navigation ──────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setVisibleMonth((d) => addMonths(d, -1));
  }, []);
  const goToNextMonth = useCallback(() => {
    setVisibleMonth((d) => addMonths(d, 1));
  }, []);
  const goToCurrentMonth = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  // ── Expand/collapse ───────────────────────────────────────────────────
  const toggleLogExpanded = useCallback((id: string) => {
    setExpandedLogId((current) => (current === id ? null : id));
  }, []);

  return {
    // Data
    loading,
    loadError,
    refreshing,
    onRefresh,
    reload,

    hasAnyLogs: normalizedLogs.length > 0,
    filteredLogs,
    logsForSelectedDay,

    // Calendar
    visibleMonth,
    monthLabel,
    goToPrevMonth,
    goToNextMonth,
    goToCurrentMonth,
    calendarCells,
    countsByDay,
    heatOpacity,
    todayKey,

    // Selection
    selectedDayKey,
    setSelectedDayKey,
    selectedDayLabel,

    // Filter
    filterCategory,
    setFilterCategory,
    chipsPresent,

    // Expand
    expandedLogId,
    toggleLogExpanded,
  };
}
