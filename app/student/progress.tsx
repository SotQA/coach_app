import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import type { WorkoutLog, WorkoutLogExercise } from "../../types/Workout";
import { getSessionMaxWeightFromLogExercise } from "../../utils/workoutMetrics";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import { BackButton } from "../../components/BackButton";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

type ExerciseKey = string;

type ExerciseProgress = {
  key: ExerciseKey;
  name: string;
  weights: number[]; // chronological, non-null
  datesMs: number[]; // parallel to weights
  prKg: number;
  latestKg: number;
};

const toMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  return 0;
};

const formatKg = (kg: number): string => {
  if (!Number.isFinite(kg)) return "—";
  if (Number.isInteger(kg)) return String(kg);
  // Keep a single decimal (enough for typical gym weights).
  return kg.toFixed(1).replace(/\.0$/, "");
};

const collapseConsecutiveDuplicates = (values: number[], dates: number[]) => {
  if (values.length === 0) return { weights: [], datesMs: [] };
  const outWeights: number[] = [];
  const outDates: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0 || values[i] !== values[i - 1]) {
      outWeights.push(values[i]);
      outDates.push(dates[i]);
    }
  }
  return { weights: outWeights, datesMs: outDates };
};

export default function ProgressScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedExerciseKey, setSelectedExerciseKey] = useState<ExerciseKey>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const history = await workoutService.getWorkoutHistory(user.id);
        setLogs(history);
      } catch (e: any) {
        console.error("[student/progress] load error", e);
        setError(e.message ?? "Failed to load progress.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, user?.role]);

  const processed = useMemo(() => {
    const logsAsc = [...logs].sort((a, b) => toMs((a as any).completedAt ?? (a as any).date) - toMs((b as any).completedAt ?? (b as any).date));

    const seriesByKey: Record<string, { name: string; weights: number[]; datesMs: number[] }> = {};

    for (const log of logsAsc) {
      const completedAtMs = toMs((log as any).completedAt ?? (log as any).date);
      if (!Number.isFinite(completedAtMs) || completedAtMs <= 0) continue;

      const exercises = Array.isArray(log.exercises) ? log.exercises : [];
      for (const ex of exercises) {
        const exName = ex?.name?.trim() ?? "";
        const key = exName.toLowerCase();
        if (!key) continue;

        const w = getSessionMaxWeightFromLogExercise(ex as WorkoutLogExercise);
        if (w == null) continue;

        if (!seriesByKey[key]) {
          seriesByKey[key] = { name: exName, weights: [], datesMs: [] };
        }

        seriesByKey[key].weights.push(w);
        seriesByKey[key].datesMs.push(completedAtMs);
      }
    }

    const exerciseProgressByKey: Record<ExerciseKey, ExerciseProgress> = {};
    const exerciseList: ExerciseProgress[] = [];

    for (const [key, v] of Object.entries(seriesByKey)) {
      const collapsed = collapseConsecutiveDuplicates(v.weights, v.datesMs);
      const weights = collapsed.weights;
      const datesMs = collapsed.datesMs;
      if (weights.length === 0) continue;

      const prKg = Math.max(...weights);
      const latestKg = weights[weights.length - 1];

      const entry: ExerciseProgress = {
        key,
        name: v.name,
        weights,
        datesMs,
        prKg,
        latestKg,
      };

      exerciseProgressByKey[key] = entry;
      exerciseList.push(entry);
    }

    const prTop = [...exerciseList]
      .sort((a, b) => b.prKg - a.prKg)
      .slice(0, 5);

    const logsDesc = [...logs].sort((a, b) => toMs((b as any).completedAt ?? (b as any).date) - toMs((a as any).completedAt ?? (a as any).date));

    const recentActivity = logsDesc.slice(0, 5).map((log) => {
      const completedAtMs = toMs((log as any).completedAt ?? (log as any).date);
      const dateLabel = completedAtMs
        ? new Date(completedAtMs).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—";

      const bestLiftKg = (() => {
        const weights: number[] = [];
        for (const ex of log.exercises ?? []) {
          const w = getSessionMaxWeightFromLogExercise(ex as WorkoutLogExercise);
          if (w != null) weights.push(w);
        }
        return weights.length ? Math.max(...weights) : null;
      })();

      return {
        workoutName: log.workoutName ?? "Workout",
        dateLabel,
        bestLiftKg,
      };
    });

    return {
      exerciseList,
      exerciseProgressByKey,
      prTop,
      recentActivity,
    };
  }, [logs]);

  useEffect(() => {
    if (!selectedExerciseKey && processed.prTop.length > 0) {
      setSelectedExerciseKey(processed.prTop[0].key);
    }
  }, [processed.prTop, selectedExerciseKey]);

  useEffect(() => {
    if (selectedExerciseKey && !processed.exerciseProgressByKey[selectedExerciseKey]) {
      setSelectedExerciseKey(processed.prTop[0]?.key ?? "");
    }
  }, [processed.exerciseProgressByKey, processed.prTop, selectedExerciseKey]);

  const selectedExercise = processed.exerciseProgressByKey[selectedExerciseKey] ?? null;

  const chartData = useMemo(() => {
    if (!selectedExercise) return null;
    if (selectedExercise.weights.length === 0) return null;

    const padding = 18;
    const chartHeight = 170;
    const chartWidth = Math.min(420, Math.max(240, windowWidth - Spacing.md * 2 - 20));

    const weights = selectedExercise.weights;
    const datesMs = selectedExercise.datesMs;

    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;

    const n = weights.length;
    const xStepDenom = n <= 1 ? 1 : n - 1;

    const points = weights.map((kg, i) => {
      const x =
        padding + (i / xStepDenom) * (chartWidth - padding * 2);
      const y =
        padding + ((max - kg) / range) * (chartHeight - padding * 2);
      return { x, y, kg, dateMs: datesMs[i] };
    });

    return {
      chartWidth,
      chartHeight,
      padding,
      points,
      min,
      max,
      latestKg: weights[weights.length - 1],
      latestDateMs: datesMs[datesMs.length - 1],
      prKg: selectedExercise.prKg,
    };
  }, [selectedExercise, windowWidth]);

  const progressionLabel = (weights: number[]) =>
    weights.map(formatKg).join(" → ");

  if (loading) {
    return (
      <ScreenLayout>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: Colors.bg,
          }}
        >
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
          <PrimaryButton title="Back" onPress={() => router.back()} />
        </View>
      </ScreenLayout>
    );
  }

  const hasAnyData = processed.exerciseList.length > 0;

  return (
    <ScreenLayout>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg }}>
        <View style={{ marginBottom: Spacing.md }}>
          <BackButton />
          <Text style={{ ...Typography.title, fontSize: 22, marginTop: Spacing.sm }}>
            Progress
          </Text>
          <Text style={{ ...Typography.secondary, marginTop: 4 }}>
            Track PRs, exercise trends, and your recent sessions.
          </Text>
        </View>

        {!hasAnyData ? (
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.md,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>
              No progress yet. Complete your first workout.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: Spacing.lg }}>
              <Ionicons name="barbell-outline" size={20} color={Colors.primary} />
              <Text style={Typography.secondary}>Your PRs will show up here after you log workouts.</Text>
            </View>

            <PrimaryButton title="View Workouts" onPress={() => router.replace("/student/workouts")} />
          </View>
        ) : (
          <>
            {/* Personal Records */}
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Personal Records</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  {processed.prTop.map((pr) => {
                    const isSelected = pr.key === selectedExerciseKey;
                    return (
                      <Pressable
                        key={pr.key}
                        onPress={() => setSelectedExerciseKey(pr.key)}
                        style={({ pressed }) => ({
                          width: 220,
                          borderRadius: Radius.md,
                          padding: Spacing.sm,
                          borderWidth: 1,
                          borderColor: isSelected ? Colors.primary : Colors.border,
                          backgroundColor: isSelected ? "rgba(37, 99, 235, 0.12)" : Colors.surface,
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <Text style={{ ...Typography.section, fontSize: 16, marginBottom: 6 }}>
                          {pr.name}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Ionicons name="flame" size={16} color={Colors.primary} />
                          <Text style={{ ...Typography.body, color: Colors.text }}>
                            {formatKg(pr.prKg)}kg
                          </Text>
                        </View>
                        <Text style={{ ...Typography.secondary, marginTop: 6 }}>PR</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Selected Exercise Chart */}
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>
                Weight Over Time
              </Text>
              <Text style={{ ...Typography.title, fontSize: 18, marginBottom: Spacing.sm }}>
                {selectedExercise?.name ?? "Exercise"}
              </Text>

              {chartData ? (
                <View style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: chartData.chartWidth,
                      height: chartData.chartHeight,
                      position: "relative",
                    }}
                  >
                    {/* Grid lines */}
                    {(() => {
                      const range = chartData.max - chartData.min || 1;
                      const values = [chartData.max, (chartData.max + chartData.min) / 2, chartData.min];
                      return values.map((value, i) => {
                        const y =
                          chartData.padding + ((chartData.max - value) / range) * (chartData.chartHeight - chartData.padding * 2);
                        return (
                          <View
                            key={`grid-${i}`}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              top: y,
                              height: 1,
                              backgroundColor: Colors.border,
                              opacity: 0.6,
                            }}
                          />
                        );
                      });
                    })()}

                    {/* Segments */}
                    {chartData.points.slice(0, -1).map((p1, idx) => {
                      const p2 = chartData.points[idx + 1];
                      const dx = p2.x - p1.x;
                      const dy = p2.y - p1.y;
                      const length = Math.sqrt(dx * dx + dy * dy);
                      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;

                      const lineThickness = 3;
                      return (
                        <View
                          key={`seg-${idx}`}
                          style={{
                            position: "absolute",
                            left: midX - length / 2,
                            top: midY - lineThickness / 2,
                            width: length,
                            height: lineThickness,
                            backgroundColor: Colors.primary,
                            transform: [{ rotate: `${angleDeg}deg` }],
                          }}
                        />
                      );
                    })}

                    {/* Points */}
                    {chartData.points.map((p, idx) => {
                      const r = 5;
                      return (
                        <View
                          key={`pt-${idx}`}
                          style={{
                            position: "absolute",
                            left: p.x - r,
                            top: p.y - r,
                            width: r * 2,
                            height: r * 2,
                            borderRadius: r,
                            backgroundColor: Colors.primary,
                          }}
                        />
                      );
                    })}
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: Spacing.sm }}>
                    <View>
                      <Text style={Typography.secondary}>Latest</Text>
                      <Text style={{ ...Typography.section }}>{formatKg(chartData.latestKg)}kg</Text>
                    </View>
                    <View>
                      <Text style={Typography.secondary}>PR</Text>
                      <Text style={{ ...Typography.section }}>{formatKg(chartData.prKg)}kg</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={Typography.secondary}>Not enough data to chart yet.</Text>
              )}
            </View>

            {/* Exercise Progress List */}
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: Spacing.md,
              }}
            >
              <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Exercise Progress</Text>
              <View style={{ gap: Spacing.sm }}>
                {[...processed.exerciseList]
                  .sort((a, b) => b.prKg - a.prKg)
                  .map((ex) => (
                    <Pressable
                      key={ex.key}
                      onPress={() =>
                        router.push({
                          pathname: "/student/exerciseDetails",
                          params: { name: ex.name },
                        })
                      }
                      style={({ pressed }) => ({
                        borderRadius: Radius.md,
                        padding: Spacing.sm,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        backgroundColor: Colors.surface,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...Typography.section, marginBottom: 6 }}>
                            {ex.name}
                          </Text>
                          <Text style={Typography.secondary}>
                            {progressionLabel(ex.weights)} kg
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </View>
                    </Pressable>
                  ))}
              </View>
            </View>

            {/* Recent Activity */}
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
                marginBottom: Spacing.lg,
              }}
            >
              <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Recent Activity</Text>
              <View style={{ gap: Spacing.sm }}>
                {processed.recentActivity.map((item, idx) => (
                  <View
                    key={`${item.workoutName}-${item.dateLabel}-${idx}`}
                    style={{
                      borderRadius: Radius.md,
                      padding: Spacing.sm,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      backgroundColor: Colors.surface,
                    }}
                  >
                    <Text style={{ ...Typography.section, marginBottom: 6 }}>{item.workoutName}</Text>
                    <Text style={Typography.secondary} numberOfLines={1}>
                      {item.dateLabel}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: Spacing.xs }}>
                      <Ionicons name="flame" size={16} color={item.bestLiftKg != null ? Colors.primary : Colors.textMuted} />
                      <Text style={{ ...Typography.secondary, color: item.bestLiftKg != null ? Colors.text : Colors.textMuted }}>
                        Best: {item.bestLiftKg != null ? `${formatKg(item.bestLiftKg)}kg` : "—"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

