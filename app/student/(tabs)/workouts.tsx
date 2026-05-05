import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useActiveWorkout } from "../../../context/ActiveWorkoutContext";
import { workoutService } from "../../../services/workoutService";
import { trainingGroupService } from "../../../services/trainingGroupService";
import type { TrainingGroup } from "../../../types/TrainingGroup";
import type { WorkoutLog, WorkoutPlan } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { formatElapsedForTimer } from "../../../utils/workoutDuration";
import { FLOATING_BAR_SCROLL_OFFSET } from "../../../components/FloatingWorkoutBar";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  return 0;
}

function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function isInCurrentWeek(ms: number): boolean {
  if (!ms) return false;
  const start = startOfWeekMonday(new Date()).getTime();
  return ms >= start && ms < start + WEEK_MS;
}

function isInCurrentMonth(ms: number): boolean {
  if (!ms) return false;
  const now = new Date();
  const d = new Date(ms);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function formatRelativeDone(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days < 0) return "Recently";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function focusFromPlan(plan: WorkoutPlan): string {
  const names = (plan.exercises ?? []).map((e) => e.name).filter(Boolean);
  if (names.length === 0) return "Full session";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names[1]} + more`;
}

/** Consecutive calendar days with a session, ending today or (if idle today) yesterday. */
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

function ScaleCard({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
  };

  if (!onPress) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Pressable onPress={onPress} onPressIn={() => animate(0.98)} onPressOut={() => animate(1)}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function StudentWorkouts() {
  const router = useRouter();
  const { user } = useAuth();
  const activeWorkout = useActiveWorkout();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [activeGroup, setActiveGroup] = useState<TrainingGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** After the first successful paint, refocus only soft-refreshes (no full-screen spinner). */
  const hasLoadedOnceRef = useRef(false);

  const fetchHubData = useCallback(async (studentId: string) => {
    const [activePlans, history] = await Promise.all([
      workoutService.getActiveWorkoutPlansForStudent(studentId),
      workoutService.getWorkoutHistory(studentId),
    ]);
    const coachId = activePlans[0]?.coachId?.trim();
    const group =
      coachId && studentId
        ? await trainingGroupService.getLatestTrainingGroupForStudent(coachId, studentId)
        : null;
    return { activePlans, history, group };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (!user || user.role !== "student") {
        setError("You must be logged in as a student.");
        setLoading(false);
        return undefined;
      }

      const showFullScreenLoad = !hasLoadedOnceRef.current;

      (async () => {
        if (showFullScreenLoad) setLoading(true);
        setError(null);
        try {
          const { activePlans, history, group } = await fetchHubData(user.id);
          if (cancelled) return;
          setPlans(activePlans);
          setLogs(history);
          setActiveGroup(group);
          hasLoadedOnceRef.current = true;
        } catch (e: unknown) {
          if (!cancelled && showFullScreenLoad) {
            setError(e instanceof Error ? e.message : "Failed to load workouts.");
          }
        } finally {
          if (!cancelled && showFullScreenLoad) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.role, fetchHubData])
  );

  // New account / relogin: show spinner again on first focus for that user.
  useEffect(() => {
    hasLoadedOnceRef.current = false;
  }, [user?.id]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    );
  }, [plans]);

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

  const wpwTarget = useMemo(() => {
    const g = activeGroup?.workoutsPerWeek;
    if (typeof g === "number" && g > 0) return Math.min(14, g);
    const n = sortedPlans.length;
    return n > 0 ? Math.min(7, n) : 4;
  }, [activeGroup?.workoutsPerWeek, sortedPlans.length]);

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
      for (const ex of log.exercises ?? []) {
        if (ex.isPr) n++;
      }
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

  const groupMeta = useMemo(() => {
    const name = activeGroup?.name?.trim() || sortedPlans[0]?.groupName?.trim() || "";
    const created = activeGroup?.createdAt;
    const startMs = toMs(created);
    const weekNum =
      startMs > 0 ? Math.max(1, Math.min(52, Math.floor((Date.now() - startMs) / WEEK_MS) + 1)) : null;
    const wpw =
      activeGroup && activeGroup.workoutsPerWeek > 0
        ? activeGroup.workoutsPerWeek
        : wpwTarget;
    return { name, weekNum, wpw, description: activeGroup?.type ? String(activeGroup.type) : "" };
  }, [activeGroup, sortedPlans, wpwTarget]);

  const openExecution = useCallback(
    (plan: WorkoutPlan) => {
      // If another session is already active, redirect to it instead of starting a new one.
      if (activeWorkout.session) {
        router.push({
          pathname: "/student/workoutExecution",
          params: { workoutPlanId: activeWorkout.session.workoutPlanId },
        });
        return;
      }
      router.push({
        pathname: "/student/workoutExecution",
        params: {
          workoutPlanId: plan.id,
          groupId: plan.groupId ?? activeGroup?.id ?? "",
          workoutName: plan.name,
        },
      });
    },
    [router, activeGroup?.id, activeWorkout.session]
  );

  const openDetail = useCallback(
    (planId: string) => {
      router.push({ pathname: "/student/workoutPlanDetail", params: { workoutPlanId: planId } });
    },
    [router]
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
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: Spacing.md,
            backgroundColor: Colors.bg,
          }}
        >
          <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
          <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
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
            // Extra bottom padding when floating bar is visible so content isn't hidden under it.
            paddingBottom: activeWorkout.session ? FLOATING_BAR_SCROLL_OFFSET + Spacing.xl : Spacing.xl * 2,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.md,
            }}
          >
            <Text style={{ ...Typography.title, fontSize: 22 }}>Workouts</Text>
            <Pressable
              onPress={() => router.push("/student/workoutHistory")}
              hitSlop={12}
              style={({ pressed }) => ({
                padding: Spacing.sm,
                borderRadius: Radius.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
            </Pressable>
          </View>

          {/* ── Active session resume banner ── */}
          {activeWorkout.session ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/student/workoutExecution",
                  params: { workoutPlanId: activeWorkout.session!.workoutPlanId },
                })
              }
              style={({ pressed }) => ({
                backgroundColor: Colors.primary,
                borderRadius: Radius.lg,
                padding: Spacing.md,
                marginBottom: Spacing.md,
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: Colors.onPrimary,
                  opacity: 0.7,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...Typography.section,
                    color: Colors.onPrimary,
                    fontWeight: "800",
                    fontSize: 14,
                  }}
                  numberOfLines={1}
                >
                  Workout in progress · {activeWorkout.session.workoutName}
                </Text>
                <Text
                  style={{
                    ...Typography.secondary,
                    color: Colors.onPrimary,
                    opacity: 0.8,
                    marginTop: 2,
                  }}
                >
                  {formatElapsedForTimer(activeWorkout.elapsedSeconds)} · Tap to resume
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.onPrimary} />
            </Pressable>
          ) : null}

          {!showHub ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
              }}
            >
              <Ionicons name="barbell-outline" size={40} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
              <Text style={{ ...Typography.section, textAlign: "center", marginBottom: Spacing.xs }}>
                No workouts assigned yet
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                Your coach will assign your training split soon
              </Text>
            </View>
          ) : (
            <>
              <ScaleCard
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: Spacing.lg,
                }}
              >
                <Text style={{ ...Typography.secondary, color: Colors.primary, marginBottom: 4, fontWeight: "700" }}>
                  Active split
                </Text>
                <Text style={{ ...Typography.title, fontSize: 20, marginBottom: Spacing.xs }}>
                  {groupMeta.name || "Your program"}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.xs }}>
                  {groupMeta.weekNum != null ? `Week ${groupMeta.weekNum}` : "Program"}
                  {" • "}
                  {groupMeta.wpw} workouts/week
                </Text>
                {groupMeta.description ? (
                  <Text style={{ ...Typography.secondary, color: Colors.textSecondary }}>{groupMeta.description}</Text>
                ) : null}
              </ScaleCard>

              {recommendedPlan ? (
                <ScaleCard
                  style={{
                    backgroundColor: Colors.surface,
                    borderRadius: Radius.lg,
                    padding: Spacing.lg,
                    borderWidth: 2,
                    borderColor: "#D4FF4444",
                    marginBottom: Spacing.lg,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: Spacing.sm }}>
                      <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "800", marginBottom: 6 }}>
                        Next up
                      </Text>
                      <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.xs }}>
                        {recommendedPlan.name}
                      </Text>
                      <Text style={{ ...Typography.secondary, color: Colors.textSecondary, marginBottom: Spacing.sm }}>
                        {focusFromPlan(recommendedPlan)}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.md }}>
                        <Text style={Typography.secondary}>
                          Last: {formatRelativeDone(lastMsByPlanId[recommendedPlan.id] ?? 0)}
                        </Text>
                        {recommendedPlan.estimatedDurationMinutes != null &&
                        recommendedPlan.estimatedDurationMinutes > 0 ? (
                          <Text style={Typography.secondary}>
                            ~{recommendedPlan.estimatedDurationMinutes} min
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <View style={{ marginTop: Spacing.md }} pointerEvents="box-none">
                    <PrimaryButton title="Start Workout" onPress={() => openExecution(recommendedPlan)} />
                  </View>
                </ScaleCard>
              ) : null}

              <Text
                style={{
                  ...Typography.section,
                  color: Colors.textSecondary,
                  marginBottom: Spacing.sm,
                  fontWeight: "700",
                }}
              >
                Workout library
              </Text>
              <View style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
                {sortedPlans.map((plan) => {
                  const lastMs = lastMsByPlanId[plan.id] ?? 0;
                  const exCount = plan.exercises?.length ?? 0;
                  const doneThisWeek = isInCurrentWeek(lastMs);
                  const isNew = !lastMs;
                  return (
                    <ScaleCard
                      key={plan.id}
                      style={{
                        backgroundColor: Colors.card,
                        borderRadius: Radius.lg,
                        padding: Spacing.md,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flex: 1, marginRight: Spacing.sm }}>
                          <Text style={{ ...Typography.section, fontSize: 18, fontWeight: "800" }}>{plan.name}</Text>
                          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                            {exCount} exercise{exCount === 1 ? "" : "s"} · Last: {formatRelativeDone(lastMs)}
                          </Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm }}>
                            {isNew ? (
                              <View
                                style={{
                                  backgroundColor: "#D4FF4422",
                                  paddingHorizontal: Spacing.sm,
                                  paddingVertical: 4,
                                  borderRadius: Radius.sm,
                                }}
                              >
                                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: "700" }}>New</Text>
                              </View>
                            ) : null}
                            {doneThisWeek && !isNew ? (
                              <View
                                style={{
                                  backgroundColor: "#34C75922",
                                  paddingHorizontal: Spacing.sm,
                                  paddingVertical: 4,
                                  borderRadius: Radius.sm,
                                }}
                              >
                                <Text style={{ color: Colors.success, fontSize: 12, fontWeight: "700" }}>
                                  Done this week
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                        <View style={{ flex: 1 }}>
                          <PrimaryButton title="Start" onPress={() => openExecution(plan)} />
                        </View>
                        <Pressable
                          onPress={() => openDetail(plan.id)}
                          style={({ pressed }) => ({
                            flex: 1,
                            borderRadius: Radius.lg,
                            paddingVertical: 15,
                            paddingHorizontal: Spacing.md,
                            borderWidth: 1,
                            borderColor: Colors.primary,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text style={{ ...Typography.section, color: Colors.primary, fontWeight: "700" }}>Details</Text>
                        </Pressable>
                      </View>
                    </ScaleCard>
                  );
                })}
              </View>

              <ScaleCard
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ ...Typography.section, marginBottom: Spacing.sm, fontWeight: "800" }}>Progress snapshot</Text>
                <View style={{ gap: Spacing.sm }}>
                  <Text style={Typography.secondary}>
                    This week: {Math.min(sessionsThisWeek, wpwTarget)} / {wpwTarget} completed
                  </Text>
                  <Text style={Typography.secondary}>
                    Streak: {streak} day{streak === 1 ? "" : "s"}
                  </Text>
                  <Text style={Typography.secondary}>Sessions this month: {sessionsThisMonth}</Text>
                  <Text style={Typography.secondary}>PRs this week: {prsThisWeek}</Text>
                </View>
              </ScaleCard>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
