import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutPlan } from "../../types/Workout";

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
          backgroundColor: "#0F172A",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#0F172A" }}>
        <Text style={{ color: "#FCA5A5", marginBottom: 12 }}>{error}</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#0F172A" }}>
        <Text style={{ color: "#FCA5A5", marginBottom: 12 }}>Workout plan not loaded.</Text>
        <PrimaryButton title="Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            backgroundColor: "#111827",
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 4, color: "#F9FAFB" }}>
            Workout Execution
          </Text>
          <Text style={{ color: "#9CA3AF" }}>Log completed reps and weight per exercise.</Text>
        </View>

        {plan.exercises.map((exercise, idx) => {
          const entry = entries[idx] ?? { repsCompleted: "", weight: "" };
          return (
            <View
              key={`${exercise.name}-${idx}`}
              style={{
                backgroundColor: "#020617",
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "#F9FAFB", fontWeight: "700", marginBottom: 6 }}>
                {exercise.name}
              </Text>
              <Text style={{ color: "#9CA3AF", marginBottom: 12 }}>
                Planned: {exercise.sets} sets × {exercise.reps} reps
                {exercise.weight ? ` @ ${exercise.weight}kg` : ""}
              </Text>

              <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Completed Reps</Text>
              <TextInput
                value={entry.repsCompleted}
                onChangeText={(v) => updateEntry(idx, { repsCompleted: v })}
                keyboardType="number-pad"
                placeholder={String(exercise.reps)}
                placeholderTextColor="#6B7280"
                style={{
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 12,
                  color: "white",
                  backgroundColor: "#0B1220",
                }}
              />

              <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Weight (kg)</Text>
              <TextInput
                value={entry.weight}
                onChangeText={(v) => updateEntry(idx, { weight: v })}
                keyboardType="numeric"
                placeholder={exercise.weight ? String(exercise.weight) : "e.g. 60"}
                placeholderTextColor="#6B7280"
                style={{
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  padding: 12,
                  borderRadius: 12,
                  color: "white",
                  backgroundColor: "#0B1220",
                }}
              />
            </View>
          );
        })}

        {message ? <Text style={{ color: "#6EE7B7", marginBottom: 12 }}>{message}</Text> : null}
        {saving ? (
          <ActivityIndicator />
        ) : (
          <PrimaryButton title="Complete Workout" onPress={handleSubmit} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

