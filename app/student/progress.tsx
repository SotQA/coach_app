import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { ProgressAnalyticsView } from "../../components/progress/ProgressAnalyticsView";

export default function StudentProgressScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== "student") return;
    setError(null);
    const history = await workoutService.getWorkoutHistory(user.id);
    setLogs(Array.isArray(history) ? history : []);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!user || user.role !== "student") {
          if (!cancelled) setError("You must be logged in as a student.");
          return;
        }
        await load();
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load progress.";
          setError(msg);
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to refresh.";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !user || user.role !== "student") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger }}>{error ?? "Student access only."}</Text>
      </View>
    );
  }

  return (
    <ProgressAnalyticsView variant="student" logs={logs} wpw={0} refreshing={refreshing} onRefresh={onRefresh} />
  );
}
