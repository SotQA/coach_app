import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { BackButton } from "../../components/BackButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Displays the student's historical workout logs in a simple list.
export default function WorkoutHistory() {
  const router = useRouter();
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
      const exercises = Array.isArray(log.exercises) && log.exercises.length
        ? log.exercises
        : [
            {
              name: log.exercise ?? "Exercise",
              sets: log.sets ?? 0,
              repsPlanned: String(log.reps ?? ""),
              repsDone: String(log.reps ?? ""),
              weight: log.weight ?? null,
              rest: "",
              tempo: "",
              rpe: null,
            },
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
        const user = await authService.getCurrentUserWithRole();
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
  }, []);

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
          <BackButton />
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
        <Text style={Typography.secondary}>No workouts yet.</Text>
      ) : (
        normalizedLogs.map((log) => {
          const dateText = log._ms
            ? new Date(log._ms).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";
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
              <Text style={{ ...Typography.section, marginBottom: 4 }}>
                {log.workoutName || "Workout"}
              </Text>
              <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>
                Completed: {dateText}
              </Text>

              {log.exercises.map((ex, i) => (
                <View key={`${log.id}-${ex.name}-${i}`} style={{ marginTop: 6 }}>
                  <Text style={{ ...Typography.section, fontSize: 15 }}>{ex.name}</Text>
                  <Text style={Typography.secondary}>
                    {ex.repsPlanned || "—"} → {ex.repsDone} reps
                  </Text>
                  {ex.weight !== null && ex.weight !== undefined ? (
                    <Text style={Typography.secondary}>{ex.weight}kg</Text>
                  ) : null}
                </View>
              ))}
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

