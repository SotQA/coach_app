import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { AppUser } from "../../types/User";
import type { WorkoutPlan } from "../../types/Workout";
import { WorkoutCard } from "../../components/WorkoutCard";
import { PrimaryButton } from "../../components/PrimaryButton";

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
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            marginBottom: 12,
            color: "#F9FAFB",
          }}
        >
          Today&apos;s Workout
        </Text>
        {plan ? (
          <WorkoutCard plan={plan} />
        ) : (
          <Text style={{ color: "#9CA3AF" }}>
            No workout plan assigned yet.
          </Text>
        )}
        <View style={{ marginTop: 24 }}>
          <PrimaryButton
            title="Start Workout"
            onPress={() => router.push("/student/workout")}
          />
        </View>
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            title="View History"
            onPress={() => router.push("/student/workoutHistory")}
            style={{ backgroundColor: "#1F2937" }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

