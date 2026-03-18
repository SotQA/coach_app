import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function TodayWorkout() {
  const router = useRouter();
  const { logout } = useAuth();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayName = useMemo(() => DAY_NAMES[new Date().getDay()], []);

  useEffect(() => {
    const load = async () => {
      console.log("[student/today] load start");
      setLoading(true);
      try {
        setError(null);
        const user = await authService.getCurrentUserWithRole();
        console.log("[student/today] currentUser.id", user?.id);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const allPlans = await workoutService.getWorkoutPlansForStudent(user.id);
        console.log("[student/today] allPlans", allPlans.length);

        const todaysPlans = allPlans.filter((plan) => {
          const days = (plan.scheduledDays ?? []) as string[];
          if (!days || days.length === 0) {
            // If no schedule is set, treat as not specifically scheduled.
            return false;
          }
          return days.some((d) => d.trim().toLowerCase() === todayName.toLowerCase());
        });

        setPlans(todaysPlans);
      } catch (e: any) {
        console.error("[student/today] load error", e);
        setError(e.message ?? "Failed to load today's workout.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [todayName]);

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
              fontSize: 22,
            }}
          >
            Today&apos;s Workout ({todayName})
          </Text>
          <PrimaryButton
            title="Logout"
            onPress={async () => {
              await logout();
              router.replace("/login");
            }}
            style={{
              width: "auto",
              paddingHorizontal: Spacing.sm,
              paddingVertical: 12,
              backgroundColor: Colors.border,
              borderRadius: Radius.pill,
            }}
            textStyle={{ fontSize: 14, fontWeight: "700" }}
          />
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
              No workouts scheduled for today. Your coach hasn&apos;t assigned anything for this day yet.
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

