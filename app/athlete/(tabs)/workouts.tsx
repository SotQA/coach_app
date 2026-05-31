import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { useActiveWorkoutSession } from "../../../context/ActiveWorkoutSessionContext";
import { useElapsedSeconds } from "../../../context/ElapsedTimeContext";
import { useI18n } from "../../../context/I18nContext";
import { workoutService } from "../../../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography, FontSizes } from "../../../theme/typography";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { formatElapsedForTimer } from "../../../utils/workoutDuration";
import { FLOATING_BAR_SCROLL_OFFSET } from "../../../components/FloatingWorkoutBar";
import { formatDateShort } from "../../../utils/formatLocale";
import type { SupportedLocale } from "../../../context/I18nContext";
import { toMs } from "../../../utils/dateConvert";
import { dayKeyFromMs, startOfWeekMonday, isInCurrentWeek, isInCurrentMonth } from "../../../utils/dateRanges";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

function focusFromPlan(plan: WorkoutPlan): string {
  const names = (plan.exercises ?? []).map((e) => e.name).filter(Boolean);
  if (names.length === 0) return "Full session";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names[1]} + more`;
}

function computeStreak(logDayKeys: Set<string>): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const todayKey = dayKeyFromMs(d.getTime());
  if (!logDayKeys.has(todayKey)) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = dayKeyFromMs(d.getTime());
    if (!logDayKeys.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function ScaleCard({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) => {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 28, bounciness: 4 }).start();
  };
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable onPress={onPress} onPressIn={() => animate(0.98)} onPressOut={() => animate(1)}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function AthleteWorkoutsTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { session } = useActiveWorkoutSession();
  const activePlanId = session?.workoutPlanId ?? null;
  const elapsedSeconds = useElapsedSeconds();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!user || user.role !== "athlete") return undefined;

      const showFullScreenLoad = !hasLoadedOnceRef.current;
      (async () => {
        if (showFullScreenLoad) setLoading(true);
        setError(null);
        try {
          const [activePlans, history] = await Promise.all([
            workoutService.getActiveWorkoutPlansForStudent(user.id),
            workoutService.getWorkoutHistory(user.id),
          ]);
          if (cancelled) return;
          setPlans(activePlans);
          setLogs(history);
          hasLoadedOnceRef.current = true;
        } catch (e: unknown) {
          if (!cancelled && showFullScreenLoad) {
            setError(e instanceof Error ? e.message : t("failedToLoad"));
          }
        } finally {
          if (!cancelled && showFullScreenLoad) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [user?.id, user?.role, t])
  );

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)),
    [plans]
  );

  const lastMsByPlanId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const log of logs) {
      const id = log.workoutPlanId;
      if (!id) continue;
      const ms = toMs(log.completedAt ?? log.date);
      if (!ms) continue;
      map[id] = Math.max(map[id] ?? 0, ms);
    }
    return map;
  }, [logs]);

  const logDayKeys = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      const ms = toMs(log.completedAt ?? log.date);
      if (ms) set.add(dayKeyFromMs(ms));
    }
    return set;
  }, [logs]);

  const sessionsThisWeek = useMemo(() => {
    const weekStart = startOfWeekMonday(new Date()).getTime();
    let n = 0;
    for (const log of logs) {
      const ms = toMs(log.completedAt ?? log.date);
      if (ms >= weekStart && ms < weekStart + WEEK_MS) n++;
    }
    return n;
  }, [logs]);

  const prsThisWeek = useMemo(() => {
    const weekStart = startOfWeekMonday(new Date()).getTime();
    let n = 0;
    for (const log of logs) {
      const ms = toMs(log.completedAt ?? log.date);
      if (ms < weekStart || ms >= weekStart + WEEK_MS) continue;
      for (const ex of log.exercises ?? []) { if (ex.isPr) n++; }
    }
    return n;
  }, [logs]);

  const sessionsThisMonth = useMemo(() => {
    let n = 0;
    for (const log of logs) {
      const ms = toMs(log.completedAt ?? log.date);
      if (isInCurrentMonth(ms)) n++;
    }
    return n;
  }, [logs]);

  const streak = useMemo(() => computeStreak(logDayKeys), [logDayKeys]);

  const recommendedPlan = useMemo(() => {
    if (sortedPlans.length === 0) return null;
    let best = sortedPlans[0];
    let bestLast = lastMsByPlanId[best.id] ?? 0;
    for (const p of sortedPlans) {
      const last = lastMsByPlanId[p.id] ?? 0;
      if (last < bestLast || (last === bestLast && (p.order ?? 999) < (best.order ?? 999))) {
        best = p;
        bestLast = last;
      }
    }
    return best;
  }, [sortedPlans, lastMsByPlanId]);

  const openExecution = useCallback(
    (plan: WorkoutPlan) => {
      if (session) {
        router.push({ pathname: "/athlete/workoutExecution" as any, params: { workoutPlanId: session.workoutPlanId } });
        return;
      }
      router.push({ pathname: "/athlete/workoutExecution" as any, params: { workoutPlanId: plan.id, workoutName: plan.name } });
    },
    [router, session]
  );

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
          <PrimaryButton title={t("goToLogin")} onPress={() => router.replace("/login")} />
        </View>
      </ScreenLayout>
    );
  }

  const showHub = sortedPlans.length > 0;

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.md,
            paddingBottom: session ? FLOATING_BAR_SCROLL_OFFSET + Spacing.xl : Spacing.xl * 2,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
            <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{t("nav_workouts")}</Text>
            <Pressable
              onPress={() => router.push("/athlete/workoutHistory" as any)}
              hitSlop={12}
              style={({ pressed }) => ({ padding: Spacing.sm, borderRadius: Radius.md, opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
            </Pressable>
          </View>

          {/* Active session banner */}
          {session ? (
            <Pressable
              onPress={() => router.push({ pathname: "/athlete/workoutExecution" as any, params: { workoutPlanId: session.workoutPlanId } })}
              style={({ pressed }) => ({
                backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md,
                flexDirection: "row", alignItems: "center", gap: Spacing.sm, opacity: pressed ? 0.9 : 1,
              })}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.onPrimary, opacity: 0.7 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.section, color: Colors.onPrimary, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
                  {t("workoutInProgress", { name: session.workoutName })}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.onPrimary, opacity: 0.8, marginTop: 2 }}>
                  {formatElapsedForTimer(elapsedSeconds)} · {t("tapToResume")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.onPrimary} />
            </Pressable>
          ) : null}

          {!showHub ? (
            <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: Spacing.md }}>
              <Ionicons name="barbell-outline" size={40} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
              <Text style={{ ...Typography.section, textAlign: "center", marginBottom: Spacing.xs }}>No plans yet</Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center", marginBottom: Spacing.md }}>
                Create your first plan and start training.
              </Text>
              <PrimaryButton title="Create Plan" onPress={() => router.push("/athlete/createPlan" as any)} />
            </View>
          ) : (
            <>
              {recommendedPlan ? (
                <ScaleCard
                  style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 2, borderColor: "#D4FF4444", marginBottom: Spacing.lg }}
                >
                  <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "800", marginBottom: 6 }}>{t("nextUp")}</Text>
                  <Text style={{ ...Typography.title, fontSize: FontSizes.h3, marginBottom: Spacing.xs }}>{recommendedPlan.name}</Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: Spacing.sm }}>{focusFromPlan(recommendedPlan)}</Text>
                  <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
                    {t("lastWhen", { when: formatRelativeDone(lastMsByPlanId[recommendedPlan.id] ?? 0, t, locale) })}
                  </Text>
                  <PrimaryButton
                    title={recommendedPlan.id === activePlanId ? t("inProgress") : t("startWorkout")}
                    variant={recommendedPlan.id === activePlanId ? "secondary" : "primary"}
                    onPress={() => openExecution(recommendedPlan)}
                  />
                </ScaleCard>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
                <Text style={{ ...Typography.section, color: Colors.textSecondary, fontWeight: "700" }}>My Plans</Text>
                <Pressable onPress={() => router.push("/athlete/createPlan" as any)} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                </Pressable>
              </View>

              <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
                {sortedPlans.map((plan) => {
                  const lastMs = lastMsByPlanId[plan.id] ?? 0;
                  const exCount = plan.exercises?.length ?? 0;
                  const doneThisWeek = isInCurrentWeek(lastMs);
                  const isNew = !lastMs;
                  const isActive = plan.id === activePlanId;
                  return (
                    <ScaleCard key={plan.id} style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.sm }}>
                          <Text style={{ ...Typography.section, fontSize: FontSizes.subheading, fontWeight: "800" }}>{plan.name}</Text>
                          {isActive ? (
                            <View style={{ backgroundColor: "rgba(212,255,68,0.18)", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: "rgba(212,255,68,0.45)" }}>
                              <Text style={{ ...Typography.micro, color: Colors.primary, fontWeight: "700" }}>{t("inProgress")}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                          {t(exCount === 1 ? "exerciseCount_one" : "exerciseCount_other", { count: exCount })} · {t("lastWhen", { when: formatRelativeDone(lastMs, t, locale) })}
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm }}>
                          {isNew ? (
                            <View style={{ backgroundColor: "#D4FF4422", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm }}>
                              <Text style={{ color: Colors.primary, fontSize: FontSizes.caption, fontWeight: "700" }}>{t("new")}</Text>
                            </View>
                          ) : null}
                          {doneThisWeek && !isNew ? (
                            <View style={{ backgroundColor: "#34C75922", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm }}>
                              <Text style={{ color: Colors.success, fontSize: FontSizes.caption, fontWeight: "700" }}>{t("doneThisWeek")}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton
                            title={isActive ? t("inProgress") : t("start")}
                            variant={isActive ? "secondary" : "primary"}
                            onPress={() => openExecution(plan)}
                          />
                        </View>
                      </View>
                    </ScaleCard>
                  );
                })}
              </View>

              <ScaleCard style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ ...Typography.section, fontWeight: "800", marginBottom: Spacing.sm }}>{t("progressSnapshot")}</Text>
                <View style={{ gap: Spacing.sm }}>
                  <Text style={Typography.secondary}>{t("sessionsThisMonth", { n: sessionsThisMonth })}</Text>
                  <Text style={Typography.secondary}>{t(streak === 1 ? "streak_one" : "streak_other", { count: streak })}</Text>
                  <Text style={Typography.secondary}>{t("prsThisWeek", { n: prsThisWeek })}</Text>
                  <Text style={Typography.secondary}>{t("thisWeekCompleted", { done: sessionsThisWeek, target: sortedPlans.length || 3 })}</Text>
                </View>
              </ScaleCard>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
