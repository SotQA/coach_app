import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert, FlatList, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { studentService } from "../../services/studentService";
import { trainingGroupService } from "../../services/trainingGroupService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutPlan, WorkoutLog, WorkoutLogExercise } from "../../types/Workout";
import { getSessionMaxWeightFromLogExercise } from "../../utils/workoutMetrics";
import { formatDurationForHistory } from "../../utils/workoutDuration";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

export default function StudentDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [latestGroupName, setLatestGroupName] = useState<string | null>(null);
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
        if (!user || user.role !== "coach") {
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
        if (studentDoc.coachId !== user.id) {
          setError("You don't have access to this student.");
          return;
        }

        setStudent(studentDoc);

        // Latest training group for header display.
        try {
          const g = await trainingGroupService.getLatestTrainingGroupForStudent(user.id, studentId);
          setLatestGroupName(g?.name?.trim() ? g.name.trim() : null);
        } catch {
          setLatestGroupName(null);
        }

        const workoutPlans = await workoutService.getWorkoutPlansForStudentAsCoach(
          user.id,
          studentId
        );
        console.log("[coach/studentDetails] fetched plans", workoutPlans.length);
        setPlans(workoutPlans);

        const history = await workoutService.getWorkoutHistory(studentId);
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
  }, [studentId, user?.id, user?.role]);

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

  const strongestByExercise = (() => {
    const best = new Map<string, number>();
    for (const log of logs) {
      for (const ex of log.exercises ?? []) {
        const w = getSessionMaxWeightFromLogExercise(ex as WorkoutLogExercise);
        if (w == null) continue;
        const key = (ex.name ?? "").trim();
        if (!key) continue;
        const current = best.get(key);
        if (current === undefined || w > current) {
          best.set(key, w);
        }
      }
    }
    return Array.from(best.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    );
  })();

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg, paddingTop: Spacing.lg }}>
          {/* Top bar (screenshot-style). */}
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

            <Text style={{ ...Typography.section, fontWeight: "900" }}>Student Profile</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More"
              onPress={() => {}}
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
              <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Profile hero (no Injuries/Notes, no Quick Actions). */}
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
                <Text style={{ ...Typography.title, fontSize: 22 }}>{displayName}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  {latestGroupName ? latestGroupName : "No training split assigned"}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  {student.email}
                </Text>
              </View>
            </View>
          </View>

        <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>
          Workout Plans
        </Text>

        {sortedPlans.length === 0 ? (
          <Text style={Typography.secondary}>No workout plans yet.</Text>
        ) : (
          <FlatList
            data={sortedPlans}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ marginBottom: Spacing.sm }}>
                <WorkoutCard plan={item} />
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Open"
                      onPress={() =>
                        router.push({
                          pathname: "/coach/workout",
                          params: { workoutPlanId: item.id },
                        })
                      }
                      style={{ backgroundColor: Colors.border }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title="Edit"
                      onPress={() =>
                        router.push({
                          pathname: "/coach/editWorkout",
                          params: { workoutPlanId: item.id },
                        })
                      }
                      style={{ backgroundColor: Colors.border }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      title={deletingPlanId === item.id ? "Deleting..." : "Delete"}
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
                                    prev.map((p) =>
                                      p.id === item.id ? { ...p, isActive: false } : p
                                    )
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
                      disabled={deletingPlanId !== null}
                      style={{ backgroundColor: "#7F1D1D" }}
                    />
                  </View>
                </View>
              </View>
            )}
          />
        )}

        <Text
          style={{
            ...Typography.section,
            marginTop: Spacing.lg,
            marginBottom: Spacing.xs,
          }}
        >
          Recent Workouts
        </Text>
        {logs.length === 0 ? (
          <Text style={Typography.secondary}>No workouts logged yet.</Text>
        ) : (
          logs.slice(0, 5).map((log) => {
            const durationLabel = formatDurationForHistory(log.durationSeconds);
            return (
            <View
              key={log.id}
              style={{
                borderRadius: Radius.md,
                padding: Spacing.sm,
                marginBottom: Spacing.sm,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.section}>{log.workoutName || "Workout"}</Text>
              {durationLabel ? (
                <Text style={{ ...Typography.secondary, fontSize: 12 }}>
                  Duration: {durationLabel}
                </Text>
              ) : null}
              {typeof log.totalVolume === "number" && log.totalVolume > 0 ? (
                <Text style={{ ...Typography.secondary, fontSize: 12 }}>
                  Volume: {log.totalVolume} kg
                </Text>
              ) : null}
              {(log.exercises ?? []).slice(0, 2).map((ex, i) => {
                const s0 = ex.sets?.[0];
                const w0 =
                  s0 && s0.weight != null && Number.isFinite(s0.weight) ? `${s0.weight}kg` : s0 ? "BW" : "";
                const tail = s0 ? ` · Set 1: ${w0} × ${s0.reps}` : "";
                return (
                  <Text key={`${log.id}-${i}`} style={Typography.secondary}>
                    {ex.name}
                    {ex.isPr ? " 🔥" : ""}
                    {tail}
                  </Text>
                );
              })}
              <PrimaryButton
                title={log.coachFeedback ? "Edit feedback" : "Add feedback"}
                onPress={() =>
                  router.push({
                    pathname: "/coach/workoutLogFeedback",
                    params: { logId: log.id },
                  })
                }
                style={{ backgroundColor: Colors.border, marginTop: Spacing.sm }}
              />
            </View>
            );
          })
        )}

        <Text
          style={{
            ...Typography.section,
            marginTop: Spacing.lg,
            marginBottom: Spacing.xs,
          }}
        >
          Strongest Lifts
        </Text>
        {strongestByExercise.length === 0 ? (
          <Text style={Typography.secondary}>No lift data yet.</Text>
        ) : (
          strongestByExercise.map(([exercise, weight]) => (
            <View
              key={exercise}
              style={{
                borderRadius: Radius.md,
                padding: Spacing.sm,
                marginBottom: Spacing.xs,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.section}>{exercise}</Text>
              <Text style={Typography.secondary}>Best: {weight} kg</Text>
            </View>
          ))
        )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

