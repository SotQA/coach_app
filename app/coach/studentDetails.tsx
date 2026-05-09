import { useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable } from "react-native";
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
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { StudentStatCard } from "../../components/student/StudentStatCard";
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

export default function StudentDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  type StudentDetailsData = {
    student: StudentSummary;
    latestGroup: TrainingGroup | null;
    plans: WorkoutPlan[];
    logs: WorkoutLog[];
  };

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

  const { data: detailsData, loading, error: loadError } = useAsyncData<StudentDetailsData>(
    fetcher,
    [fetcher]
  );

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
  const weeklyProg = useMemo(
    () => weeklyProgress(logs, latestGroup, planById),
    [logs, latestGroup, planById]
  );
  const assignedPct = useMemo(
    () => assignedProgramBarPercent(compliancePct, weeklyProg),
    [compliancePct, weeklyProg]
  );
  const avgDurationSeconds = useMemo(() => averageRecentDurationSeconds(logs), [logs]);
  const avgDurationLabel = useMemo(
    () => (avgDurationSeconds != null ? formatDurationForHistory(avgDurationSeconds) : null),
    [avgDurationSeconds]
  );

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

  if (loadError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{loadError.message}</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>Student not loaded.</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  const displayName = getDisplayName(student, "Student");
  const initials = getUserInitials(student, "S");

  const ActionButton = ({
    title,
    icon,
    iconColor,
    variant,
    onPress,
  }: {
    title: string;
    icon: any;
    iconColor?: string;
    variant: "primary" | "secondary";
    onPress: () => void;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: variant === "primary" ? Colors.primary : Colors.card,
        borderWidth: variant === "primary" ? 0 : 1,
        borderColor: variant === "primary" ? "transparent" : Colors.border,
        opacity: pressed ? 0.92 : 1,
        ...(variant === "primary"
          ? {
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 8,
            }
          : null),
      })}
    >
      <Ionicons
        name={icon}
        size={18}
        color={iconColor ?? (variant === "primary" ? Colors.onPrimary : Colors.primary)}
      />
      <Text
        numberOfLines={3}
        style={{
          ...Typography.section,
          fontSize: FontSizes.note,
          lineHeight: 16,
          fontWeight: variant === "primary" ? "800" : "700",
          color: variant === "primary" ? Colors.onPrimary : Colors.text,
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}>
          {/* Top bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: Radius.lg,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </Pressable>

            <Text style={{ ...Typography.section, fontWeight: "900" }}>Student Command Center</Text>
            <View style={{ width: 40, height: 40 }} />
          </View>

          {/* Hero profile card */}
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.lg,
              marginBottom: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: Colors.surface,
                  borderWidth: 2,
                  borderColor: Colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ ...Typography.section, fontSize: FontSizes.h3, fontWeight: "900" }}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, fontSize: 24 }}>{displayName}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>
                  {student.email}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.sm }}>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: Colors.surface,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      {latestGroup?.name?.trim() ? latestGroup.name.trim() : "No active training split"}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: Colors.surface,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      {latestGroup?.workoutsPerWeek ? `${latestGroup.workoutsPerWeek} workouts/week` : "Workouts/week —"}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: Colors.surface,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      {lastWorkoutLbl ? `Last workout: ${lastWorkoutLbl}` : "Last workout: —"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Coach actions bar */}
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <ActionButton
              title="Assign Workout"
              icon="barbell"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: "/coach/selectTrainingGroup",
                  params: { studentId, studentName: displayName },
                })
              }
            />
            <ActionButton
              title="Create New Group"
              icon="add-circle-outline"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/coach/createTrainingGroup",
                  params: { studentId, studentName: displayName },
                })
              }
            />
            <ActionButton
              title="View Progress"
              icon="stats-chart-outline"
              iconColor="#64D2FF"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/coach/progress",
                  params: { studentId, focusProgress: "1" },
                })
              }
            />
          </View>

          {/* Quick stats */}
          <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Quick stats</Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
            <StudentStatCard
              label="Workouts completed"
              value={String(logs.length)}
              icon="barbell-outline"
              tint={Colors.primary}
            />
            <StudentStatCard
              label="Compliance"
              value={compliancePct != null ? `${compliancePct}%` : "—"}
              icon="checkmark-done-outline"
              tint="#FF6B6B"
            />
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <StudentStatCard
              label="Current streak"
              value={streakDays ? `${streakDays}d` : "—"}
              icon="flame-outline"
              tint="#FF8C42"
            />
            <StudentStatCard
              label="Avg duration"
              value={avgDurationLabel ?? "—"}
              icon="time-outline"
              tint="#64D2FF"
            />
          </View>

          {/* Active training group card */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ ...Typography.section }}>Assigned Program</Text>
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
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "800" }}>Change</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => {
              if (!latestGroup?.id) return;
              router.push({
                pathname: "/coach/assignedWorkouts",
                params: {
                  studentId,
                  studentName: displayName,
                  groupId: latestGroup.id,
                  groupName: latestGroup.name,
                },
              });
            }}
            style={({ pressed }) => ({
              // Slight blue-tinted card like the reference screenshot.
              backgroundColor: "#121A26",
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.surfaceHighlight,
              marginBottom: Spacing.md,
              opacity: pressed ? 0.96 : 1,
            })}
          >
            {latestGroup ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ ...Typography.title, fontSize: FontSizes.subheading }}>{latestGroup.name}</Text>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                      {latestGroup.workoutsPerWeek ? `${latestGroup.workoutsPerWeek} days/week` : "Days/week —"}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: Radius.lg,
                      backgroundColor: Colors.surfaceSubtle,
                      borderWidth: 1,
                      borderColor: Colors.surfaceHighlight,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="flash" size={18} color={Colors.primary} />
                  </View>
                </View>

                <View style={{ marginTop: Spacing.md }}>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: Colors.surfaceHighlight,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${assignedPct}%`,
                        height: "100%",
                        backgroundColor: Colors.primary,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      Progress
                    </Text>
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      {typeof compliancePct === "number" ? `${assignedPct}%` : weeklyProg.target ? `${weeklyProg.completed} of ${weeklyProg.target} this week` : "—"}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: Spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                    Tap to view assigned workouts
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textMuted}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={{ ...Typography.title, fontSize: FontSizes.subheading }}>No active training split</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>
                  Create a split to start assigning workouts.
                </Text>
                <PrimaryButton
                  title="Create New Group"
                  onPress={() =>
                    router.push({
                      pathname: "/coach/createTrainingGroup",
                      params: { studentId, studentName: displayName },
                    })
                  }
                  style={{ backgroundColor: Colors.border, marginTop: Spacing.md }}
                />
              </>
            )}
          </Pressable>

          {/* Compliance insights */}
          <Text style={{ ...Typography.section, marginTop: Spacing.lg, marginBottom: Spacing.xs }}>
            Compliance insights
          </Text>
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
              marginBottom: Spacing.md,
            }}
          >
            <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
              {compliancePct != null
                ? `This week: ${compliancePct}% of target (${latestGroup?.workoutsPerWeek ?? "—"} workouts/week).`
                : "Set a workouts/week target to track compliance."}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>
              {streakDays
                ? `Current streak: ${streakDays} day${streakDays === 1 ? "" : "s"}.`
                : "No active streak yet."}
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}



