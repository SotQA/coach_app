import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";

export default function ProgressScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const sections = useMemo(() => {
    const byExercise = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      const key = (log.exercise ?? "").trim() || "Unknown exercise";
      const list = byExercise.get(key) ?? [];
      list.push(log);
      byExercise.set(key, list);
    }

    const exerciseNames = Array.from(byExercise.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return exerciseNames.map((name) => {
      const items = [...(byExercise.get(name) ?? [])].sort(
        (a, b) => toMs(a.date) - toMs(b.date)
      );

      const weights = items
        .map((x) => x.weight)
        .filter((w): w is number => typeof w === "number" && Number.isFinite(w));

      const progression = weights.length ? weights.map((w) => `${w}kg`).join(" → ") : "—";

      return {
        title: name,
        data: [
          {
            id: `progression:${name}`,
            progression,
            totalLogs: items.length,
            lastMs: items.length ? toMs(items[items.length - 1].date) : 0,
          },
        ],
      };
    });
  }, [logs]);

  useEffect(() => {
    const load = async () => {
      console.log("[student/progress] load start");
      setLoading(true);
      try {
        setError(null);
        const user = await authService.getCurrentUserWithRole();
        console.log("[student/progress] currentUser", user);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        const history = await workoutService.getWorkoutLogs(user.id);
        console.log("[student/progress] fetched logs", history.length);
        setLogs(history);
      } catch (e: any) {
        console.error("[student/progress] load error", e);
        setError(e.message ?? "Failed to load progress.");
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
        Progress
      </Text>
      {logs.length === 0 ? (
        <Text style={{ color: "#9CA3AF" }}>No workout data yet.</Text>
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
          renderItem={({ item }: any) => {
            const lastText = item.lastMs
              ? new Date(item.lastMs).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—";

            return (
              <View
                style={{
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 12,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                }}
              >
                <Text style={{ color: "#9CA3AF", marginBottom: 6 }}>Progression</Text>
                <Text style={{ fontWeight: "800", color: "#F9FAFB", fontSize: 16 }}>
                  {item.progression}
                </Text>
                <Text style={{ color: "#6B7280", marginTop: 8 }}>
                  Sessions: {item.totalLogs} • Last: {lastText}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

