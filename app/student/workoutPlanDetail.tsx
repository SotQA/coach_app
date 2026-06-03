import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { useUnits } from "../../context/UnitsContext";
import { useActiveWorkoutSession } from "../../context/ActiveWorkoutSessionContext";
import { FLOATING_BAR_SCROLL_OFFSET } from "../../components/FloatingWorkoutBar";
import { buildLastResultsMapFromLogs, normalizeExerciseName, type LastSetResult } from "../../utils/workoutMetrics";
import { toUnit } from "../../utils/units";

export default function WorkoutPlanDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unit } = useUnits();
  const { session } = useActiveWorkoutSession();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const planId = String(params.workoutPlanId ?? "").trim();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [lastResultsByExercise, setLastResultsByExercise] = useState<Map<string, LastSetResult[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rolePrefix = user?.role === "athlete" ? "/athlete" : user?.role === "coach" ? "/coach" : "/student";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!planId) {
          setError("Missing workout.");
          return;
        }
        if (!user || (user.role !== "student" && user.role !== "athlete" && user.role !== "coach")) {
          setError("You must be logged in to view this workout.");
          return;
        }
        const [p, history] = await Promise.all([
          workoutService.getWorkoutPlanById(planId),
          workoutService.getWorkoutHistory(user.id).catch(() => []),
        ]);
        if (cancelled) return;
        if (!p || (p.studentId !== user.id && p.coachId !== user.id)) {
          setError("Workout not found.");
          return;
        }
        setPlan(p);
        setLastResultsByExercise(buildLastResultsMapFromLogs(history));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, user?.id, user?.role]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={{ flex: 1, padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger }}>{error ?? "Not found."}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: session
            ? insets.bottom + FLOATING_BAR_SCROLL_OFFSET + 8
            : insets.bottom + Spacing.xl,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ ...Typography.title, fontSize: 24, marginBottom: Spacing.xs }}>{plan.name}</Text>
        {plan.note ? (
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>{plan.note}</Text>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: Spacing.sm,
            marginBottom: Spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="list-outline" size={18} color={Colors.primary} />
            <Text style={Typography.secondary}>{plan.exercises?.length ?? 0} exercises</Text>
          </View>
          {plan.estimatedDurationMinutes != null && plan.estimatedDurationMinutes > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
              <Text style={Typography.secondary}>~{plan.estimatedDurationMinutes} min</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>Exercises</Text>
        <View style={{ gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {(plan.exercises ?? []).map((ex, i) => {
            const lastResults = lastResultsByExercise.get(normalizeExerciseName(ex.name));
            const lastLabel = lastResults && lastResults.length > 0
              ? lastResults.map((s) => {
                  const w = s.weight != null ? toUnit(s.weight, unit) : null;
                  const wStr = w != null ? parseFloat(w.toFixed(2)).toString() : "BW";
                  return `${wStr}×${s.reps}`;
                }).join(", ")
              : null;
            return (
              <TouchableOpacity
                key={`${ex.name}-${i}`}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: `${rolePrefix}/exerciseDetail` as any,
                    params: {
                      exerciseName: ex.name,
                      exerciseDbId: ex.exerciseDbId ?? "",
                      videoUrl: ex.videoUrl ?? "",
                      coachNote: ex.coachNote ?? "",
                      lang: "en",
                    },
                  })
                }
                style={{
                  backgroundColor: Colors.card,
                  borderRadius: Radius.lg,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                  <Text style={{ ...Typography.section, fontWeight: "800", flex: 1 }}>
                    {ex.name}
                  </Text>
                  <Ionicons name="information-circle" size={16} color={Colors.primary} style={{ marginTop: 2 }} />
                </View>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  {ex.sets} sets · {ex.reps} reps
                  {ex.weight != null ? ` · ${ex.weight} kg` : ""}
                </Text>
                {lastLabel ? (
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, fontStyle: "italic" }}>
                    Last: {lastLabel}
                  </Text>
                ) : null}
                {ex.coachNote ? (
                  <Text style={{ ...Typography.secondary, color: Colors.primary, marginTop: 4 }}>
                    {ex.coachNote}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <PrimaryButton
          title="Start Workout"
          onPress={() =>
            router.push({
              pathname: `${rolePrefix}/workoutExecution` as any,
              params: {
                workoutPlanId: plan.id,
                groupId: plan.groupId ?? "",
                workoutName: plan.name,
              },
            })
          }
        />
      </ScrollView>
    </View>
  );
}
