import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";

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

  const sections = useMemo(() => {
    const sorted = [...logs].sort((a, b) => toMs(b.date) - toMs(a.date));
    const groups = new Map<string, WorkoutLog[]>();

    for (const log of sorted) {
      const ms = toMs(log.date);
      const dayKey = ms
        ? new Date(ms).toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Unknown date";

      const list = groups.get(dayKey) ?? [];
      list.push(log);
      groups.set(dayKey, list);
    }

    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [logs]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await authService.getCurrentUserWithRole();
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        const history = await workoutService.getWorkoutHistory(user.id);
        setLogs(history);
      } catch (e: any) {
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
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#0F172A" }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 12,
          color: "#F9FAFB",
        }}
      >
        Workout History
      </Text>
      {logs.length === 0 ? (
        <Text style={{ color: "#9CA3AF" }}>No logs yet.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: "#111827",
                borderRadius: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "#E5E7EB", fontWeight: "700" }}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const ms = toMs(item.date);
            const time = ms
              ? new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <View
                style={{
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 8,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "700", color: "#F9FAFB" }}>{item.exercise}</Text>
                  {time ? <Text style={{ color: "#6B7280" }}>{time}</Text> : null}
                </View>
                <Text style={{ color: "#9CA3AF", marginTop: 4 }}>
                  {item.sets} sets × {item.reps} reps
                  {item.weight !== undefined && item.weight !== null && item.weight !== 0
                    ? ` @ ${item.weight}kg`
                    : ""}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

