import { useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import { useRealtimeUserContact } from "../../hooks/useRealtimeUserContact";
import { openMessengerContact } from "../../utils/messengerValidation";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutPlan, WorkoutLog } from "../../types/Workout";
import { formatDurationForHistory } from "../../utils/workoutDuration";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ContactButton } from "../../components/profile/ContactButton";
import { WarningBanner } from "../../components/profile/WarningBanner";
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
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const fetcher = useCallback(async (): Promise<StudentDetailsData> => {
    logger.log("[coach/studentDetails] load start", { studentId });
    if (!studentId) throw new Error(t("missingStudentIdError"));
    if (!userId || userRole !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
    const studentDoc = await studentService.getStudentById(studentId);
    logger.log("[coach/studentDetails] fetched student", studentDoc?.id);
    if (!studentDoc) throw new Error(t("studentNotFoundError"));
    if (studentDoc.coachId !== userId) throw new Error(t("noAccessToStudentError"));

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
  }, [studentId, userId, userRole, t]);

  const { data: detailsData, loading, error: loadError } = useAsyncData<StudentDetailsData>(fetcher, [fetcher]);

  const studentContact = useRealtimeUserContact(studentId || undefined);

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
  const lastWorkoutLbl = useMemo(() => lastWorkoutLabel(logs, locale), [logs, locale]);
  const weeklyProg = useMemo(() => weeklyProgress(logs, latestGroup, planById), [logs, latestGroup, planById]);
  const assignedPct = useMemo(() => assignedProgramBarPercent(compliancePct, weeklyProg), [compliancePct, weeklyProg]);
  const avgDurationSeconds = useMemo(() => averageRecentDurationSeconds(logs), [logs]);
  const avgDurationLabel = useMemo(() => (avgDurationSeconds != null ? formatDurationForHistory(avgDurationSeconds, t) : null), [avgDurationSeconds, t]);

  const effectiveStudentType = studentContact.loading ? student?.messengerType ?? null : studentContact.messengerType;
  const effectiveStudentHandle = studentContact.loading ? student?.messengerHandle ?? null : studentContact.messengerHandle;
  const studentHasContact = Boolean(effectiveStudentType && effectiveStudentHandle);
  const coachHasOwnContact = Boolean(user?.messengerType && user?.messengerHandle);

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
        <PrimaryButton title={t("backToDashboard")} onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>{t("studentNotLoaded")}</Text>
        <PrimaryButton title={t("backToDashboard")} onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  const displayName = getDisplayName(student, t("roleStudent"));
  const initials = getUserInitials(student, "S");

  return (
    <ScreenLayout>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("back")}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressedOpacity9]}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.topTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t("studentCommandCenter")}
            </Text>
            <View style={styles.topBarSpacer} />
          </View>

          <StudentProfileHero
            displayName={displayName}
            email={student.email}
            initials={initials}
            photoURL={student.photoURL}
            latestGroup={latestGroup}
            lastWorkoutLabel={lastWorkoutLbl}
          />

          <View style={styles.actionsRow}>
            <StudentActionButton
              title={t("assignWorkoutAction")}
              icon="barbell"
              variant="primary"
              onPress={() =>
                router.push({ pathname: "/coach/selectTrainingGroup", params: { studentId, studentName: displayName } })
              }
            />
            <StudentActionButton
              title={t("createNewGroupAction")}
              icon="add-circle-outline"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/coach/createTrainingGroup", params: { studentId, studentName: displayName } })
              }
            />
            <StudentActionButton
              title={t("viewProgressAction")}
              icon="stats-chart-outline"
              iconColor="#64D2FF"
              variant="secondary"
              onPress={() => router.push({ pathname: "/coach/progress", params: { studentId, focusProgress: "1" } })}
            />
          </View>

          {!studentHasContact ? (
            <WarningBanner
              title={t("studentNoContactTitle")}
              body={t("studentNoContactBody", { name: student.firstName || displayName })}
            />
          ) : null}

          <ContactButton
            variant={studentHasContact ? (effectiveStudentType === "telegram" ? "telegram" : "whatsapp") : "disabled"}
            title={t("textStudent")}
            subtitle={
              studentHasContact
                ? effectiveStudentType === "telegram"
                  ? t("openTelegramHandle", { handle: effectiveStudentHandle })
                  : t("openWhatsappNumber", { number: effectiveStudentHandle })
                : t("studentContactMissingBtn")
            }
            onPress={
              studentHasContact
                ? () => openMessengerContact(effectiveStudentType!, effectiveStudentHandle!)
                : undefined
            }
          />

          {!coachHasOwnContact ? (
            <WarningBanner
              title={t("yourContactMissingTitle")}
              body={t("yourContactMissingCoachBody")}
              linkText={t("addInSettingsLink")}
              onPressLink={() => router.push({ pathname: "/(profile)/edit", params: { focus: "messenger" } })}
            />
          ) : null}

          <Text style={styles.sectionLabel}>{t("quickStats")}</Text>
          <View style={styles.statsRow}>
            <StudentStatCard label={t("statWorkoutsCompleted")} value={String(logs.length)} icon="barbell-outline" tint={Colors.primary} />
            <StudentStatCard
              label={t("kpiCompliance")}
              value={compliancePct != null ? `${compliancePct}%` : "—"}
              icon="checkmark-done-outline"
              tint="#FF6B6B"
            />
          </View>
          <View style={[styles.statsRow, styles.mbMd]}>
            <StudentStatCard
              label={t("statCurrentStreak")}
              value={streakDays ? `${streakDays}d` : "—"}
              icon="flame-outline"
              tint="#FF8C42"
            />
            <StudentStatCard label={t("statAvgDuration")} value={avgDurationLabel ?? "—"} icon="time-outline" tint="#64D2FF" />
          </View>

          <View style={styles.assignedHeader}>
            <Text style={Typography.section}>{t("assignedProgramTitle")}</Text>
            {latestGroup ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("changeTrainingSplitA11y")}
                onPress={() =>
                  router.push({
                    pathname: "/coach/selectTrainingGroup",
                    params: { studentId, studentName: displayName, selectedGroupId: latestGroup.id },
                  })
                }
                style={({ pressed }) => [pressed && styles.pressedOpacity9]}
              >
                <Text style={styles.changeLink}>{t("changeAction")}</Text>
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

          <Text style={styles.insightsTitle}>{t("complianceInsightsTitle")}</Text>
          <View style={styles.insightsCard}>
            <Text style={styles.mutedSecondary}>
              {compliancePct != null
                ? t("complianceThisWeek", { pct: compliancePct, n: latestGroup?.workoutsPerWeek ?? "—" })
                : t("setWorkoutsPerWeekTarget")}
            </Text>
            <Text style={[styles.mutedSecondary, styles.insightsSecondLine]}>
              {streakDays
                ? t(streakDays === 1 ? "currentStreakLine_one" : "currentStreakLine_other", { count: streakDays })
                : t("noActiveStreak")}
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
  topTitle: { ...Typography.section, fontWeight: "900", flex: 1, textAlign: "center" },
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
