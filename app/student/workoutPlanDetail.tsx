import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenLayout } from "../../components/ScreenLayout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export default function WorkoutPlanDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const planId = String(params.workoutPlanId ?? "").trim();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        const p = await workoutService.getWorkoutPlanById(planId);
        if (cancelled) return;
        if (!p || p.studentId !== user.id) {
          setError("Workout not found.");
          return;
        }
        setPlan(p);
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
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (error || !plan) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, padding: Spacing.md, paddingTop: insets.top, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger }}>{error ?? "Not found."}</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
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
          {(plan.exercises ?? []).map((ex, i) => (
            <View
              key={`${ex.name}-${i}`}
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.lg,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.section, fontWeight: "800" }}>{ex.name}</Text>
              <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                {ex.sets} sets · {ex.reps} reps
                {ex.weight != null ? ` · ${ex.weight} kg` : ""}
              </Text>
            </View>
          ))}
        </View>

        <PrimaryButton
          title="Start Workout"
          onPress={() =>
            router.push({
              pathname: "/student/workoutExecution",
              params: {
                workoutPlanId: plan.id,
                groupId: plan.groupId ?? "",
                workoutName: plan.name,
              },
            })
          }
        />
      </ScrollView>
    </ScreenLayout>
  );
}
