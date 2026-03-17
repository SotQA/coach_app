import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { useAuth } from "../../context/AuthContext";

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
          backgroundColor: "#0F172A",
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
          backgroundColor: "#0F172A",
        }}
      >
        <Text style={{ color: "#FCA5A5", marginBottom: 8 }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "#F9FAFB",
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
            style={{ paddingHorizontal: 12, backgroundColor: "#1F2937" }}
          />
        </View>
        {plans.length === 0 ? (
          <>
            <Text style={{ color: "#9CA3AF", marginBottom: 16 }}>
              No workouts scheduled for today. Your coach hasn&apos;t assigned anything for this day yet.
            </Text>
            <PrimaryButton
              title="View History"
              onPress={() => router.push("/student/workoutHistory")}
              style={{ backgroundColor: "#1F2937" }}
            />
          </>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={{ marginTop: 16 }}>
              <WorkoutCard plan={plan} />
              {plan.note ? (
                <Text style={{ color: "#9CA3AF", marginTop: 8 }}>Coach note: {plan.note}</Text>
              ) : null}
              <View style={{ marginTop: 12 }}>
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

