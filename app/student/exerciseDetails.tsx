import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutLogExercise } from "../../types/Workout";
import { getSessionMaxWeightFromLogExercise } from "../../utils/workoutMetrics";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

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

export default function ExerciseDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ name?: string }>();
  const exerciseName = useMemo(() => (params.name ?? "").toString().trim(), [params]);

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      console.log("[student/exerciseDetails] load start", { exerciseName });
      setLoading(true);
      try {
        setError(null);
        console.log("[student/exerciseDetails] currentUser", user);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        if (!exerciseName) {
          setError("No exercise specified.");
          return;
        }
        const history = await workoutService.getWorkoutHistory(user.id);
        const filtered = history.filter((log) =>
          (log.exercises ?? []).some(
            (ex) => ex.name?.trim().toLowerCase() === exerciseName.toLowerCase()
          )
        );
        setLogs(filtered.sort((a, b) => toMs((a as any).completedAt ?? a.date) - toMs((b as any).completedAt ?? b.date)));
      } catch (e: any) {
        console.error("[student/exerciseDetails] load error", e);
        setError(e.message ?? "Failed to load exercise history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [exerciseName, user?.id, user?.role]);

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
        <Text style={{ color: "#FCA5A5", marginBottom: 8 }}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const progression = logs
    .map((log) => {
      const match = (log.exercises ?? []).find(
        (ex) => ex.name?.trim().toLowerCase() === exerciseName.toLowerCase()
      );
      return match ? getSessionMaxWeightFromLogExercise(match as WorkoutLogExercise) : null;
    })
    .filter((w): w is number => typeof w === "number" && Number.isFinite(w))
    .map((w) => String(w))
    .join(" → ");

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
        <Text
          style={{
            ...Typography.title,
            fontSize: 22,
            marginBottom: Spacing.xs,
          }}
        >
          {exerciseName || "Exercise"}
        </Text>
        {logs.length === 0 ? (
          <Text style={Typography.secondary}>No history for this exercise yet.</Text>
        ) : (
          <>
            <Text style={{ color: Colors.textSecondary, marginBottom: Spacing.md }}>
              Progression (weight): {progression || "—"}
            </Text>

            {logs.map((log) => {
              const ms = toMs((log as any).completedAt ?? log.date);
              const dateLabel = ms
                ? new Date(ms).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "";
              const timeLabel = ms
                ? new Date(ms).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

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
                  {(log.exercises ?? [])
                    .filter((ex) => ex.name?.trim().toLowerCase() === exerciseName.toLowerCase())
                    .map((ex, i) => (
                      <View key={`${log.id}-${i}`} style={{ marginBottom: i === 0 ? 0 : Spacing.xs }}>
                        <Text style={{ color: Colors.text, fontWeight: "600", marginBottom: 4 }}>
                          Planned: {ex.repsPlanned || "—"}
                        </Text>
                        {(ex.sets ?? []).map((s) => {
                          const w =
                            s.weight != null && Number.isFinite(s.weight) ? `${s.weight}kg` : "BW";
                          return (
                            <Text key={`${log.id}-${i}-${s.setNumber}`} style={{ color: Colors.text }}>
                              Set {s.setNumber}: {w} × {s.reps}
                            </Text>
                          );
                        })}
                      </View>
                    ))}
                  <Text style={{ color: Colors.textMuted, marginTop: 4 }}>
                    {dateLabel} {timeLabel && `• ${timeLabel}`}
                  </Text>
                </View>
              );
            })}
          </>
        )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

