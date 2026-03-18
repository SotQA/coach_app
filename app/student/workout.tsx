import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { AppUser } from "../../types/User";
import type { Exercise } from "../../types/Workout";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

// Simple workout logging screen:
// - Loads the current student
// - Allows logging a single exercise set at a time
// - Uses ExerciseInput to keep UI consistent with coach's plan builder
export default function WorkoutScreen() {
  const router = useRouter();
  const [student, setStudent] = useState<AppUser | null>(null);
  const [workoutPlanId, setWorkoutPlanId] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise>(
    workoutService.createEmptyExercise()
  );
  const [loadingUser, setLoadingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      console.log("[student/workout] load start");
      try {
        setError(null);
        const user = await authService.getCurrentUserWithRole();
        console.log("[student/workout] currentUser.id", user?.id);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        setStudent(user);
        const plan = await workoutService.getWorkoutPlanForStudent(user.id);
        console.log("[student/workout] workoutPlan", plan?.id ?? null);
        setWorkoutPlanId(plan?.id ?? null);
      } catch (e: any) {
        console.error("[student/workout] load error", e);
        setError(e.message ?? "Failed to load user.");
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, []);

  const handleLogWorkout = async () => {
    if (!student) return;
    if (!workoutPlanId) {
      setError("No workout plan assigned yet.");
      return;
    }
    console.log("[student/workout] submit start", {
      currentUserId: student.id,
      workoutPlanId,
    });
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await workoutService.logWorkoutEntry({
        studentId: student.id,
        workoutPlanId,
        exercise: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
      });
      console.log("[student/workout] submit success");
      setMessage("Workout logged!");
      setExercise(workoutService.createEmptyExercise());
    } catch (e: any) {
      console.error("[student/workout] submit error", e);
      setError(e.message ?? "Failed to log workout.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
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
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 8,
            color: "#F9FAFB",
          }}
        >
          Log Workout
        </Text>
        <ExerciseInput value={exercise} onChange={setExercise} />
        <View style={{ marginTop: 16 }}>
          {submitting ? (
            <ActivityIndicator />
          ) : (
            <PrimaryButton title="Save Set" onPress={handleLogWorkout} />
          )}
        </View>
        {message ? (
          <Text style={{ color: "#6EE7B7", marginTop: 8 }}>{message}</Text>
        ) : null}
        {error ? <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text> : null}
    </KeyboardAwareScrollView>
  );
}

