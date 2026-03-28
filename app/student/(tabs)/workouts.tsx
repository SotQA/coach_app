import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../../context/AuthContext";
import { workoutService } from "../../../services/workoutService";
import type { WorkoutPlan } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenLayout } from "../../../components/ScreenLayout";

export default function StudentWorkouts() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    console.log("[student/workouts] load start");
    setLoading(true);
    try {
      setError(null);
      console.log("[student/workouts] currentUser.id", user?.id);
      if (!user || user.role !== "student") {
        setError("You must be logged in as a student.");
        return;
      }

      const activePlans = await workoutService.getActiveWorkoutPlansForStudent(user.id);
      setPlans(activePlans);
    } catch (e: any) {
      console.error("[student/workouts] load error", e);
      setError(e.message ?? "Failed to load workouts.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sortedPlans = useMemo(() => {
    return [...plans].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    );
  }, [plans]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: Spacing.md,
            backgroundColor: Colors.bg,
          }}
        >
          <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
          <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}>
          <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>
            Your Workouts
          </Text>

          {sortedPlans.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.secondary}>No workouts assigned yet.</Text>
            </View>
          ) : (
            sortedPlans.map((plan, idx) => (
              <Pressable
                key={plan.id}
                onPress={() =>
                  router.push({
                    pathname: "/student/workoutExecution",
                    params: { workoutPlanId: plan.id },
                  })
                }
                style={({ pressed }) => ({
                  backgroundColor: Colors.surface,
                  borderRadius: Radius.md,
                  padding: Spacing.md,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: Spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ ...Typography.secondary, marginBottom: 4 }}>Workout {idx + 1}</Text>
                <Text style={Typography.section}>{plan.name}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}

