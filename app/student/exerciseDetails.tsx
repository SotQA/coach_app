import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";

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
        const user = await authService.getCurrentUserWithRole();
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
        const filtered = history.filter(
          (log) => log.exercise?.trim().toLowerCase() === exerciseName.toLowerCase()
        );
        setLogs(
          filtered.sort((a, b) => toMs(a.date) - toMs(b.date))
        );
      } catch (e: any) {
        console.error("[student/exerciseDetails] load error", e);
        setError(e.message ?? "Failed to load exercise history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [exerciseName]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0F172A",
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
          backgroundColor: "#0F172A",
        }}
      >
        <Text style={{ color: "#FCA5A5", marginBottom: 8 }}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  const progression = logs
    .map((log) => log.weight)
    .filter((w): w is number => typeof w === "number" && Number.isFinite(w))
    .map((w) => String(w))
    .join(" → ");

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 8,
            color: "#F9FAFB",
          }}
        >
          {exerciseName || "Exercise"}
        </Text>
        {logs.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>No history for this exercise yet.</Text>
        ) : (
          <>
            <Text style={{ color: "#9CA3AF", marginBottom: 12 }}>
              Progression (weight): {progression || "—"}
            </Text>

            {logs.map((log) => {
              const ms = toMs(log.date);
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
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: "#020617",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                  }}
                >
                  <Text style={{ color: "#F9FAFB", fontWeight: "600" }}>
                    {log.sets} sets × {log.reps} reps
                    {log.weight ? ` @ ${log.weight}kg` : ""}
                  </Text>
                  <Text style={{ color: "#6B7280", marginTop: 4 }}>
                    {dateLabel} {timeLabel && `• ${timeLabel}`}
                  </Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

