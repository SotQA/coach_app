import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { normalizeLoggedExercise, workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutLogExercise } from "../../types/Workout";
import { computeExerciseVolumeFromLoggedSets } from "../../utils/workoutMetrics";
import { formatDurationForHistory } from "../../utils/workoutDuration";
import { PrimaryButton } from "../../components/PrimaryButton";
import { EmptyState } from "../../components/EmptyState";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

type LogWithMeta = WorkoutLog & {
  exercises: WorkoutLogExercise[];
  _ms: number;
  _category: WorkoutCategory;
};

type WorkoutCategory = "all" | "strength" | "hypertrophy" | "cardio" | "mobility" | "other";

type CalCell = { kind: "pad" } | { kind: "day"; date: Date; dayNum: number };

const CHIP_ORDER: { key: WorkoutCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "strength", label: "Strength" },
  { key: "hypertrophy", label: "Hypertrophy" },
  { key: "cardio", label: "Cardio" },
  { key: "mobility", label: "Mobility" },
  { key: "other", label: "Other" },
];

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  return 0;
}

function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayKeyFromDate(d: Date): string {
  return dayKeyFromMs(d.getTime());
}

function categorizeWorkoutName(name: string): Exclude<WorkoutCategory, "all"> {
  const n = name.toLowerCase();
  if (/cardio|conditioning|run|bike|rower|hiit/i.test(n)) return "cardio";
  if (/mobility|stretch|yoga|recovery|warm\s*up/i.test(n)) return "mobility";
  if (/strength|heavy|power|squat|deadlift|bench|press|5×5|5x5/i.test(n)) return "strength";
  if (/hyper|pump|volume|accessory|isolation/i.test(n)) return "hypertrophy";
  return "other";
}

