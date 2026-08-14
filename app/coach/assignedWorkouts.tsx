import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { toMs } from "../../utils/dateConvert";

function formatEditedAgo(ms: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!ms) return "";
  const diffMs = Date.now() - ms;
  if (diffMs < 0) return t("editedAgoJustNow");
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("editedAgoJustNow");
  if (minutes < 60) return t("editedAgoMinutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("editedAgoHours", { n: hours });
  const days = Math.floor(hours / 24);
  return t("editedAgoDays", { n: days });
}

export default function AssignedWorkouts() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
    groupId?: string;
    groupName?: string;
  }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params.studentId]);
  const groupId = useMemo(() => String(params.groupId ?? "").trim(), [params.groupId]);
  const studentName = useMemo(() => String(params.studentName ?? t("roleStudent")), [params.studentName, t]);
  const groupName = useMemo(() => String(params.groupName ?? t("assignedWorkoutsFallbackTitle")), [params.groupName, t]);

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
        if (!user || user.role !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
        if (!studentId) throw new Error(t("missingStudentIdError"));

        const [workoutPlans, history] = await Promise.all([
          workoutService.getWorkoutPlansForStudentAsCoach(user.id, studentId),
          workoutService.getWorkoutHistory(studentId),
        ]);
        setPlans(workoutPlans);
        setLogs(history);
      } catch (e: any) {
        setError(e?.message ?? t("failedToLoadAssignedWorkoutsError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.role, studentId, t]);

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
            {t("forStudentLabel", { name: studentName })}
          </Text>
          {usingFallbackAll ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
              {t("fallbackAllWorkoutsNote")}
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
            <Text style={{ ...Typography.secondary, color: Colors.textMuted }}>{t("noWorkoutsAssigned")}</Text>
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
              const editedLabel = updatedMs > 0 && updatedMs - createdMs > 60000 ? formatEditedAgo(updatedMs, t) : null;

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
                          ? t("editedLabelPrefix", { when: editedLabel })
                          : lastCompletedLabel
                            ? t("lastCompletedLabel", { date: lastCompletedLabel })
                            : t("lastCompletedEmpty")}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <RowAction
                        icon="open-outline"
                        label={t("openWorkoutA11y")}
                        onPress={() =>
                          router.push({
                            pathname: "/coach/workout",
                            params: { workoutPlanId: item.id },
                          })
                        }
                      />
                      <RowAction
                        icon="create-outline"
                        label={t("editWorkoutA11y")}
                        onPress={() =>
                          router.push({
                            pathname: "/coach/editWorkout",
                            params: { workoutPlanId: item.id },
                          })
                        }
                      />
                      <RowAction
                        icon="trash-outline"
                        label={t("removeWorkoutA11y")}
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
              {t("removePlanConfirmTitle", { name: removeTarget?.name ?? "" })}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
              {t("removePlanConfirmBody", { name: studentName })}
            </Text>

            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>{t("noteForStudentLabel", { name: studentName })}</Text>
            <TextInput
              value={removeNote}
              onChangeText={(text) => setRemoveNote(text.slice(0, 500))}
              placeholder={t("removeNotePlaceholder")}
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
                <PrimaryButton title={t("cancel")} variant="secondary" onPress={() => setRemoveTarget(null)} style={{ flex: 1, width: "auto" }} />
                <PrimaryButton
                  title={t("removeAction")}
                  onPress={async () => {
                    if (!removeTarget) return;
                    try {
                      if (!user || user.role !== "coach") throw new Error(t("mustBeLoggedInAsCoachError"));
                      setDeletingPlanId(removeTarget.id);
                      await workoutService.deactivateWorkoutPlan(removeTarget.id, user.id, removeNote.trim() || undefined);
                      setPlans((prev) => prev.map((p) => (p.id === removeTarget.id ? { ...p, isActive: false } : p)));
                      setRemoveTarget(null);
                    } catch (e: any) {
                      Alert.alert(t("failedToRemoveTitle"), e?.message ?? t("unknownErrorFallback"));
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

