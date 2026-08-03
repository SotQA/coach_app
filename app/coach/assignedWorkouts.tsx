import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { toMs } from "../../utils/dateConvert";

/** Coach-facing relative time (coach screens are plain English today, unlike the student i18n strings). */
function formatEditedAgo(ms: number): string {
  if (!ms) return "";
  const diffMs = Date.now() - ms;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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
  const [removeTarget, setRemoveTarget] = useState<WorkoutPlan | null>(null);
  const [removeNote, setRemoveNote] = useState("");

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
        borderColor: tone === "danger" ? Colors.dangerTint : Colors.border,
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

              // A plan edited after its own creation gets an "Edited …" line instead of
              // "Last completed" — lets a coach see at a glance that a change is pending
              // delivery to the student. The 60s guard skips the create-then-immediately-
              // read-back timestamp pair some writes produce.
              const createdMs = toMs(item.createdAt);
              const updatedMs = toMs(item.updatedAt);
              const editedLabel = updatedMs > 0 && updatedMs - createdMs > 60000 ? formatEditedAgo(updatedMs) : null;

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
                      <Text style={{ ...Typography.secondary, color: editedLabel ? Colors.primary : Colors.textMuted, marginTop: 4, fontWeight: editedLabel ? "700" : "400" }}>
                        {editedLabel
                          ? `Edited ${editedLabel}`
                          : lastCompletedLabel
                            ? `Last completed: ${lastCompletedLabel}`
                            : "Last completed: —"}
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
                        label="Remove workout"
                        tone="danger"
                        disabled={deletingPlanId !== null}
                        onPress={() => {
                          setRemoveNote("");
                          setRemoveTarget(item);
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

      <Modal visible={removeTarget !== null} transparent animationType="fade" onRequestClose={() => setRemoveTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setRemoveTarget(null)}
          />
          <View
            style={{
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              borderBottomWidth: 0,
              borderTopLeftRadius: Radius.xl,
              borderTopRightRadius: Radius.xl,
              padding: Spacing.md,
              paddingBottom: Spacing.lg,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: Spacing.md }} />
            <Text style={{ ...Typography.title, fontSize: 18, marginBottom: 6 }}>
              Remove &ldquo;{removeTarget?.name}&rdquo;?
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
              {studentName} will be notified immediately. This plan can&rsquo;t be recovered once removed.
            </Text>

            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Note for {studentName} (optional)</Text>
            <TextInput
              value={removeNote}
              onChangeText={(t) => setRemoveNote(t.slice(0, 500))}
              placeholder="Why this plan is going away…"
              placeholderTextColor={Colors.textMuted}
              multiline
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.sm,
                marginBottom: Spacing.md,
                color: Colors.text,
                backgroundColor: Colors.surface,
                minHeight: 64,
              }}
            />

            {deletingPlanId ? (
              <ActivityIndicator />
            ) : (
              <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                <PrimaryButton title="Cancel" variant="secondary" onPress={() => setRemoveTarget(null)} style={{ flex: 1, width: "auto" }} />
                <PrimaryButton
                  title="Remove"
                  onPress={async () => {
                    if (!removeTarget) return;
                    try {
                      if (!user || user.role !== "coach") throw new Error("You must be logged in as a coach.");
                      setDeletingPlanId(removeTarget.id);
                      await workoutService.deactivateWorkoutPlan(removeTarget.id, user.id, removeNote.trim() || undefined);
                      setPlans((prev) => prev.map((p) => (p.id === removeTarget.id ? { ...p, isActive: false } : p)));
                      setRemoveTarget(null);
                    } catch (e: any) {
                      Alert.alert("Failed to remove", e?.message ?? "Unknown error");
                    } finally {
                      setDeletingPlanId(null);
                    }
                  }}
                  style={{ flex: 1, width: "auto", backgroundColor: Colors.danger }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

