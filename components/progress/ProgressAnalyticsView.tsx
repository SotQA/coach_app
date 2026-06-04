import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../ScreenLayout";
import type { Edge } from "react-native-safe-area-context";
import { normalizeExerciseName } from "../../utils/workoutMetrics";
import {
  type TimeRangePreset,
  presetToStartMs,
  logCompletedMs,
  buildWeekly1RMSeries,
  buildWeeklyVolumeVsLoad,
  collectExerciseNames,
  totalVolumeFromLogs,
  peakE1RMFromLogs,
  averageRpeFromLogs,
  compliancePercentFromLogs,
  splitLogsByPeriod,
  comparePeriods,
  buildExerciseInsights,
  buildCoachingSignals,
  sessionsInRollingWindow,
  complianceDelta,
} from "../../utils/coachProgressAnalytics";
import { DualLineChart, KpiCard, MiniLineChart, TIME_PRESETS } from "./ProgressCharts";

export type ProgressAnalyticsCoachContext = {
  students: StudentSummary[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
};

export type ProgressAnalyticsViewProps = {
  variant: "coach" | "student";
  logs: WorkoutLog[];
  wpw: number;
  refreshing: boolean;
  onRefresh: () => void;
  coachContext?: ProgressAnalyticsCoachContext;
  /** When set (e.g. from student profile "View Progress"), applies filters; `forStudentId` bumps identity when the target student changes. */
  coachProgressDefaults?: { timePreset: TimeRangePreset; exerciseAll: true; forStudentId?: string } | null;
  /** Override SafeAreaView edges passed to ScreenLayout. Use ["left","right"] inside stack screens with a visible header. */
  screenLayoutEdges?: Edge[];
};

const studentLabel = (s: StudentSummary) =>
  [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || s.email || "Student";

export function ProgressAnalyticsView({
  variant,
  logs,
  wpw,
  refreshing,
  onRefresh,
  coachContext,
  coachProgressDefaults = null,
  screenLayoutEdges,
}: ProgressAnalyticsViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(200, windowWidth - Spacing.md * 4);

  const [exerciseAll, setExerciseAll] = useState(true);
  const [exerciseName, setExerciseName] = useState("");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("8w");

  useEffect(() => {
    if (!coachProgressDefaults) return;
    setTimePreset(coachProgressDefaults.timePreset);
    if (coachProgressDefaults.exerciseAll) {
      setExerciseAll(true);
      setExerciseName("");
    }
  }, [coachProgressDefaults]);

  const nowMs = Date.now();
  const exerciseNorm = exerciseAll ? null : normalizeExerciseName(exerciseName);

  const rangeStartMs = useMemo(() => {
    const raw = presetToStartMs(timePreset, nowMs);
    if (raw != null) return raw;
    if (logs.length === 0) return nowMs - 365 * 24 * 60 * 60 * 1000;
    let min = nowMs;
    for (const l of logs) {
      const m = logCompletedMs(l);
      if (m > 0 && m < min) min = m;
    }
    return min;
  }, [timePreset, logs, nowMs]);

  const logsInRange = useMemo(() => {
    return logs.filter((l) => {
      const ms = logCompletedMs(l);
      if (ms <= 0 || ms > nowMs) return false;
      if (timePreset === "all") return true;
      return ms >= (rangeStartMs ?? 0);
    });
  }, [logs, timePreset, rangeStartMs, nowMs]);

  const exerciseNames = useMemo(() => collectExerciseNames(logs), [logs]);

  const weekly1RM = useMemo(
    () => buildWeekly1RMSeries(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs]
  );

  const volLoad = useMemo(
    () => buildWeeklyVolumeVsLoad(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs]
  );

  const { current: curLogs, previous: prevLogs } = useMemo(() => {
    if (timePreset === "all") {
      const len = 84 * 24 * 60 * 60 * 1000;
      const split = splitLogsByPeriod(logs, nowMs - len, nowMs);
      const prev = logs.filter((l) => {
        const ms = logCompletedMs(l);
        return ms >= nowMs - 2 * len && ms < nowMs - len;
      });
      return { current: split.current, previous: prev };
    }
    const start = rangeStartMs ?? nowMs - 56 * 24 * 60 * 60 * 1000;
    return splitLogsByPeriod(logs, start, nowMs);
  }, [logs, timePreset, rangeStartMs, nowMs]);

  const kpiE1rm = useMemo(
    () => comparePeriods(curLogs, prevLogs, exerciseNorm, "e1rm"),
    [curLogs, prevLogs, exerciseNorm]
  );
  const kpiVol = useMemo(
    () => comparePeriods(curLogs, prevLogs, exerciseNorm, "volume"),
    [curLogs, prevLogs, exerciseNorm]
  );
  const kpiRpe = useMemo(
    () => comparePeriods(curLogs, prevLogs, exerciseNorm, "rpe"),
    [curLogs, prevLogs, exerciseNorm]
  );

  const compliance = compliancePercentFromLogs(logs, wpw, nowMs);
  const prevWeekCount = sessionsInRollingWindow(
    logs,
    nowMs - 14 * 24 * 60 * 60 * 1000,
    nowMs - 7 * 24 * 60 * 60 * 1000
  );
  const thisWeekCount = sessionsInRollingWindow(logs, nowMs - 7 * 24 * 60 * 60 * 1000, nowMs);
  const compDelta = wpw > 0 ? complianceDelta(prevWeekCount, thisWeekCount, wpw) : null;

  const sessionCountDelta = curLogs.length - prevLogs.length;

  const insights = useMemo(
    () =>
      exerciseNorm ? buildExerciseInsights(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs) : null,
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs]
  );

  const signals = useMemo(
    () =>
      variant === "coach" ? buildCoachingSignals(weekly1RM, volLoad, compliance, compDelta) : [],
    [variant, weekly1RM, volLoad, compliance, compDelta]
  );

  const screenTitle = variant === "coach" ? "Progress analytics" : "Progress";
  const hasEnoughSessions = logs.length >= 2;

  const emptyBody =
    variant === "coach"
      ? "Student needs at least 2 logged sessions to show trends. Complete workouts from the student app to build history."
      : "You need at least 2 logged workouts to see trends. Finish a couple of sessions to unlock charts and insights.";

  const showStudentPicker = variant === "coach" && coachContext != null;
  const students = coachContext?.students ?? [];
  const studentId = coachContext?.selectedStudentId ?? "";
  const setStudentId = coachContext?.onSelectStudent;

  return (
    <ScreenLayout edges={screenLayoutEdges}>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View
          style={{
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            backgroundColor: Colors.bg,
          }}
        >
          <Text style={{ ...Typography.title, fontSize: FontSizes.h3, marginBottom: Spacing.sm }}>{screenTitle}</Text>
          {variant === "student" ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm }}>
              Your volume, strength trends, and exercise insights.
            </Text>
          ) : null}

          {showStudentPicker ? (
            <>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>Student</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: Spacing.sm }}>
                {students.length === 0 ? (
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>No students</Text>
                ) : (
                  students.map((s) => {
                    const sel = s.id === studentId;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setStudentId?.(s.id)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: Radius.sm,
                          backgroundColor: sel ? Colors.surface : Colors.card,
                          borderWidth: 1,
                          borderColor: sel ? Colors.primary : Colors.border,
                        }}
                      >
                        <Text style={{ ...Typography.section, fontSize: FontSizes.note, fontWeight: sel ? "800" : "600" }}>
                          {studentLabel(s)}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          ) : null}

          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6, marginTop: showStudentPicker ? Spacing.xs : 0 }}>
            Exercise
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: Spacing.sm }}>
            <Pressable
              onPress={() => {
                setExerciseAll(true);
                setExerciseName("");
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: Radius.sm,
                backgroundColor: exerciseAll ? Colors.surface : Colors.card,
                borderWidth: 1,
                borderColor: exerciseAll ? Colors.primary : Colors.border,
              }}
            >
              <Text style={{ fontWeight: exerciseAll ? "800" : "600", color: Colors.text, fontSize: FontSizes.note }}>All exercises</Text>
            </Pressable>
            {exerciseNames.map((name) => {
              const sel = !exerciseAll && exerciseName === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => {
                    setExerciseAll(false);
                    setExerciseName(name);
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: Radius.sm,
                    backgroundColor: sel ? Colors.surface : Colors.card,
                    borderWidth: 1,
                    borderColor: sel ? Colors.primary : Colors.border,
                    maxWidth: 200,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontWeight: sel ? "800" : "600", color: Colors.text, fontSize: FontSizes.note }}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6, marginTop: Spacing.xs }}>Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TIME_PRESETS.map((p) => {
              const sel = timePreset === p.key;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setTimePreset(p.key)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: Radius.sm,
                    backgroundColor: sel ? Colors.surface : Colors.card,
                    borderWidth: 1,
                    borderColor: sel ? Colors.primary : Colors.border,
                  }}
                >
                  <Text style={{ fontWeight: sel ? "800" : "600", color: Colors.text, fontSize: FontSizes.note }}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.md,
            paddingBottom: Spacing.xl,
            paddingTop: Spacing.md,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {!hasEnoughSessions ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.title, marginBottom: Spacing.sm }}>No progress data yet</Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{emptyBody}</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label="Est. 1RM"
                    value={String(peakE1RMFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs) || "—")}
                    delta={kpiE1rm.delta}
                    deltaPct={kpiE1rm.deltaPct}
                    unit="kg"
                  />
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label="Total volume"
                    value={String(Math.round(totalVolumeFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs)))}
                    delta={kpiVol.delta}
                    deltaPct={kpiVol.deltaPct}
                  />
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  {variant === "coach" ? (
                    <KpiCard
                      label="Compliance"
                      value={compliance != null ? `${compliance}%` : "—"}
                      delta={compDelta}
                      deltaPct={null}
                    />
                  ) : (
                    <KpiCard
                      label="Sessions"
                      value={String(curLogs.length)}
                      delta={sessionCountDelta}
                      deltaPct={null}
                    />
                  )}
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label="Avg RPE"
                    value={
                      averageRpeFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs) != null
                        ? String(averageRpeFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs))
                        : "—"
                    }
                    delta={kpiRpe.delta}
                    deltaPct={kpiRpe.deltaPct}
                  />
                </View>
              </View>

              <View
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: Spacing.md,
                }}
              >
                <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>1RM progression</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  Weekly best estimated 1RM{exerciseNorm ? "" : " (best lift each week)"}. PR points highlighted.
                </Text>
                {weekly1RM.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>No strength data in range.</Text>
                ) : (
                  <MiniLineChart points={weekly1RM} color={Colors.primary} height={160} highlightPr width={chartWidth} />
                )}
              </View>

              <View
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: Spacing.md,
                }}
              >
                <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Volume vs intensity</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  Cyan = weekly volume · Lime dashed = avg load (kg)
                </Text>
                <DualLineChart data={volLoad} width={chartWidth} />
              </View>

              {insights ? (
                <View
                  style={{
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    marginBottom: Spacing.md,
                  }}
                >
                  <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Exercise insights</Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    Best set: {insights.bestSetEver}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    Last PR: {insights.lastPrDate ?? "—"}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    Top volume week: {insights.topVolumeWeek}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    Avg reps (sets): {insights.avgReps != null ? String(insights.avgReps) : "—"}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    Avg weekly frequency: {insights.avgWeeklyFrequency != null ? String(insights.avgWeeklyFrequency) : "—"}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    marginBottom: Spacing.md,
                  }}
                >
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    Select a specific exercise to see detailed exercise insights.
                  </Text>
                </View>
              )}

              {variant === "coach" ? (
                <View
                  style={{
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Coaching signals</Text>
                  {signals.map((s, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: Radius.sm,
                          backgroundColor:
                            s.status === "green"
                              ? "rgba(52,199,89,0.18)"
                              : s.status === "red"
                                ? "rgba(255,69,58,0.18)"
                                : "rgba(255,214,10,0.15)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: FontSizes.tiny,
                            fontWeight: "800",
                            color:
                              s.status === "green" ? Colors.success : s.status === "red" ? Colors.danger : "#FFD60A",
                          }}
                        >
                          {s.status === "green" ? "ON TRACK" : s.status === "red" ? "ATTENTION" : "WATCH"}
                        </Text>
                      </View>
                      <Text style={{ ...Typography.secondary, color: Colors.text, flex: 1 }}>{s.text}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}


