import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../ScreenLayout";
import { Dropdown } from "../Dropdown";
import { normalizeExerciseName } from "../../utils/workoutMetrics";
import {
  type TimeRangePreset,
  presetToStartMs,
  logCompletedMs,
  buildWeekly1RMSeries,
  buildWeeklyVolumeVsLoad,
  buildWeeklyWeightRepsSeries,
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
import { ChartLegend, KpiCard, MiniLineChart, TIME_PRESETS, WeightRepsChart } from "./ProgressCharts";

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
  /** When set (e.g. from student profile “View Progress”), applies filters; `forStudentId` bumps identity when the target student changes. */
  coachProgressDefaults?: { timePreset: TimeRangePreset; exerciseAll: true; forStudentId?: string } | null;
};

const ALL_EXERCISES = "__all__";

const studentLabel = (s: StudentSummary) =>
  [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || s.email || "Student";

function ChartInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: Colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: Colors.onPrimary, fontSize: 12, fontWeight: "700" }}>?</Text>
      </Pressable>
      {open ? (
        <View
          style={{
            marginTop: 8,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.hairlineStrong,
            borderRadius: Radius.sm,
            padding: Spacing.sm,
          }}
        >
          <Text style={{ ...Typography.secondary, color: Colors.textSecondary, fontSize: FontSizes.caption }}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </View>
  );
}

export function ProgressAnalyticsView({
  variant,
  logs,
  wpw,
  refreshing,
  onRefresh,
  coachContext,
  coachProgressDefaults = null,
}: ProgressAnalyticsViewProps) {
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(200, windowWidth - Spacing.md * 4);

  const [exerciseAll, setExerciseAll] = useState(true);
  const [exerciseName, setExerciseName] = useState("");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("3m");

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

  const weightReps = useMemo(
    () => buildWeeklyWeightRepsSeries(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs]
  );

  // Kept for the coaching-signals heuristic (volume-stable-but-intensity-rising check); not charted directly anymore.
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

  const studentOptions = useMemo(
    () => [...students].sort((a, b) => studentLabel(a).localeCompare(studentLabel(b), undefined, { sensitivity: "base" })).map((s) => ({ value: s.id, label: studentLabel(s) })),
    [students]
  );
  const exerciseOptions = useMemo(
    () => [{ value: ALL_EXERCISES, label: "All exercises" }, ...exerciseNames.map((n) => ({ value: n, label: n }))],
    [exerciseNames]
  );
  const rangeOptions = useMemo(() => TIME_PRESETS.map((p) => ({ value: p.key, label: p.label })), []);

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View
          style={{
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.xs,
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
            <Dropdown
              label="Student"
              value={studentId}
              options={studentOptions}
              onChange={(v) => setStudentId?.(v)}
              placeholder="Select student…"
            />
          ) : null}

          <Dropdown
            label="Exercise"
            value={exerciseAll ? ALL_EXERCISES : exerciseName}
            options={exerciseOptions}
            onChange={(v) => {
              if (v === ALL_EXERCISES) {
                setExerciseAll(true);
                setExerciseName("");
              } else {
                setExerciseAll(false);
                setExerciseName(v);
              }
            }}
          />

          <Dropdown
            label="Range"
            value={timePreset}
            options={rangeOptions}
            onChange={(v) => setTimePreset(v as TimeRangePreset)}
          />
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
                  <KpiCard
                    label="Compliance"
                    value={compliance != null ? `${compliance}%` : "—"}
                    delta={compDelta}
                    deltaPct={null}
                  />
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

              <Card>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.section }}>1RM progression</Text>
                  <ChartInfo text="Estimated 1RM = Weight × (1 + Reps/30). Shows strength independent of reps." />
                </View>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  Weekly best estimated 1RM{exerciseNorm ? "" : " (best lift each week)"}. PR points highlighted.
                </Text>
                {weekly1RM.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>No strength data in range.</Text>
                ) : (
                  <MiniLineChart points={weekly1RM} color={Colors.primary} height={160} highlightPr width={chartWidth} />
                )}
              </Card>

              <Card>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.section }}>Workout detail</Text>
                  <ChartInfo text="Blue = weight lifted | Orange = reps completed. Both drive 1RM improvement." />
                </View>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  Shows actual lifts each week. Both weight and reps drive 1RM improvement.
                </Text>
                {weightReps.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>No strength data in range.</Text>
                ) : (
                  <>
                    <WeightRepsChart data={weightReps} width={chartWidth} />
                    <ChartLegend
                      items={[
                        { color: Colors.chartBlue, label: "Weight lifted (kg)" },
                        { color: Colors.chartOrange, label: "Reps completed" },
                      ]}
                    />
                  </>
                )}
              </Card>

              {insights ? (
                <Card>
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
                </Card>
              ) : (
                <Card>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    Select a specific exercise to see detailed exercise insights.
                  </Text>
                </Card>
              )}

              {variant === "coach" && signals.length > 0 ? (
                <Card>
                  {signals.map((s, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.sm,
                        marginBottom: i === signals.length - 1 ? 0 : Spacing.sm,
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
                          {s.status === "green" ? "INSIGHT" : s.status === "red" ? "ATTENTION" : "WATCH"}
                        </Text>
                      </View>
                      <Text style={{ ...Typography.secondary, color: Colors.text, flex: 1 }}>{s.text}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Card>
                <View
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: Colors.primary,
                    marginBottom: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: FontSizes.tiny, fontWeight: "800", color: Colors.onPrimary }}>HOW TO READ</Text>
                </View>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: 6, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>1RM chart:</Text> one clean line = consistent
                  strength metric. Tap a point to see exact values and dates.
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: 6, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>Workout detail chart:</Text> blue = weight,
                  orange = reps. Weight up, reps down = normal periodized training.
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>Both improving?</Text> Rare and excellent —
                  {variant === "coach" ? " your student is" : " you're"} in a peak strength phase.
                </Text>
              </Card>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
