import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { BackButton } from "../../components/BackButton";
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

  const sections = useMemo(() => {
    // Group by exercise name, then show progression over time.
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

      // Keep duplicates (80 → 80 → 85) as that’s still meaningful progression.
      const progression = weights.length ? weights.map((w) => String(w)).join(" → ") : "—";

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
      <View style={{ flex: 1, padding: Spacing.md, backgroundColor: Colors.bg }}>
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
      {logs.length === 0 ? (
        <Text style={Typography.secondary}>No workouts yet.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <View
              style={{
                paddingVertical: Spacing.xs,
                paddingHorizontal: Spacing.sm,
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                marginBottom: Spacing.xs,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.section, color: Colors.text }}>{section.title}</Text>
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
                  borderRadius: Radius.md,
                  padding: Spacing.sm,
                  marginBottom: Spacing.sm,
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Progression</Text>
                <Text style={{ ...Typography.section, fontSize: 16, fontWeight: "800" }}>
                  {item.progression}
                </Text>
                <Text style={{ color: Colors.textMuted, marginTop: Spacing.xs }}>
                  Sessions: {item.totalLogs} • Last: {lastText}
                </Text>
              </View>
            );
          }}
        />
      )}
      </View>
    </ScreenLayout>
  );
}

