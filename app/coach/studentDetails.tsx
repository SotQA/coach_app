import { useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { studentService } from "../../services/studentService";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutPlan, WorkoutLog } from "../../types/Workout";
import { formatDurationForHistory } from "../../utils/workoutDuration";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { StudentStatCard } from "../../components/student/StudentStatCard";
import { StudentActionButton } from "../../components/student/StudentActionButton";
import { StudentProfileHero } from "../../components/student/StudentProfileHero";
import { StudentProgramProgressCard } from "../../components/student/StudentProgramProgressCard";
import type { TrainingGroup } from "../../types/TrainingGroup";
import { logger } from "@/utils/logger";
import { getUserInitials, getDisplayName } from "@/utils/userDisplay";
import { useAsyncData } from "../../hooks/useAsyncData";
import {
  assignedProgramBarPercent,
  averageRecentDurationSeconds,
  buildPlanById,
  compliancePercent,
  currentStreakDays,
  lastWorkoutLabel,
  weeklyProgress,
} from "@/utils/studentMetrics";

type StudentDetailsData = {
  student: StudentSummary;
  latestGroup: TrainingGroup | null;
  plans: WorkoutPlan[];
  logs: WorkoutLog[];
};

export default function StudentDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const fetcher = useCallback(async (): Promise<StudentDetailsData> => {
    logger.log("[coach/studentDetails] load start", { studentId });
    if (!studentId) throw new Error("Missing studentId.");
    if (!userId || userRole !== "coach") throw new Error("You must be logged in as a coach.");
    const studentDoc = await studentService.getStudentById(studentId);
    logger.log("[coach/studentDetails] fetched student", studentDoc?.id);
    if (!studentDoc) throw new Error("Student not found.");
    if (studentDoc.coachId !== userId) throw new Error("You don't have access to this student.");

    const [gResult, plansResult, historyResult] = await Promise.allSettled([
      trainingGroupService.getLatestTrainingGroupForStudent(userId, studentId),
      workoutService.getWorkoutPlansForStudentAsCoach(userId, studentId),
      workoutService.getWorkoutHistory(studentId),
    ]);
    if (gResult.status === "rejected") {
      logger.warn("[studentDetails] partial load failure", { which: "trainingGroup", reason: gResult.reason });
    }
    const workoutPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
    if (plansResult.status === "rejected") {
      logger.warn("[studentDetails] partial load failure", { which: "workoutPlans", reason: plansResult.reason });
    }
    logger.log("[coach/studentDetails] fetched plans", workoutPlans.length);
    const history = historyResult.status === "fulfilled" ? historyResult.value : [];
    if (historyResult.status === "rejected") {
      logger.warn("[studentDetails] partial load failure", { which: "history", reason: historyResult.reason });
    }
    logger.log("[coach/studentDetails] fetched logs", history.length);
    return {
      student: studentDoc,
      latestGroup: gResult.status === "fulfilled" ? gResult.value : null,
      plans: workoutPlans,
      logs: history,
    };
  }, [studentId, userId, userRole]);

  const { data: detailsData, loading, error: loadError } = useAsyncData<StudentDetailsData>(fetcher, [fetcher]);

  const student = detailsData?.student ?? null;
  const plans = useMemo(() => detailsData?.plans ?? [], [detailsData]);
  const logs = useMemo(() => detailsData?.logs ?? [], [detailsData]);
  const latestGroup = detailsData?.latestGroup ?? null;

  const planById = useMemo(() => buildPlanById(plans), [plans]);
  const streakDays = useMemo(() => currentStreakDays(logs), [logs]);
  const compliancePct = useMemo(
    () => compliancePercent(logs, latestGroup?.workoutsPerWeek),
    [logs, latestGroup?.workoutsPerWeek]
  );
  const lastWorkoutLbl = useMemo(() => lastWorkoutLabel(logs), [logs]);
  const weeklyProg = useMemo(() => weeklyProgress(logs, latestGroup, planById), [logs, latestGroup, planById]);
  const assignedPct = useMemo(() => assignedProgramBarPercent(compliancePct, weeklyProg), [compliancePct, weeklyProg]);
  const avgDurationSeconds = useMemo(() => averageRecentDurationSeconds(logs), [logs]);
  const avgDurationLabel = useMemo(() => (avgDurationSeconds != null ? formatDurationForHistory(avgDurationSeconds) : null), [avgDurationSeconds]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.errorWrapPad16}>
        <Text style={styles.errorText}>{loadError.message}</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>Student not loaded.</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  const displayName = getDisplayName(student, "Student");
  const initials = getUserInitials(student, "S");

  return (
    <ScreenLayout>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressedOpacity9]}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.topTitle}>Student Command Center</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <StudentProfileHero
            displayName={displayName}
            email={student.email}
            initials={initials}
            latestGroup={latestGroup}
            lastWorkoutLabel={lastWorkoutLbl}
          />

          <View style={styles.actionsRow}>
            <StudentActionButton
              title="Assign Workout"
              icon="barbell"
              variant="primary"
              onPress={() =>
                router.push({ pathname: "/coach/selectTrainingGroup", params: { studentId, studentName: displayName } })
              }
            />
            <StudentActionButton
              title="Create New Group"
              icon="add-circle-outline"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/coach/createTrainingGroup", params: { studentId, studentName: displayName } })
              }
            />
            <StudentActionButton
              title="View Progress"
              icon="stats-chart-outline"
              iconColor="#64D2FF"
              variant="secondary"
              onPress={() => router.push({ pathname: "/coach/progress", params: { studentId, focusProgress: "1" } })}
            />
          </View>

          <Text style={styles.sectionLabel}>Quick stats</Text>
          <View style={styles.statsRow}>
            <StudentStatCard label="Workouts completed" value={String(logs.length)} icon="barbell-outline" tint={Colors.primary} />
            <StudentStatCard
              label="Compliance"
              value={compliancePct != null ? `${compliancePct}%` : "—"}
              icon="checkmark-done-outline"
              tint="#FF6B6B"
            />
          </View>
          <View style={[styles.statsRow, styles.mbMd]}>
            <StudentStatCard
              label="Current streak"
              value={streakDays ? `${streakDays}d` : "—"}
              icon="flame-outline"
              tint="#FF8C42"
            />
            <StudentStatCard label="Avg duration" value={avgDurationLabel ?? "—"} icon="time-outline" tint="#64D2FF" />
          </View>

          <View style={styles.assignedHeader}>
            <Text style={Typography.section}>Assigned Program</Text>
            {latestGroup ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change training split"
                onPress={() =>
                  router.push({
                    pathname: "/coach/selectTrainingGroup",
                    params: { studentId, studentName: displayName, selectedGroupId: latestGroup.id },
                  })
                }
                style={({ pressed }) => [pressed && styles.pressedOpacity9]}
              >
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            ) : null}
          </View>

          <StudentProgramProgressCard
            latestGroup={latestGroup}
            assignedPct={assignedPct}
            compliancePct={compliancePct}
            weeklyProg={weeklyProg}
            onPressCard={() => {
              if (!latestGroup?.id) return;
              router.push({
                pathname: "/coach/assignedWorkouts",
                params: { studentId, studentName: displayName, groupId: latestGroup.id, groupName: latestGroup.name },
              });
            }}
            onPressCreateGroup={() =>
              router.push({ pathname: "/coach/createTrainingGroup", params: { studentId, studentName: displayName } })
            }
          />

          <Text style={styles.insightsTitle}>Compliance insights</Text>
          <View style={styles.insightsCard}>
            <Text style={styles.mutedSecondary}>
              {compliancePct != null ? `This week: ${compliancePct}% of target (${latestGroup?.workoutsPerWeek ?? "—"} workouts/week).` : "Set a workouts/week target to track compliance."}
            </Text>
            <Text style={[styles.mutedSecondary, styles.insightsSecondLine]}>
              {streakDays ? `Current streak: ${streakDays} day${streakDays === 1 ? "" : "s"}.` : "No active streak yet."}
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  errorWrap: { flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg },
  errorWrapPad16: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: Colors.bg },
  errorText: { color: Colors.danger, marginBottom: Spacing.sm },
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  pressedOpacity9: { opacity: 0.9 },
  topTitle: { ...Typography.section, fontWeight: "900" },
  topBarSpacer: { width: 40, height: 40 },
  actionsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  sectionLabel: { ...Typography.section, marginBottom: Spacing.xs },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  mbMd: { marginBottom: Spacing.md },
  assignedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  changeLink: { ...Typography.secondary, color: Colors.primary, fontWeight: "800" },
  insightsTitle: { ...Typography.section, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  insightsCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  mutedSecondary: { ...Typography.secondary, color: Colors.textMuted },
  insightsSecondLine: { marginTop: 6 },
});
