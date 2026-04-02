import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { studentService } from "../../../services/studentService";
import { workoutService } from "../../../services/workoutService";
import { trainingGroupService } from "../../../services/trainingGroupService";
import type { StudentSummary } from "../../../types/StudentSummary";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { normalizeExerciseName } from "../../../utils/workoutMetrics";
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
  type WeeklyPoint,
  type WeeklyVolLoad,
} from "../../../utils/coachProgressAnalytics";

const TIME_PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "4w", label: "4 weeks" },
  { key: "8w", label: "8 weeks" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "all", label: "All time" },
];

const { width: SCREEN_W } = Dimensions.get("window");

function MiniLineChart({
  points,
  color,
  height,
  highlightPr,
}: {
  points: WeeklyPoint[];
  color: string;
  height: number;
  highlightPr: boolean;
}) {
  const W = SCREEN_W - Spacing.md * 4;
  const H = height;
  const padX = 8;
  const padY = 10;

  const vals = points.map((p) => p.value);
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals) : 1;
  const span = maxV - minV || 1;

  const coords = points.map((p, i) => {
    const x = padX + (points.length <= 1 ? W / 2 - padX : (i / (points.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - (p.value - minV) / span) * (H - 2 * padY);
    return { x, y, p };
  });

  const d = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [points]);

  return (
    <View style={{ height: H + 28 }}>
      <Svg width={W} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <Line
            key={t}
            x1={0}
            x2={W}
            y1={padY + t * (H - 2 * padY)}
            y2={padY + t * (H - 2 * padY)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {coords.length > 1 ? (
          <Polyline points={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : coords.length === 1 ? (
          <Circle cx={coords[0].x} cy={coords[0].y} r={4} fill={color} />
        ) : null}
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={highlightPr && c.p.isPr ? 6 : 4}
            fill={highlightPr && c.p.isPr ? Colors.primary : color}
            stroke={Colors.bg}
            strokeWidth={2}
            onPress={() => setSelected(i)}
          />
        ))}
      </Svg>
      {selected != null && points[selected] ? (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          {points[selected].label}: {points[selected].value} kg e1RM
          {points[selected].isPr ? " · PR" : ""}
        </Text>
      ) : (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, textAlign: "center" }}>
          Tap a point for details
        </Text>
      )}
    </View>
  );
}

