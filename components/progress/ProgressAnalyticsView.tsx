import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { NotificationBellButton } from "../NotificationBellButton";
import { ScreenLayout } from "../ScreenLayout";
import { Dropdown } from "../Dropdown";
import { useI18n } from "../../context/I18nContext";
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
  /**
   * When set, renders a back button next to the title. Pass this when the
   * screen hosting this view has its native header disabled (e.g. pushed on
   * a stack rather than shown inside a tab) — otherwise there'd be no way
   * back, since this view doesn't rely on a native header for navigation.
   */
  onBack?: () => void;
};

const ALL_EXERCISES = "__all__";

const studentLabel = (s: StudentSummary) =>
  [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || s.email || "Student";

function ChartInfoButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
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
      {open ? (
        <Ionicons name="close" size={13} color={Colors.onPrimary} />
      ) : (
        <Text style={{ color: Colors.onPrimary, fontSize: 12, fontWeight: "700" }}>?</Text>
      )}
    </Pressable>
  );
}

// Renders full-width, in normal flow (not an anchored popover) so it can never clip off
// the edge of the screen and always pushes the content below it down instead of overlapping.
function ChartInfoPanel({ text }: { text: string }) {
  return (
    <View
      style={{
        marginBottom: Spacing.sm,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.hairlineStrong,
        borderRadius: Radius.sm,
        padding: Spacing.sm,
      }}
    >
      <Text style={{ ...Typography.secondary, color: Colors.textSecondary, fontSize: FontSizes.caption }}>{text}</Text>
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
  onBack,
}: ProgressAnalyticsViewProps) {
  const { t, locale } = useI18n();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(200, windowWidth - Spacing.md * 4);

  const [exerciseAll, setExerciseAll] = useState(true);
  const [exerciseName, setExerciseName] = useState("");
  const [timePreset, setTimePreset] = useState<TimeRangePreset>("3m");
  const [e1rmInfoOpen, setE1rmInfoOpen] = useState(false);
  const [detailInfoOpen, setDetailInfoOpen] = useState(false);

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
    () => buildWeekly1RMSeries(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs, locale),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs, locale]
  );

  const weightReps = useMemo(
    () => buildWeeklyWeightRepsSeries(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs, locale),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs, locale]
  );

  // Kept for the coaching-signals heuristic (volume-stable-but-intensity-rising check); not charted directly anymore.
  const volLoad = useMemo(
    () => buildWeeklyVolumeVsLoad(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs, locale),
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs, locale]
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
      exerciseNorm ? buildExerciseInsights(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs, locale) : null,
    [logsInRange, exerciseNorm, timePreset, rangeStartMs, nowMs, locale]
  );

  const signals = useMemo(
    () =>
      variant === "coach" ? buildCoachingSignals(weekly1RM, volLoad, compliance, compDelta) : [],
    [variant, weekly1RM, volLoad, compliance, compDelta]
  );

  const screenTitle = variant === "coach" ? t("progressAnalytics") : t("progress");
  const hasEnoughSessions = logs.length >= 2;

  const emptyBody =
    variant === "coach" ? t("noProgressDataBodyCoach") : t("noProgressDataBodyStudent");

  const showStudentPicker = variant === "coach" && coachContext != null;
  const students = coachContext?.students ?? [];
  const studentId = coachContext?.selectedStudentId ?? "";
  const setStudentId = coachContext?.onSelectStudent;

  const studentOptions = useMemo(
    () => [...students].sort((a, b) => studentLabel(a).localeCompare(studentLabel(b), undefined, { sensitivity: "base" })).map((s) => ({ value: s.id, label: studentLabel(s) })),
    [students]
  );
  const exerciseOptions = useMemo(
    () => [{ value: ALL_EXERCISES, label: t("allExercisesOption") }, ...exerciseNames.map((n) => ({ value: n, label: n }))],
    [exerciseNames, t]
  );
  const rangeOptions = useMemo(() => TIME_PRESETS.map((p) => ({ value: p.key, label: t(p.labelKey) })), [t]);

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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 32,
                    height: 32,
                    borderRadius: Radius.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: Colors.card,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.text} />
                </Pressable>
              ) : null}
              <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{screenTitle}</Text>
            </View>
            {variant === "coach" ? <NotificationBellButton /> : null}
          </View>
          {variant === "student" ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm }}>
              {t("progressStudentSubtitle")}
            </Text>
          ) : null}

          {showStudentPicker ? (
            <Dropdown
              label={t("studentFieldLabel")}
              value={studentId}
              options={studentOptions}
              onChange={(v) => setStudentId?.(v)}
              placeholder={t("selectStudentPlaceholder")}
            />
          ) : null}

          <Dropdown
            label={t("exerciseDropdownLabel")}
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
            label={t("rangeLabel")}
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
              <Text style={{ ...Typography.title, marginBottom: Spacing.sm }}>{t("noProgressDataTitle")}</Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{emptyBody}</Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label={t("kpiEst1Rm")}
                    value={String(peakE1RMFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs) || "—")}
                    delta={kpiE1rm.delta}
                    deltaPct={kpiE1rm.deltaPct}
                    unit="kg"
                  />
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label={t("kpiTotalVolume")}
                    value={String(Math.round(totalVolumeFromLogs(logsInRange, exerciseNorm, timePreset === "all" ? null : rangeStartMs, nowMs)))}
                    delta={kpiVol.delta}
                    deltaPct={kpiVol.deltaPct}
                  />
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label={t("kpiCompliance")}
                    value={compliance != null ? `${compliance}%` : "—"}
                    delta={compDelta}
                    deltaPct={null}
                  />
                </View>
                <View style={{ width: "48%", flexGrow: 1 }}>
                  <KpiCard
                    label={t("kpiAvgRpe")}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.section }}>{t("chartTitle1Rm")}</Text>
                  <ChartInfoButton open={e1rmInfoOpen} onToggle={() => setE1rmInfoOpen((v) => !v)} />
                </View>
                {e1rmInfoOpen ? (
                  <ChartInfoPanel text={t("infoText1Rm")} />
                ) : null}
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  {exerciseNorm ? t("weekly1RmSubtitleExercise") : t("weekly1RmSubtitleAll")}
                </Text>
                {weekly1RM.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>{t("noStrengthDataInRange")}</Text>
                ) : (
                  <MiniLineChart points={weekly1RM} color={Colors.primary} height={190} highlightPr width={chartWidth} />
                )}
              </Card>

              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.sm }}>
                  <Text style={{ ...Typography.section }}>{t("chartTitleWorkoutDetail")}</Text>
                  <ChartInfoButton open={detailInfoOpen} onToggle={() => setDetailInfoOpen((v) => !v)} />
                </View>
                {detailInfoOpen ? (
                  <ChartInfoPanel text={t("infoTextWorkoutDetail")} />
                ) : null}
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm, fontSize: FontSizes.caption }}>
                  {t("workoutDetailSubtitle")}
                </Text>
                {weightReps.length === 0 ? (
                  <Text style={{ color: Colors.textMuted }}>{t("noStrengthDataInRange")}</Text>
                ) : (
                  <>
                    <WeightRepsChart data={weightReps} width={chartWidth} />
                    <ChartLegend
                      items={[
                        { color: Colors.chartBlue, label: t("legendWeightLifted") },
                        { color: Colors.chartOrange, label: t("legendRepsCompleted") },
                      ]}
                    />
                  </>
                )}
              </Card>

              {insights ? (
                <Card>
                  <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>{t("chartTitleExerciseInsights")}</Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    {t("insightBestSet", { value: insights.bestSetEver })}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    {t("insightLastPr", { value: insights.lastPrDate ?? "—" })}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    {t("insightTopVolumeWeek", { value: insights.topVolumeWeek })}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
                    {t("insightAvgReps", { value: insights.avgReps != null ? String(insights.avgReps) : "—" })}
                  </Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    {t("insightAvgWeeklyFrequency", {
                      value: insights.avgWeeklyFrequency != null ? String(insights.avgWeeklyFrequency) : "—",
                    })}
                  </Text>
                </Card>
              ) : (
                <Card>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    {t("selectExerciseForInsights")}
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
                          {s.status === "green" ? t("signalInsight") : s.status === "red" ? t("signalAttention") : t("signalWatch")}
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
                  <Text style={{ fontSize: FontSizes.tiny, fontWeight: "800", color: Colors.onPrimary }}>{t("howToReadBadge")}</Text>
                </View>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: 6, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>{t("howToRead1RmLead")}</Text> {t("howToRead1RmBody")}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: 6, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>{t("howToReadDetailLead")}</Text> {t("howToReadDetailBody")}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textSecondary, fontSize: FontSizes.note }}>
                  <Text style={{ fontWeight: "700", color: Colors.text }}>{t("howToReadBothLead")}</Text>{" "}
                  {t("howToReadBothBody", {
                    who: variant === "coach" ? t("howToReadWhoCoach") : t("howToReadWhoStudent"),
                  })}
                </Text>
              </Card>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
