import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

export default function AssignedWorkouts() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
    groupId?: string;
    groupName?: string;
  }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const groupId = useMemo(() => String(params.groupId ?? "").trim(), [params.groupId]);
  const studentName = useMemo(() => String(params.studentName ?? "Student"), [params.studentName]);
  const groupName = useMemo(() => String(params.groupName ?? "Assigned workouts"), [params.groupName]);

  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || user.role !== "coach") throw new Error("You must be logged in as a coach.");
        if (!studentId) throw new Error("Missing studentId.");

        const [workoutPlans, history] = await Promise.all([
          workoutService.getWorkoutPlansForStudentAsCoach(user.id, studentId),
          workoutService.getWorkoutHistory(studentId),
        ]);
        setPlans(workoutPlans);
        setLogs(history);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load assigned workouts.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.role, studentId]);

  const allActiveSorted = useMemo(
    () =>
      plans
        .filter((p) => p.isActive !== false)
        .slice()
        .sort((a, b) => {
          const ao = typeof a.order === "number" && Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
          const bo = typeof b.order === "number" && Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
          return ao - bo;
        }),
    [plans]
  );

  const assignedInGroup = useMemo(() => {
    if (!groupId) return [];
    return allActiveSorted.filter((p) => String(p.groupId ?? "").trim() === groupId);
  }, [allActiveSorted, groupId]);

  // Backward compatibility: if legacy plans exist without groupId, still show them.
  const assigned = assignedInGroup.length > 0 ? assignedInGroup : allActiveSorted;
  const usingFallbackAll = Boolean(groupId) && assignedInGroup.length === 0 && allActiveSorted.length > 0;

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}
      >
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={{ ...Typography.title, fontSize: 24 }}>{groupName}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
            For: {studentName}
          </Text>
          {usingFallbackAll ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
              No workouts were linked to this split yet — showing all assigned workouts.
            </Text>
          ) : null}
        </View>

        {error ? (
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
            <Text style={{ ...Typography.secondary, color: Colors.danger }}>{error}</Text>
          </View>
        ) : assigned.length === 0 ? (
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>No workouts assigned yet</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.sm }}>
            {assigned.map((item) => {
              const lastCompleted = logs.find((l) => l.workoutPlanId === item.id);
              const lastCompletedMs = lastCompleted ? toMs((lastCompleted as any).completedAt ?? (lastCompleted as any).date) : 0;
              const lastCompletedLabel =
                lastCompletedMs > 0
                  ? new Date(lastCompletedMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : null;

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: Colors.card,
                    borderRadius: Radius.lg,
                    padding: Spacing.md,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ ...Typography.section, fontSize: 16 }}>{item.name}</Text>
                      <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                        {item.note?.trim() ? item.note.trim() : "—"}
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
                                    if (!user || user.role !== "coach") throw new Error("You must be logged in as a coach.");
                                    setDeletingPlanId(item.id);
                                    await workoutService.deactivateWorkoutPlan(item.id, user.id);
                                    setPlans((prev) => prev.map((p) => (p.id === item.id ? { ...p, isActive: false } : p)));
                                  } catch (e: any) {
                                    Alert.alert("Failed to delete", e?.message ?? "Unknown error");
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
            })}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

