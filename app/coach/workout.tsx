import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

export default function CoachWorkout() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params]);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    const load = async () => {
      console.log("[coach/workout] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);
        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }

        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }

        const loaded = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!loaded) {
          setError("Workout plan not found.");
          return;
        }
        if (loaded.coachId !== user.id) {
          setError("You don't have access to this workout plan.");
          return;
        }

        setPlan(loaded);
      } catch (e: any) {
        console.error("[coach/workout] load error", e);
        setError(e.message ?? "Failed to load workout.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, user?.id, user?.role]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>Workout not loaded.</Text>
      </View>
    );
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}>
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: 20,
            marginBottom: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={{ ...Typography.title, fontSize: 22, marginBottom: 4 }}>Workout</Text>
          <Text style={Typography.secondary}>Review the plan, then edit if needed.</Text>
        </View>

        <WorkoutCard plan={plan} />

        <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
          <PrimaryButton
            title="Edit Workout"
            onPress={() =>
              router.push({
                pathname: "/coach/editWorkout",
                params: { workoutPlanId: plan.id },
              })
            }
          />
          <PrimaryButton
            title={duplicating ? "Duplicating…" : "Duplicate plan"}
            onPress={async () => {
              try {
                if (!user || user.role !== "coach") {
                  Alert.alert("Sign in required", "You must be logged in as a coach.");
                  return;
                }
                setDuplicating(true);
                const copy = await workoutService.duplicateWorkoutPlan(plan.id, user.id);
                Alert.alert("Plan duplicated", "Opening the new copy.", [
                  {
                    text: "OK",
                    onPress: () =>
                      router.replace({
                        pathname: "/coach/workout",
                        params: { workoutPlanId: copy.id },
                      }),
                  },
                ]);
              } catch (e: any) {
                Alert.alert("Could not duplicate", e?.message ?? "Something went wrong.");
              } finally {
                setDuplicating(false);
              }
            }}
            style={{ backgroundColor: Colors.border }}
            disabled={duplicating}
          />
        </View>
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

