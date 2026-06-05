import { useCallback, useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { studentService } from "../../services/studentService";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutPlan } from "../../types/Workout";
import type { TrainingGroup } from "../../types/TrainingGroup";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { logger } from "@/utils/logger";
import { getUserInitials, getDisplayName } from "@/utils/userDisplay";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useStudentProgress } from "../../hooks/useStudentProgress";
import { statusFromCounts } from "../../utils/rosterAggregates";
import { CoachDrillDownHeader } from "../../components/progress/coach/CoachDrillDownHeader";
import { CoachActionsFooter } from "../../components/progress/coach/CoachActionsFooter";
import { TimeRangeChips } from "../../components/progress/TimeRangeChips";
import { HeroKpiBand } from "../../components/progress/sections/HeroKpiBand";
import { ConsistencyHeatmapSection } from "../../components/progress/sections/ConsistencyHeatmapSection";
import { StrengthSparklinesSection } from "../../components/progress/sections/StrengthSparklinesSection";
import { WeeklyVolumeSection } from "../../components/progress/sections/WeeklyVolumeSection";
import { RecentPRsSection } from "../../components/progress/sections/RecentPRsSection";
import { CoachingSignalsSection } from "../../components/progress/sections/CoachingSignalsSection";
import { ProgressEmptyState } from "../../components/progress/ProgressEmptyState";

type StudentDetailsData = {
  student: StudentSummary;
  latestGroup: TrainingGroup | null;
  plans: WorkoutPlan[];
};

export default function StudentDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
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

    const [gResult, plansResult] = await Promise.allSettled([
      trainingGroupService.getLatestTrainingGroupForStudent(userId, studentId),
      workoutService.getWorkoutPlansForStudentAsCoach(userId, studentId),
    ]);
    if (gResult.status === "rejected") {
      logger.warn("[studentDetails] partial load failure", { which: "trainingGroup", reason: gResult.reason });
    }
    const workoutPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
    if (plansResult.status === "rejected") {
      logger.warn("[studentDetails] partial load failure", { which: "workoutPlans", reason: plansResult.reason });
    }
    return {
      student: studentDoc,
      latestGroup: gResult.status === "fulfilled" ? gResult.value : null,
      plans: workoutPlans,
    };
  }, [studentId, userId, userRole]);

  const { data: detailsData, loading: profileLoading, error: profileError } = useAsyncData<StudentDetailsData>(fetcher, [fetcher]);

  const student = detailsData?.student ?? null;

  const studentAsUser = useMemo(
    () => studentId ? { id: studentId, role: "student" as const } : null,
    [studentId],
  );
  const p = useStudentProgress(studentAsUser);

  const displayName = useMemo(() => getDisplayName(student, "Student"), [student]);
  const initials = useMemo(() => getUserInitials(student, "S"), [student]);

  const status = useMemo(() => {
    if (!p.weeklyTarget) return null;
    return statusFromCounts(p.sessionsThisWeek, p.sessionsLastWeek, p.weeklyTarget);
  }, [p.sessionsThisWeek, p.sessionsLastWeek, p.weeklyTarget]);

  const lastActiveLabel = useMemo(() => {
    if (!p.lastSessionMs) return null;
    const diffDays = Math.floor((Date.now() - p.lastSessionMs) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return t("last_active_today");
    if (diffDays === 1) return t("last_active_days_ago_one", { count: 1 });
    return t("last_active_days_ago_other", { count: diffDays });
  }, [p.lastSessionMs, t]);

  const loading = profileLoading || p.loading;
  const error = profileError ?? p.error;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <CoachDrillDownHeader
        studentName={displayName}
        photoURL={student?.photoURL}
        initials={initials}
        status={status}
        lastActiveLabel={lastActiveLabel}
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.md }}>
          <Text style={{ color: Colors.danger }}>{error.message}</Text>
        </View>
      ) : !p.hasAnyLogs ? (
        <View style={{ flex: 1, padding: Spacing.md, justifyContent: "center" }}>
          <ProgressEmptyState kind="no-data" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 120, paddingTop: Spacing.sm }}
        >
          <TimeRangeChips value={p.timePreset} onChange={p.setTimePreset} />
          {!p.hasMinimumData ? (
            <>
              <ConsistencyHeatmapSection countsByDay={p.countsByDay} />
              <ProgressEmptyState kind="below-minimum" />
            </>
          ) : (
            <>
              <HeroKpiBand
                streakWeeks={p.streakWeeks}
                sessionsThisWeek={p.sessionsThisWeek}
                weeklyTarget={p.weeklyTarget}
                totalVolumeInRange={p.totalVolumeInRange}
                totalVolumeDeltaPct={p.totalVolumeDeltaPct}
              />
              <ConsistencyHeatmapSection countsByDay={p.countsByDay} />
              <StrengthSparklinesSection
                rows={p.strengthRows}
                hasMore={p.hasMoreStrengthRows}
                allRows={p.allStrengthRows}
              />
              <WeeklyVolumeSection bars={p.weeklyVolumeBars} />
              <RecentPRsSection prs={p.recentPRs} />
              <CoachingSignalsSection signals={p.coachingSignals} />
            </>
          )}
        </ScrollView>
      )}

      {p.hasMinimumData ? (
        <CoachActionsFooter
          lastLogId={p.lastLogId}
          onLeaveFeedback={(logId) => router.push(`/coach/workoutLogFeedback?logId=${logId}` as any)}
        />
      ) : null}
    </View>
  );
}
