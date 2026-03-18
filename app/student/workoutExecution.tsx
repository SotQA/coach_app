import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

type ExerciseEntry = {
  repsCompleted: string;
  weight: string;
};

export default function WorkoutExecution() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(
    () => String(params.workoutPlanId ?? "").trim(),
    [params]
  );

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      console.log("[student/workoutExecution] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);
        setMessage(null);

        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }

        const user = await authService.getCurrentUserWithRole();
        console.log("[student/workoutExecution] currentUser", user);
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const loaded = await workoutService.getWorkoutPlanById(workoutPlanId);
        console.log("[student/workoutExecution] fetched plan", loaded?.id);
        if (!loaded) {
          setError("Workout plan not found.");
          return;
        }

        if (loaded.studentId !== user.id) {
          setError("You don't have access to this workout plan.");
          return;
        }

        setPlan(loaded);
        setEntries(
          loaded.exercises.map((ex) => ({
            repsCompleted: String(ex.reps ?? ""),
            weight: String(ex.weight ?? ""),
          }))
        );
      } catch (e: any) {
        console.error("[student/workoutExecution] load error", e);
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId]);

  const updateEntry = (index: number, patch: Partial<ExerciseEntry>) => {
    setEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!plan) return;

    console.log("[student/workoutExecution] submit start", {
      workoutPlanId: plan.id,
      exercises: plan.exercises.length,
    });
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const user = await authService.getCurrentUserWithRole();
      console.log("[student/workoutExecution] currentUser (submit)", user);
      if (!user || user.role !== "student") {
        setError("You must be logged in as a student.");
        return;
      }

      // One workoutLogs entry per exercise (simple & query-friendly).
      await Promise.all(
        plan.exercises.map((exercise, idx) => {
          const entry = entries[idx] ?? { repsCompleted: "", weight: "" };
          const repsCompleted = Number(entry.repsCompleted);
          const weight = entry.weight.trim() === "" ? undefined : Number(entry.weight);

          if (!Number.isFinite(repsCompleted) || repsCompleted < 0) {
            throw new Error(`Invalid reps for "${exercise.name}".`);
          }
          if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
            throw new Error(`Invalid weight for "${exercise.name}".`);
          }

          return workoutService.logWorkoutEntry({
            studentId: user.id,
            workoutPlanId: plan.id,
            exercise: exercise.name,
            sets: exercise.sets,
            reps: repsCompleted,
            weight,
          });
        })
      );

      console.log("[student/workoutExecution] submit success");
      setMessage("Workout saved to history.");
      router.replace("/student/workoutHistory");
    } catch (e: any) {
      console.error("[student/workoutExecution] submit error", e);
      setError(e.message ?? "Failed to save workout.");
    } finally {
      setSaving(false);
    }
  };

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
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>
          Workout plan not loaded.
        </Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
    >
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
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: 4 }}>Workout Execution</Text>
        <Text style={Typography.secondary}>Log completed reps and weight per exercise.</Text>
      </View>
      <View style={{ marginBottom: Spacing.sm }}>
        <PrimaryButton
          title="Back"
          onPress={() => router.back()}
          style={{ width: "auto", backgroundColor: Colors.border, alignSelf: "flex-start" }}
        />
      </View>

      {plan.exercises.map((exercise, idx) => {
        const entry = entries[idx] ?? { repsCompleted: "", weight: "" };
        return (
          <View
            key={`${exercise.name}-${idx}`}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: Radius.md,
              padding: Spacing.md,
              marginBottom: Spacing.sm,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ ...Typography.section, marginBottom: 6 }}>{exercise.name}</Text>
            <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
              Planned: {exercise.sets} sets × {exercise.reps} reps
              {exercise.weight ? ` @ ${exercise.weight}kg` : ""}
            </Text>

            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Completed Reps</Text>
            <TextInput
              value={entry.repsCompleted}
              onChangeText={(v) => updateEntry(idx, { repsCompleted: v })}
              keyboardType="number-pad"
              placeholder={String(exercise.reps)}
              placeholderTextColor={Colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.sm,
                marginBottom: Spacing.sm,
                color: Colors.text,
                backgroundColor: Colors.surface,
              }}
            />

            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Weight (kg)</Text>
            <TextInput
              value={entry.weight}
              onChangeText={(v) => updateEntry(idx, { weight: v })}
              keyboardType="numeric"
              placeholder={exercise.weight ? String(exercise.weight) : "e.g. 60"}
              placeholderTextColor={Colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 12,
                borderRadius: Radius.sm,
                color: Colors.text,
                backgroundColor: Colors.surface,
              }}
            />
          </View>
        );
      })}

      {message ? (
        <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
      ) : null}
      {saving ? <ActivityIndicator /> : <PrimaryButton title="Complete Workout" onPress={handleSubmit} />}
    </KeyboardAwareScrollView>
  );
}

