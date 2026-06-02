import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { useI18n } from "../../../context/I18nContext";
import { studentService } from "../../../services/studentService";
import { workoutService } from "../../../services/workoutService";
import type { StudentSummary } from "../../../types/StudentSummary";
import type { WorkoutPlan, WorkoutLog } from "../../../types/Workout";
import { Avatar } from "../../../components/Avatar";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography, FontSizes } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { formatDate, formatDateShort } from "../../../utils/formatLocale";
import { getUserInitials, getDisplayName } from "../../../utils/userDisplay";
import { toMs } from "../../../utils/dateConvert";
import type { SupportedLocale } from "../../../context/I18nContext";

function formatRelativeDone(
  ms: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: SupportedLocale
): string {
  if (!ms) return t("never");
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days < 0) return t("recently");
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("daysAgo", { n: days });
  return formatDateShort(ms, locale);
}

const coachDisplayName = (user: { firstName?: string | null; lastName?: string | null } | null) =>
  getDisplayName(user, "Coach");

const initials = (user: { firstName?: string | null; lastName?: string | null } | null) =>
  getUserInitials(user, "C");

export default function CoachDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [workoutsCompletedToday, setWorkoutsCompletedToday] = useState(0);
  const [personalPlans, setPersonalPlans] = useState<WorkoutPlan[]>([]);
  const [personalLogs, setPersonalLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayLine = useMemo(() => {
    const dateStr = formatDate(Date.now(), locale, { month: "short", day: "numeric", year: "numeric" });
    return t("todayHappening", { date: dateStr });
  }, [locale, t]);

  useEffect(() => {
    if (!user || user.role !== "coach") {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        setError(null);
        const data = await studentService.getStudentsForCoach(user.id);
        setStudents(data);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const startMs = start.getTime();
        const endMs = end.getTime();

        const logsByStudent = await Promise.all(
          data.map(async (s) => {
            try {
              return await workoutService.getWorkoutHistory(s.id);
            } catch {
              return [];
            }
          })
        );
        const count = logsByStudent
          .flat()
          .filter((l: any) => {
            const when = l?.completedAt ?? l?.date;
            if (!when) return false;
            const ms = new Date(String(when)).getTime();
            return Number.isFinite(ms) && ms >= startMs && ms < endMs;
          }).length;
        setWorkoutsCompletedToday(count);

        // Personal training — non-blocking
        try {
          const [plans, logs] = await Promise.all([
            workoutService.getActiveWorkoutPlansForStudent(user.id),
            workoutService.getWorkoutHistory(user.id),
          ]);
          setPersonalPlans(plans.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
          setPersonalLogs(logs);
        } catch {
          // silently ignore; student data is already rendered
        }
      } catch (e: any) {
        console.error("[coach/dashboard] load error", e);
        setError(e.message ?? t("failedToLoad"));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const onRefresh = useCallback(async () => {
    if (!user || user.role !== "coach") return;
    setRefreshing(true);
    try {
      setError(null);
      const data = await studentService.getStudentsForCoach(user.id);
      setStudents(data);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const startMs = start.getTime();
      const endMs = end.getTime();

      const logsByStudent = await Promise.all(
        data.map(async (s) => {
          try {
            return await workoutService.getWorkoutHistory(s.id);
          } catch {
            return [];
          }
        })
      );
      const count = logsByStudent
        .flat()
        .filter((l: any) => {
          const when = l?.completedAt ?? l?.date;
          if (!when) return false;
          const ms = new Date(String(when)).getTime();
          return Number.isFinite(ms) && ms >= startMs && ms < endMs;
        }).length;
      setWorkoutsCompletedToday(count);

      try {
        const [plans, logs] = await Promise.all([
          workoutService.getActiveWorkoutPlansForStudent(user.id),
          workoutService.getWorkoutHistory(user.id),
        ]);
        setPersonalPlans(plans.sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
        setPersonalLogs(logs);
      } catch {
        // silently ignore
      }
    } catch (e: any) {
      console.error("[coach/dashboard] refresh error", e);
        setError(e.message ?? t("failedToLoad"));
    } finally {
      setRefreshing(false);
    }
  }, [user?.id, user?.role]);

  const mostRecentPlan = personalPlans[0] ?? null;
  const lastMsByPlanId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of personalLogs) {
      const id = log.workoutPlanId;
      if (!id) continue;
      const ms = toMs(log.completedAt ?? log.date);
      if (!ms) continue;
      map[id] = Math.max(map[id] ?? 0, ms);
    }
    return map;
  }, [personalLogs]);

  if (loading) {
    return (
      <ScreenLayout>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: Colors.bg,
          }}
        >
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 16,
            backgroundColor: Colors.bg,
          }}
        >
          <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
          <PrimaryButton title={t("goToLogin")} onPress={() => router.replace("/login")} />
        </View>
      </ScreenLayout>
    );
  }

  const name = coachDisplayName(user);
  const ini = initials(user);

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.card}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: Spacing.md,
            paddingBottom: Spacing.xl,
            // Give the header (avatar + name) more breathing room below the notch.
            paddingTop: Spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: Spacing.md,
              marginBottom: Spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile settings"
                onPress={() => router.push("/coach/profile")}
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Avatar
                  photoURL={user?.photoURL}
                  initials={ini}
                  size={52}
                  backgroundColor={Colors.surface}
                  textColor={Colors.text}
                  borderColor={Colors.primary}
                  borderWidth={2}
                />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{name}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.primary, marginTop: 2, fontWeight: "600" }}>
                  {t("activeNow")}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.xl,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.danger,
                }}
              />
            </Pressable>
          </View>

          <Text style={{ ...Typography.title, fontSize: FontSizes.h2, marginBottom: 4 }}>{t("overview")}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
            {todayLine}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: Spacing.md,
              marginBottom: Spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: Spacing.sm,
                }}
              >
                <Ionicons name="people" size={18} color={Colors.primary} />
              </View>
              <Text style={{ fontSize: 32, fontWeight: "800", color: Colors.text, lineHeight: 36 }}>
                {students.length}
              </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                {t("totalStudents")}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: Spacing.sm,
                }}
              >
                <Ionicons name="barbell-outline" size={18} color="#64D2FF" />
              </View>
              <Text style={{ fontSize: 32, fontWeight: "800", color: Colors.text, lineHeight: 36 }}>
                {workoutsCompletedToday}
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                {t("workoutsCompletedToday")}
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                {t("todayLabel")}
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}
          >
            <Pressable
              onPress={() => router.push("/coach/myTraining" as any)}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: 16,
                paddingHorizontal: Spacing.sm,
                borderRadius: Radius.lg,
                backgroundColor: Colors.primary,
                opacity: pressed ? 0.92 : 1,
                ...(Platform.OS === "ios"
                  ? {
                      shadowColor: Colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                    }
                  : { elevation: 8 }),
              })}
            >
              <Ionicons name="barbell-outline" size={18} color={Colors.onPrimary} />
              <Text style={{ ...Typography.section, fontWeight: "800", color: Colors.onPrimary }}>
                {t("nav_myTraining")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/coach/createStudent")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: 16,
                paddingHorizontal: Spacing.sm,
                borderRadius: Radius.lg,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Ionicons name="person-add-outline" size={22} color={Colors.primary} />
              <Text style={{ ...Typography.section, fontWeight: "700", color: Colors.text }}>
                {t("addStudent")}
              </Text>
            </Pressable>
          </View>

          {/* My Training preview */}
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
              marginBottom: Spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
              <Text style={{ ...Typography.section, fontWeight: "800" }}>{t("nav_myTraining")}</Text>
              <Pressable
                onPress={() => router.push("/coach/myTraining" as any)}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "700" }}>{t("viewAll")}</Text>
              </Pressable>
            </View>

            {mostRecentPlan ? (
              <View>
                <Text style={{ ...Typography.section, fontSize: FontSizes.subheading, fontWeight: "800", marginBottom: 2 }}>
                  {mostRecentPlan.name}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.sm }}>
                  {t("lastWhen", { when: formatRelativeDone(lastMsByPlanId[mostRecentPlan.id] ?? 0, t, locale) })}
                </Text>
                <PrimaryButton
                  title={t("start")}
                  onPress={() =>
                    router.push({
                      pathname: "/coach/workoutExecution" as any,
                      params: { workoutPlanId: mostRecentPlan.id, workoutName: mostRecentPlan.name },
                    })
                  }
                />
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Ionicons name="barbell-outline" size={20} color={Colors.textMuted} />
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, flex: 1 }}>
                  {t("myTrainingEmptyDash")}
                </Text>
                <Pressable
                  onPress={() => router.push("/coach/createPersonalPlan" as any)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "700" }}>{t("start")}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Students list removed (available in Students tab). */}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}


