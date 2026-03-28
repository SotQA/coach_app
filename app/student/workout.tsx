import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import type { AppUser } from "../../types/User";
import type { Exercise } from "../../types/Workout";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

// Simple workout logging screen:
// - Loads the current student
// - Allows logging a single exercise set at a time
// - Uses ExerciseInput to keep UI consistent with coach's plan builder
export default function WorkoutScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
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
        console.log("[student/workout] currentUser.id", authUser?.id);
        if (!authUser || authUser.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        setStudent(authUser);
        const plan = await workoutService.getWorkoutPlanForStudent(authUser.id);
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
  }, [authUser?.id, authUser?.role]);

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
        workoutName: "Workout",
        exercise: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        rest: exercise.rest,
        tempo: exercise.tempo,
        rpe: exercise.rpe,
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
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.sm }}>
          Log Workout
        </Text>
        <ExerciseInput value={exercise} onChange={setExercise} showAdvancedFields={false} />
        <View style={{ marginTop: 16 }}>
          {submitting ? <ActivityIndicator /> : <PrimaryButton title="Save Set" onPress={handleLogWorkout} />}
        </View>
        {message ? <Text style={{ color: Colors.success, marginTop: Spacing.xs }}>{message}</Text> : null}
        {error ? <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text> : null}
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

