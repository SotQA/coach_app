import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert, FlatList, ScrollView, Pressable } from "react-native";
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
import type { TrainingGroup } from "../../types/TrainingGroup";

export default function StudentDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [latestGroup, setLatestGroup] = useState<TrainingGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const sortedPlans = useMemo(() => {
    const getOrder = (p: WorkoutPlan) =>
      typeof p.order === "number" && Number.isFinite(p.order) ? p.order : Number.MAX_SAFE_INTEGER;

    return plans
      .filter((p) => p.isActive !== false)
      .slice()
      .sort((a, b) => getOrder(a) - getOrder(b));
  }, [plans]);

  useEffect(() => {
    const load = async () => {
      console.log("[coach/studentDetails] load start", { studentId });
      setLoading(true);
      try {
        setError(null);

        if (!studentId) {
          setError("Missing studentId.");
          return;
        }

        console.log("[coach/studentDetails] currentUser", user);
        if (!userId || userRole !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }

        const studentDoc = await studentService.getStudentById(studentId);
        console.log("[coach/studentDetails] fetched student", studentDoc?.id);
        if (!studentDoc) {
          setError("Student not found.");
          return;
        }

        // Basic ownership check (UI-level). Security should be enforced via Firestore rules too.
        if (studentDoc.coachId !== userId) {
          setError("You don't have access to this student.");
          return;
        }

        setStudent(studentDoc);

        // Load the rest in parallel for performance.
        const [g, workoutPlans, history] = await Promise.all([
          trainingGroupService.getLatestTrainingGroupForStudent(userId, studentId).catch(() => null),
          workoutService.getWorkoutPlansForStudentAsCoach(userId, studentId),
          workoutService.getWorkoutHistory(studentId),
        ]);
        setLatestGroup(g);
        console.log("[coach/studentDetails] fetched plans", workoutPlans.length);
        setPlans(workoutPlans);
        console.log("[coach/studentDetails] fetched logs", history.length);
        setLogs(history);
      } catch (e: any) {
        console.error("[coach/studentDetails] load error", e);
        setError(e.message ?? "Failed to load student details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId, userId, userRole]);

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

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
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

  const studentFullName = [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
  const displayName = studentFullName || "Student";
  const initials =
    `${student.firstName?.trim()?.[0] ?? ""}${student.lastName?.trim()?.[0] ?? ""}`.toUpperCase() || "S";

  const toMs = (value: any): number => {
    if (!value) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === "function") {
      try {
        const d = value.toDate();
        return d instanceof Date ? d.getTime() : 0;
      } catch {
        return 0;
      }
    }
    return 0;
  };

  const lastWorkoutMs = logs[0] ? toMs((logs[0] as any).completedAt ?? (logs[0] as any).date) : 0;
  const lastWorkoutLabel =
    lastWorkoutMs > 0
      ? new Date(lastWorkoutMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : null;

  const workoutsCompleted = logs.length;
  const avgDurationSeconds = (() => {
    const items = logs
      .map((l) => (typeof l.durationSeconds === "number" && Number.isFinite(l.durationSeconds) ? l.durationSeconds : null))
      .filter((n): n is number => n !== null && n > 0)
      .slice(0, 10);
    if (items.length === 0) return null;
    return Math.floor(items.reduce((a, b) => a + b, 0) / items.length);
  })();
  const avgDurationLabel = avgDurationSeconds != null ? formatDurationForHistory(avgDurationSeconds) : null;

  const compliancePercent = (() => {
    const wpw = latestGroup?.workoutsPerWeek ?? 0;
    if (!wpw || wpw <= 0) return null;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const count7 = logs.filter((l) => {
      const ms = toMs((l as any).completedAt ?? (l as any).date);
      return ms >= weekAgo && ms <= now;
    }).length;
    return Math.max(0, Math.min(100, Math.round((count7 / wpw) * 100)));
  })();

  const currentStreakDays = (() => {
    if (logs.length === 0) return 0;
    const dayKey = (ms: number) => {
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    const days = new Set<string>();
    for (const l of logs) {
      const ms = toMs((l as any).completedAt ?? (l as any).date);
      if (ms > 0) days.add(dayKey(ms));
    }
    const today = new Date();
    const keyFor = (d: Date) => dayKey(d.getTime());
    const hasToday = days.has(keyFor(today));
    const start = new Date(today);
    if (!hasToday) start.setDate(start.getDate() - 1);
    if (!days.has(keyFor(start))) return 0;
    let streak = 0;
    const cursor = new Date(start);
    while (days.has(keyFor(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  })();

  const StatCard = ({
    label,
    value,
    icon,
    tint,
  }: {
    label: string;
    value: string;
    icon: any;
    tint?: string;
  }) => (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{label}</Text>
        <Ionicons name={icon} size={18} color={tint ?? Colors.textMuted} />
      </View>
      <Text style={{ ...Typography.title, fontSize: 22, marginTop: 6 }}>{value}</Text>
    </View>
  );

  const RowAction = ({
    icon,
    label,
    tone,
    onPress,
    disabled,
  }: {
    icon: any;
    label: string;
    tone?: "neutral" | "danger";
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: tone === "danger" ? "rgba(220,38,38,0.35)" : Colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={tone === "danger" ? "#FCA5A5" : Colors.text} />
    </Pressable>
  );

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
          fontSize: 13,
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
                borderRadius: 20,
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
                <Text style={{ ...Typography.section, fontSize: 22, fontWeight: "900" }}>{initials}</Text>
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
                      borderRadius: Radius.pill,
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
                      borderRadius: Radius.pill,
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
                      borderRadius: Radius.pill,
                      backgroundColor: Colors.surface,
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>
                      {lastWorkoutLabel ? `Last workout: ${lastWorkoutLabel}` : "Last workout: —"}
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
                  pathname: "/coach/viewProgress",
                  params: { studentId },
                })
              }
            />
          </View>

          {/* Quick stats */}
          <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Quick stats</Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
            <StatCard label="Workouts completed" value={String(workoutsCompleted)} icon="barbell-outline" tint={Colors.primary} />
            <StatCard
              label="Compliance"
              value={compliancePercent != null ? `${compliancePercent}%` : "—"}
              icon="checkmark-done-outline"
            />
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <StatCard label="Current streak" value={currentStreakDays ? `${currentStreakDays}d` : "—"} icon="flame-outline" />
            <StatCard label="Avg duration" value={avgDurationLabel ?? "—"} icon="time-outline" />
          </View>

          {/* Active training group card */}
          <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Active training group</Text>
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
            {latestGroup ? (
              <>
                <Text style={{ ...Typography.title, fontSize: 18 }}>{latestGroup.name}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  Type: {String(latestGroup.type || "Custom")}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                  Workouts/week: {latestGroup.workoutsPerWeek || "—"}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                  Week info: —
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                  Dates: —
                </Text>
                <PrimaryButton
                  title="Manage Split"
                  onPress={() =>
                    router.push({
                      pathname: "/coach/selectTrainingGroup",
                      params: { studentId, studentName: displayName, selectedGroupId: latestGroup.id },
                    })
                  }
                  style={{ backgroundColor: Colors.border, marginTop: Spacing.md }}
                />
              </>
            ) : (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>No active training split</Text>
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
          </View>

          {/* Assigned workouts */}
          <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>Assigned workouts</Text>

          {sortedPlans.length === 0 ? (
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
                No workouts assigned yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={sortedPlans}
              scrollEnabled={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const lastCompleted = logs.find((l) => l.workoutPlanId === item.id);
                const lastCompletedMs = lastCompleted ? toMs((lastCompleted as any).completedAt ?? (lastCompleted as any).date) : 0;
                const lastCompletedLabel =
                  lastCompletedMs > 0
                    ? new Date(lastCompletedMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : null;
                return (
                  <View
                    style={{
                      backgroundColor: Colors.card,
                      borderRadius: Radius.lg,
                      padding: Spacing.md,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      marginBottom: Spacing.sm,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.sm }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ ...Typography.section, fontSize: 16 }}>{item.name}</Text>
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                          {item.note?.trim()
                            ? item.note.trim()
                            : item.groupName?.trim()
                              ? `Split: ${item.groupName.trim()}`
                              : "Legacy plan"}
                        </Text>
                        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                          {lastCompletedLabel ? `Last completed: ${lastCompletedLabel}` : "Last completed: —"}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <RowAction
                          icon="open-outline"
                          label="Open workout"
                          onPress={() =>
                            router.push({
                              pathname: "/coach/workout",
                              params: { workoutPlanId: item.id },
                            })
                          }
                        />
                        <RowAction
                          icon="create-outline"
                          label="Edit workout"
                          onPress={() =>
                            router.push({
                              pathname: "/coach/editWorkout",
                              params: { workoutPlanId: item.id },
                            })
                          }
                        />
                        <RowAction
                          icon="trash-outline"
                          label="Delete workout"
                          tone="danger"
                          disabled={deletingPlanId !== null}
                          onPress={() => {
                            Alert.alert(
                              "Delete workout?",
                              "This will remove the workout from the student’s active list. You can’t undo this in the app.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: async () => {
                                    try {
                                      setDeletingPlanId(item.id);
                                      if (!user || user.role !== "coach") {
                                        throw new Error("You must be logged in as a coach.");
                                      }
                                      await workoutService.deactivateWorkoutPlan(item.id, user.id);
                                      setPlans((prev) =>
                                        prev.map((p) => (p.id === item.id ? { ...p, isActive: false } : p))
                                      );
                                    } catch (e: any) {
                                      Alert.alert("Failed to delete", e.message ?? "Unknown error");
                                    } finally {
                                      setDeletingPlanId(null);
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                        />
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

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
              {compliancePercent != null
                ? `This week: ${compliancePercent}% of target (${latestGroup?.workoutsPerWeek ?? "—"} workouts/week).`
                : "Set a workouts/week target to track compliance."}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>
              {currentStreakDays
                ? `Current streak: ${currentStreakDays} day${currentStreakDays === 1 ? "" : "s"}.`
                : "No active streak yet."}
            </Text>
          </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

