import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { AppUser } from "../../types/User";
import type { WorkoutPlan } from "../../types/Workout";
import { WorkoutCard } from "../../components/WorkoutCard";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

// Student dashboard:
// - Loads the current student user
// - Fetches today's workout plan (first plan found for the student)
// - Navigates to workout and history screens
export default function StudentDashboard() {
  const router = useRouter();
  const [, setStudent] = useState<AppUser | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      console.log("[student/dashboard] load start");
      setLoading(true);
      try {
        setError(null);
        const user = await authService.getCurrentUserWithRole();
        console.log("[student/dashboard] currentUser.id", user?.id);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        setStudent(user);
        const workoutPlan = await workoutService.getWorkoutPlanForStudent(user.id);
        console.log("[student/dashboard] workoutPlan", workoutPlan?.id ?? null);
        setPlan(workoutPlan);
      } catch (e: any) {
        console.error("[student/dashboard] load error", e);
        setError(e.message ?? "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
        <Text
          style={{
            ...Typography.title,
            fontSize: 22,
            marginBottom: Spacing.sm,
          }}
        >
          Today&apos;s Workout
        </Text>
        {plan ? (
          <WorkoutCard plan={plan} />
        ) : (
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.md,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={Typography.secondary}>No workout plan assigned yet.</Text>
          </View>
        )}
        <View style={{ marginTop: Spacing.lg }}>
          <PrimaryButton
            title="Start Workout"
            onPress={() =>
              router.push(
                plan
                  ? {
                      pathname: "/student/workoutExecution",
                      params: { workoutPlanId: plan.id },
                    }
                  : "/student/workout"
              )
            }
          />
        </View>
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton
            title="View History"
            onPress={() => router.push("/student/workoutHistory")}
            style={{ backgroundColor: Colors.border }}
          />
        </View>
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton
            title="Today&apos;s Schedule"
            onPress={() => router.push("/student/today")}
            style={{ backgroundColor: Colors.border }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