function DualLineChart({ data }: { data: WeeklyVolLoad[] }) {
  const W = SCREEN_W - Spacing.md * 4;
  const H = 140;
  const padX = 8;
  const padY = 10;
  if (data.length === 0) {
    return <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>Not enough data</Text>;
  }
  const vols = data.map((d) => d.volume);
  const loads = data.map((d) => d.avgLoad);
  const maxVol = Math.max(...vols, 1);
  const maxLoad = Math.max(...loads, 1);

  const vCoords = data.map((row, i) => {
    const x = padX + (data.length <= 1 ? W / 2 - padX : (i / (data.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - row.volume / maxVol) * (H - 2 * padY);
    return `${x},${y}`;
  });
  const lCoords = data.map((row, i) => {
    const x = padX + (data.length <= 1 ? W / 2 - padX : (i / (data.length - 1)) * (W - 2 * padX));
    const y = padY + (1 - row.avgLoad / maxLoad) * (H - 2 * padY);
    return `${x},${y}`;
  });

  return (
    <Svg width={W} height={H}>
      {[0, 0.5, 1].map((t) => (
        <Line
          key={t}
          x1={0}
          x2={W}
          y1={padY + t * (H - 2 * padY)}
          y2={padY + t * (H - 2 * padY)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      <Polyline points={vCoords.join(" ")} fill="none" stroke="#64D2FF" strokeWidth={2} strokeLinejoin="round" />
      <Polyline points={lCoords.join(" ")} fill="none" stroke={Colors.primary} strokeWidth={2} strokeDasharray="4 4" />
    </Svg>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaPct,
  unit,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaPct: number | null;
  unit?: string;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ ...Typography.title, fontSize: 22, marginTop: 6 }}>
        {value}
        {unit ? <Text style={{ ...Typography.secondary, fontSize: 14 }}> {unit}</Text> : null}
      </Text>
      {delta != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
          <Ionicons
            name={up ? "trending-up" : down ? "trending-down" : "remove"}
            size={16}
            color={up ? Colors.success : down ? Colors.danger : Colors.textMuted}
          />
          <Text
            style={{
              ...Typography.secondary,
              color: up ? Colors.success : down ? Colors.danger : Colors.textMuted,
              fontWeight: "700",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta}
            {deltaPct != null ? ` (${deltaPct > 0 ? "+" : ""}${deltaPct}%)` : ""}
          </Text>
        </View>
      ) : (
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 8 }}>—</Text>
      )}
    </View>
  );
}

export default function CoachProgressTab() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [wpw, setWpw] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exerciseAll, setExerciseAll] = useState(true);
  const [exerciseName, setExerciseName] = useState<string>("");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("8w");

  const nowMs = Date.now();

  const loadStudents = useCallback(async () => {
    if (!user || user.role !== "coach") return;
    const list = await studentService.getStudentsForCoach(user.id);
    setStudents(list);
    if (list.length && !studentId) {
      setStudentId(list[0].id);
    }
  }, [user, studentId]);

  const loadStudentData = useCallback(async () => {
    if (!user || user.role !== "coach" || !studentId) return;
    const [history, group] = await Promise.all([
      workoutService.getWorkoutHistory(studentId),
      trainingGroupService.getLatestTrainingGroupForStudent(user.id, studentId).catch(() => null),
    ]);
    setLogs(history);
    setWpw(group?.workoutsPerWeek && group.workoutsPerWeek > 0 ? group.workoutsPerWeek : 0);
  }, [user, studentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadStudents();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStudents]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        await loadStudentData();
      } catch (e) {
        console.error("[coach/progress]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, loadStudentData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStudents();
      await loadStudentData();
    } finally {
      setRefreshing(false);
    }
  }, [loadStudents, loadStudentData]);

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

  const insights = useMemo(
    () => (exerciseNorm ? buildExerciseInsights(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs) : null),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs]
  );

  const signals = useMemo(
    () => buildCoachingSignals(weekly1RM, volLoad, compliance, compDelta),
    [weekly1RM, volLoad, compliance, compDelta]
  );

  const studentLabel = (s: StudentSummary) =>
    [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || s.email || "Student";

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (!user || user.role !== "coach") {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, padding: Spacing.md, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger }}>Coach access only.</Text>
        </View>
      </ScreenLayout>
    );
  }

  const hasEnoughSessions = logs.length >= 2;

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        {/* Sticky-style filter bar */}
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
          <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>Progress analytics</Text>

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
                    onPress={() => setStudentId(s.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: Radius.md,
                      backgroundColor: sel ? Colors.surface : Colors.card,
                      borderWidth: 1,
                      borderColor: sel ? Colors.primary : Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.section, fontSize: 13, fontWeight: sel ? "800" : "600" }}>
                      {studentLabel(s)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6, marginTop: Spacing.xs }}>Exercise</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: Spacing.sm }}>
            <Pressable
              onPress={() => {
                setExerciseAll(true);
                setExerciseName("");
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: Radius.md,
                backgroundColor: exerciseAll ? Colors.surface : Colors.card,
                borderWidth: 1,
                borderColor: exerciseAll ? Colors.primary : Colors.border,
              }}
            >
              <Text style={{ fontWeight: exerciseAll ? "800" : "600", color: Colors.text, fontSize: 13 }}>All exercises</Text>
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
                    borderRadius: Radius.md,
                    backgroundColor: sel ? Colors.surface : Colors.card,
                    borderWidth: 1,
                    borderColor: sel ? Colors.primary : Colors.border,
                    maxWidth: 200,
                  }}
                >
                  <Text numberOfLines={1} style={{ fontWeight: sel ? "800" : "600", color: Colors.text, fontSize: 13 }}>
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
                    borderRadius: Radius.md,
                    backgroundColor: sel ? Colors.surface : Colors.card,
                    borderWidth: 1,
                    borderColor: sel ? Colors.primary : Colors.border,
                  }}
                >
                  <Text style={{ fontWeight: sel ? "800" : "600", color: Colors.text, fontSize: 13 }}>{p.label}</Text>
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
              <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                Student needs at least 2 logged sessions to show trends. Complete workouts from the student app to build history.
              </Text>
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
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: 12 }}>
                  Weekly best estimated 1RM{exerciseNorm ? "" : " (best lift each week)"}. PR points highlighted.
                </Text>
                {weekly1RM.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>No strength data in range.</Text>
                ) : (
                  <MiniLineChart points={weekly1RM} color={Colors.primary} height={160} highlightPr />
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
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: 12 }}>
                  Cyan = weekly volume · Lime dashed = avg load (kg)
                </Text>
                <DualLineChart data={volLoad} />
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
                        borderRadius: Radius.pill,
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
                          fontSize: 11,
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
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
