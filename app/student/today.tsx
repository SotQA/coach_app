import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { logger } from "@/utils/logger";

export default function TodayWorkout() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      logger.log("[student/workouts] load start");
      setLoading(true);
      try {
        setError(null);
        logger.log("[student/workouts] currentUser.id", user?.id);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const activePlans = await workoutService.getActiveWorkoutPlansForStudent(user.id);
        logger.log("[student/workouts] plans", activePlans.length);
        setPlans(activePlans);
      } catch (e: any) {
        console.error("[student/workouts] load error", e);
        setError(e.message ?? "Failed to load workouts.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id, user?.role]);

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
        <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: Spacing.sm,
          }}
        >
          <Text
            style={{
              ...Typography.title,
              fontSize: FontSizes.h3,
            }}
          >
            Your Workouts
          </Text>
        </View>
        {plans.length === 0 ? (
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.md,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
              No workouts yet. Your coach hasn&apos;t assigned any active plans.
            </Text>
            <PrimaryButton
              title="View History"
              onPress={() => router.push("/student/workoutHistory")}
              style={{ backgroundColor: Colors.border }}
            />
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={{ marginTop: Spacing.md }}>
              <WorkoutCard plan={plan} />
              {plan.note ? (
                <Text style={{ ...Typography.secondary, marginTop: Spacing.xs }}>
                  Coach note: {plan.note}
                </Text>
              ) : null}
              <View style={{ marginTop: Spacing.sm }}>
                <PrimaryButton
                  title="Start Workout"
                  onPress={() =>
                    router.push({
                      pathname: "/student/workoutExecution",
                      params: { workoutPlanId: plan.id },
                    })
                  }
                />
              </View>
            </View>
          ))
        )}
        </ScrollView>
    </View>
  );
}



