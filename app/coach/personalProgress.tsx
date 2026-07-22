import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import { trainingGroupService } from "../../services/trainingGroupService";
import type { WorkoutLog } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { ProgressAnalyticsView } from "../../components/progress/ProgressAnalyticsView";

export default function CoachPersonalProgressScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [wpw, setWpw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [history, group] = await Promise.all([
      workoutService.getWorkoutHistory(user.id),
      trainingGroupService.getLatestGroupForStudentId(user.id).catch(() => null),
    ]);
    setLogs(Array.isArray(history) ? history : []);
    setWpw(group?.workoutsPerWeek && group.workoutsPerWeek > 0 ? group.workoutsPerWeek : 0);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch {
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ProgressAnalyticsView
      variant="student"
      logs={logs}
      wpw={wpw}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}
