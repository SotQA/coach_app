import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { studentService } from "../../../services/studentService";
import { workoutService } from "../../../services/workoutService";
import { trainingGroupService } from "../../../services/trainingGroupService";
import type { StudentSummary } from "../../../types/StudentSummary";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { ProgressAnalyticsView } from "../../../components/progress/ProgressAnalyticsView";

export default function CoachProgressTab() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string; focusProgress?: string }>();
  const paramStudentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);

  const coachProgressDefaults = useMemo(() => {
    if (params.focusProgress !== "1") return null;
    return {
      timePreset: "4w" as const,
      exerciseAll: true as const,
      forStudentId: paramStudentId,
    };
  }, [params.focusProgress, paramStudentId]);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [wpw, setWpw] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!user || user.role !== "coach") return;
    const list = await studentService.getStudentsForCoach(user.id);
    setStudents(list);
    setStudentId((prev) => {
      if (paramStudentId && list.some((s) => s.id === paramStudentId)) return paramStudentId;
      if (prev && list.some((s) => s.id === prev)) return prev;
      if (list.length) return list[0].id;
      return "";
    });
  }, [user, paramStudentId]);

  const loadStudentData = useCallback(async () => {
    if (!user || user.role !== "coach" || !studentId) return;
    const [history, group] = await Promise.all([
      workoutService.getWorkoutHistory(studentId),
      trainingGroupService.getLatestTrainingGroupForStudent(user.id, studentId).catch(() => null),
    ]);
    setLogs(history);
    setWpw(group?.workoutsPerWeek && group.workoutsPerWeek > 0 ? group.workoutsPerWeek : 0);
  }, [user, studentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadStudents();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStudents]);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        await loadStudentData();
      } catch (e) {
        console.error("[coach/progress]", e);
      }
    })();
  }, [studentId, loadStudentData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadStudents();
      await loadStudentData();
    } finally {
      setRefreshing(false);
    }
  }, [loadStudents, loadStudentData]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (!user || user.role !== "coach") {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, padding: Spacing.md, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger }}>Coach access only.</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ProgressAnalyticsView
      variant="coach"
      logs={logs}
      wpw={wpw}
      refreshing={refreshing}
      onRefresh={onRefresh}
      coachProgressDefaults={coachProgressDefaults}
      coachContext={{
        students,
        selectedStudentId: studentId,
        onSelectStudent: setStudentId,
      }}
    />
  );
}
