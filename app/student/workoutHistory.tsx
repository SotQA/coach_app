import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { normalizeLoggedExercise, workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutLogExercise } from "../../types/Workout";
import { computeExerciseVolumeFromLoggedSets } from "../../utils/workoutMetrics";
import { formatLogWhen } from "../../utils/formatLogWhen";
import { formatDurationForHistory } from "../../utils/workoutDuration";
import { PrimaryButton } from "../../components/PrimaryButton";
import { EmptyState } from "../../components/EmptyState";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Displays the student's historical workout logs in a simple list.
export default function WorkoutHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toMs = (value: any): number => {
    // Supports: ISO string (preferred), Date object, or Firestore Timestamp-like objects.
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

  const normalizedLogs = useMemo(() => {
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
              } as any),
            ];

      const when = (log as any).completedAt ?? (log as any).date;
      return {
        ...log,
        exercises,
        _ms: toMs(when),
      };
    });
  }, [logs]);

  useEffect(() => {
    const load = async () => {
      console.log("[student/workoutHistory] load start");
      setLoading(true);
      try {
        setError(null);
        console.log("[student/workoutHistory] currentUser", user);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        const history = await workoutService.getWorkoutHistory(user.id);
        console.log("[student/workoutHistory] fetched logs", history.length);
        setLogs(history);
      } catch (e: any) {
        console.error("[student/workoutHistory] load error", e);
        setError(e.message ?? "Failed to load workout history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, user?.role]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <View style={{ flex: 1 }}>
        <Text
          style={{
            ...Typography.title,
            fontSize: 22,
            marginBottom: Spacing.sm,
          }}
        >
          Workout History
        </Text>
      {normalizedLogs.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No workouts yet"
          subtitle="Complete a workout from your plan to see it here."
        />
      ) : (
        normalizedLogs.map((log) => {
          const dateText = log._ms
            ? new Date(log._ms).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";
          const durationLabel = formatDurationForHistory(log.durationSeconds);
          return (
            <View
              key={log.id}
              style={{
                borderRadius: Radius.md,
                padding: Spacing.sm,
                marginBottom: Spacing.sm,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Ionicons name="barbell-outline" size={20} color={Colors.primary} />
                <Text style={{ ...Typography.section, flex: 1 }}>{log.workoutName || "Workout"}</Text>
              </View>
              <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>
                Completed: {dateText}
              </Text>
              {durationLabel ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.xs }}>
                  <Ionicons name="timer-outline" size={16} color={Colors.textMuted} />
                  <Text style={Typography.secondary}>Duration: {durationLabel}</Text>
                </View>
              ) : null}
              {typeof log.totalVolume === "number" && Number.isFinite(log.totalVolume) && log.totalVolume > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.xs }}>
                  <Ionicons name="analytics-outline" size={16} color={Colors.textMuted} />
                  <Text style={Typography.secondary}>Total volume: {log.totalVolume} kg</Text>
                </View>
              ) : null}

              {log.coachFeedback ? (
                <View
                  style={{
                    marginTop: Spacing.xs,
                    marginBottom: Spacing.sm,
                    padding: Spacing.sm,
                    borderRadius: Radius.sm,
                    backgroundColor: Colors.surface,
                    borderWidth: 1,
                    borderColor: Colors.primary,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.success} />
                    <Text style={{ ...Typography.section, fontSize: 14, color: Colors.success }}>
                      Coach feedback
                    </Text>
                  </View>
                  <Text style={{ ...Typography.secondary, color: Colors.text }}>{log.coachFeedback}</Text>
                  {log.feedbackCreatedAt ? (
                    <Text style={{ ...Typography.secondary, fontSize: 11, marginTop: 4 }}>
                      {formatLogWhen(log.feedbackCreatedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {log.exercises.map((ex, i) => {
                const exRow = ex as WorkoutLogExercise;
                const vol =
                  typeof exRow.volume === "number" && Number.isFinite(exRow.volume)
                    ? exRow.volume
                    : computeExerciseVolumeFromLoggedSets(exRow.sets);
                return (
                  <View key={`${log.id}-${ex.name}-${i}`} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <Text style={{ ...Typography.section, fontSize: 15 }}>{ex.name}</Text>
                      {exRow.isPr ? (
                        <Text style={{ color: Colors.success, fontWeight: "700" }}>🔥 PR</Text>
                      ) : null}
                    </View>
                    <Text style={{ ...Typography.secondary, marginBottom: 4 }}>
                      Planned: {ex.repsPlanned || "—"}
                    </Text>
                    {(exRow.sets ?? []).map((s) => {
                      const wLabel =
                        s.weight != null && Number.isFinite(s.weight) ? `${s.weight}kg` : "BW";
                      return (
                        <Text key={`${log.id}-${i}-${s.setNumber}`} style={Typography.secondary}>
                          Set {s.setNumber}: {wLabel} x {s.reps}
                        </Text>
                      );
                    })}
                    {vol > 0 ? (
                      <Text style={{ ...Typography.secondary, fontSize: 12, marginTop: 4 }}>
                        Volume: {vol} kg
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })
      )}
          <View style={{ marginTop: Spacing.lg }}>
            <PrimaryButton
              title="View Workouts"
              onPress={() => router.replace("/student/workouts")}
              style={{ backgroundColor: Colors.border }}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