function sessionVolumeKg(log: LogWithMeta): number {
  if (typeof log.totalVolume === "number" && Number.isFinite(log.totalVolume) && log.totalVolume > 0) {
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

function countPrs(log: LogWithMeta): number {
  return (log.exercises ?? []).filter((e) => e.isPr).length;
}

function formatVolumeCompact(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "—";
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${Math.round(kg)} kg`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Monday = 0 … Sunday = 6 */
function mondayIndexFromDate(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function WorkoutHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<WorkoutCategory>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const normalizedLogs = useMemo((): LogWithMeta[] => {
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
      const when = (log as { completedAt?: unknown; date?: unknown }).completedAt ?? (log as { date?: unknown }).date;
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

  const load = useCallback(async () => {
    if (!user || user.role !== "student") return;
    const history = await workoutService.getWorkoutHistory(user.id);
    setLogs(Array.isArray(history) ? history : []);
  }, [user]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        setError(null);
        if (!user || user.role !== "student") {
          if (active) setError("You must be logged in as a student.");
          return;
        }
        const history = await workoutService.getWorkoutHistory(user.id);
        if (!active) return;
        setLogs(Array.isArray(history) ? history : []);
      } catch (e: unknown) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : "Failed to load workout history.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id, user?.role]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const monthLabel = useMemo(
    () =>
      visibleMonth.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [visibleMonth]
  );

  const logsInVisibleMonth = useMemo(() => {
    const y = visibleMonth.getFullYear();
    const m = visibleMonth.getMonth();
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    return normalizedLogs.filter((l) => l._ms >= start && l._ms <= end && l._ms > 0);
  }, [normalizedLogs, visibleMonth]);

  const filteredLogs = useMemo(() => {
    if (filterCategory === "all") return logsInVisibleMonth;
    return logsInVisibleMonth.filter((l) => l._category === filterCategory);
  }, [logsInVisibleMonth, filterCategory]);

  const chipsPresent = useMemo(() => {
    const set = new Set<WorkoutCategory>(["all"]);
    for (const l of logsInVisibleMonth) {
      set.add(l._category === "other" ? "other" : l._category);
    }
    return CHIP_ORDER.filter((c) => set.has(c.key));
  }, [logsInVisibleMonth]);

  const countsByDay = useMemo(() => {
    const map: Record<string, { count: number; volume: number }> = {};
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

  const heatOpacity = (count: number): number => {
    if (count <= 0) return 0;
    if (maxSessionsInMonth <= 0) return 0.35;
    const t = count / maxSessionsInMonth;
    return 0.2 + t * 0.75;
  };

  const calendarCells = useMemo((): CalCell[] => {
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

  const logsForSelectedDay = useMemo(() => {
    if (!selectedDayKey) return [];
    return filteredLogs
      .filter((l) => dayKeyFromMs(l._ms) === selectedDayKey)
      .sort((a, b) => b._ms - a._ms);
  }, [filteredLogs, selectedDayKey]);

  const monthFilterKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${filterCategory}`;
  const prevMonthFilterKey = useRef<string>("");

  useEffect(() => {
    if (filteredLogs.length === 0) {
      setSelectedDayKey(null);
      prevMonthFilterKey.current = monthFilterKey;
      return;
    }

    const monthOrFilterChanged = prevMonthFilterKey.current !== monthFilterKey;
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
  }, [filteredLogs, visibleMonth, monthFilterKey, filterCategory, todayKey]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDayKey) return "";
    const [yy, mm, dd] = selectedDayKey.split("-").map(Number);
    const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1);
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [selectedDayKey]);

  const rowGap = 6;
  const calendarMaxW = windowW - (Spacing.md + Spacing.lg) * 2;
  const cellW = Math.max(32, Math.floor((calendarMaxW - rowGap * 6) / 7));
  /** Row height decoupled from width — compact rows, scaled up with the rest of the calendar. */
  const cellH = 38;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  if (normalizedLogs.length === 0) {
    return (
      <ScreenLayout>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: Spacing.md,
            paddingTop: insets.top + Spacing.md,
            backgroundColor: Colors.bg,
          }}
        >
          <Text style={{ ...Typography.title, fontSize: 26, marginBottom: Spacing.xs }}>History</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg }}>{monthLabel}</Text>
          <EmptyState
            icon="calendar-outline"
            title="No workouts yet"
            subtitle="Complete a workout from your plan to see it on the calendar."
          />
          <View style={{ marginTop: Spacing.lg }}>
            <PrimaryButton title="View Workouts" onPress={() => router.replace("/student/workouts")} />
          </View>
        </ScrollView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{
          paddingBottom: insets.bottom + Spacing.xl,
          backgroundColor: Colors.bg,
        }}
      >
        <View style={{ paddingHorizontal: Spacing.md, paddingTop: insets.top + Spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.title, fontSize: 26 }}>History</Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>{monthLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => router.push("/student/profile")}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Ionicons name="person-outline" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <Pressable
              onPress={() => setVisibleMonth((d) => addMonths(d, -1))}
              style={({ pressed }) => ({
                padding: Spacing.sm,
                borderRadius: Radius.md,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setVisibleMonth(startOfMonth(new Date()))}
              style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}
            >
              <Text style={{ ...Typography.section, color: Colors.primary, fontWeight: "700" }}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisibleMonth((d) => addMonths(d, 1))}
              style={({ pressed }) => ({
                padding: Spacing.sm,
                borderRadius: Radius.md,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="chevron-forward" size={22} color={Colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.lg,
              marginBottom: Spacing.md,
            }}
          >
            <View style={{ width: calendarMaxW, alignSelf: "center" }}>
            <View style={{ flexDirection: "row", marginBottom: 10, gap: rowGap }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((L, i) => (
                <View key={`${L}-${i}`} style={{ width: cellW, alignItems: "center" }}>
                  <Text style={{ ...Typography.secondary, fontSize: 12, fontWeight: "800", color: Colors.textMuted }}>{L}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: rowGap }}>
              {calendarCells.map((cell, idx) => {
                if (cell.kind === "pad") {
                  return <View key={`p-${idx}`} style={{ width: cellW, height: cellH }} />;
                }
                const key = dayKeyFromDate(cell.date);
                const agg = countsByDay[key];
                const count = agg?.count ?? 0;
                const isSelected = selectedDayKey === key;
                const isToday = key === todayKey;
                const op = heatOpacity(count);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedDayKey(key)}
                    style={{
                      width: cellW,
                      height: cellH,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: Radius.md,
                      borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                      borderColor: isSelected ? Colors.primary : isToday ? Colors.border : "transparent",
                      backgroundColor: count > 0 ? `rgba(212,255,68,${op})` : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: Colors.text,
                        lineHeight: 17,
                      }}
                    >
                      {cell.dayNum}
                    </Text>
                    {count > 0 ? (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 2.5,
                          marginTop: 2,
                          backgroundColor: Colors.success,
                        }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, flexWrap: "wrap", gap: Spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ ...Typography.secondary, fontSize: 12, color: Colors.textMuted, fontWeight: "600" }}>Less</Text>
                {[0.15, 0.35, 0.55, 0.85].map((a, i) => (
                  <View
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      backgroundColor: Colors.primary,
                      opacity: a,
                    }}
                  />
                ))}
                <Text style={{ ...Typography.secondary, fontSize: 12, color: Colors.textMuted, fontWeight: "600" }}>More</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.success }} />
                  <Text style={{ ...Typography.secondary, fontSize: 12, color: Colors.textMuted, fontWeight: "600" }}>Completed</Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, marginBottom: Spacing.md }}>
            {chipsPresent.map((c) => {
              const sel = filterCategory === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setFilterCategory(c.key)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: Radius.sm,
                    backgroundColor: sel ? Colors.primary : Colors.surface,
                    borderWidth: 1,
                    borderColor: sel ? Colors.primary : Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: sel ? "800" : "600",
                      color: sel ? Colors.onPrimary : Colors.text,
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <Text style={{ ...Typography.section, fontSize: 17, fontWeight: "800", flex: 1 }} numberOfLines={2}>
              {selectedDayLabel || "Select a day"}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "600" }}>
              {logsForSelectedDay.length} {logsForSelectedDay.length === 1 ? "session" : "sessions"}
            </Text>
          </View>

          {logsForSelectedDay.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                No sessions for this day with the current filter. Try another date or &quot;All&quot;.
              </Text>
            </View>
          ) : (
            logsForSelectedDay.map((log) => {
              const vol = sessionVolumeKg(log);
              const prs = countPrs(log);
              const dur = formatDurationForHistory(log.durationSeconds);
              const expanded = expandedLogId === log.id;
              return (
                <Pressable
                  key={log.id}
                  onPress={() => setExpandedLogId((id) => (id === log.id ? null : log.id))}
                  style={{
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: Colors.success, letterSpacing: 0.5 }}>
                          COMPLETED
                        </Text>
                      </View>
                      <Text style={{ ...Typography.section, fontSize: 18, fontWeight: "800" }} numberOfLines={2}>
                        {log.workoutName || "Workout"}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.sm }}>
                        {dur ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                            <Text style={{ ...Typography.secondary, color: Colors.text }}>{dur}</Text>
                          </View>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="barbell-outline" size={16} color={Colors.textMuted} />
                          <Text style={{ ...Typography.secondary, color: Colors.text }}>{formatVolumeCompact(vol)}</Text>
                        </View>
                        {prs > 0 ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Ionicons name="trophy-outline" size={16} color={Colors.primary} />
                            <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "700" }}>
                              {prs} PR{prs === 1 ? "" : "s"}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-forward"} size={22} color={Colors.textMuted} />
                  </View>

                  {expanded ? (
                    <View style={{ marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border }}>
                      {log.coachFeedback ? (
                        <View
                          style={{
                            marginBottom: Spacing.sm,
                            padding: Spacing.sm,
                            borderRadius: Radius.sm,
                            backgroundColor: Colors.surface,
                            borderWidth: 1,
                            borderColor: Colors.primary,
                          }}
                        >
                          <Text style={{ ...Typography.section, fontSize: 13, color: Colors.primary, marginBottom: 4 }}>Coach feedback</Text>
                          <Text style={{ ...Typography.secondary, color: Colors.text }}>{log.coachFeedback}</Text>
                        </View>
                      ) : null}
                      {log.exercises.map((ex, i) => {
                        const exRow = ex as WorkoutLogExercise;
                        const v =
                          typeof exRow.volume === "number" && Number.isFinite(exRow.volume)
                            ? exRow.volume
                            : computeExerciseVolumeFromLoggedSets(exRow.sets);
                        return (
                          <View key={`${log.id}-${ex.name}-${i}`} style={{ marginBottom: Spacing.sm }}>
                            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                              <Text style={{ ...Typography.section, fontSize: 15 }}>{ex.name}</Text>
                              {exRow.isPr ? (
                                <Text style={{ color: Colors.primary, fontWeight: "800", fontSize: 12 }}>PR</Text>
                              ) : null}
                            </View>
                            <Text style={{ ...Typography.secondary, fontSize: 13, marginTop: 4 }}>Planned: {ex.repsPlanned || "—"}</Text>
                            {(exRow.sets ?? []).map((s) => {
                              const wLabel = s.weight != null && Number.isFinite(s.weight) ? `${s.weight} kg` : "BW";
                              return (
                                <Text key={`${log.id}-${i}-${s.setNumber}`} style={{ ...Typography.secondary, fontSize: 13 }}>
                                  Set {s.setNumber}: {wLabel} × {s.reps}
                                </Text>
                              );
                            })}
                            {v > 0 ? (
                              <Text style={{ ...Typography.secondary, fontSize: 12, marginTop: 4, color: Colors.textMuted }}>
                                Volume: {Math.round(v)} kg
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}

          <View style={{ marginTop: Spacing.md }}>
            <PrimaryButton title="View Workouts" onPress={() => router.replace("/student/workouts")} style={{ backgroundColor: Colors.border }} />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
