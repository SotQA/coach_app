import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  View,
} from "react-native";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog, WorkoutPlan } from "../../types/Workout";
import {
  buildBestWeightMapFromLogs,
  computeExerciseVolume,
  computeTotalVolume,
  normalizeExerciseName,
} from "../../utils/workoutMetrics";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

type ExerciseEntry = {
  repsCompleted: string;
  weight: string;
};

function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function WorkoutExecution() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(
    () => String(params.workoutPlanId ?? "").trim(),
    [params]
  );

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [priorLogs, setPriorLogs] = useState<WorkoutLog[]>([]);
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

        const history = await workoutService.getWorkoutHistory(user.id);
        setPriorLogs(Array.isArray(history) ? history : []);

        setPlan(loaded);
        setEntries(
          loaded.exercises.map((ex) => ({
            // `reps` can be planned ranges like "8-12", so do not prefill
            // completed reps with planned text (it breaks numeric validation).
            repsCompleted: "",
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

  const bestWeightByExercise = useMemo(
    () => buildBestWeightMapFromLogs(priorLogs),
    [priorLogs]
  );

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

      const completedExercises = plan.exercises.map((exercise, idx) => {
        const entry = entries[idx] ?? { repsCompleted: "", weight: "" };
        const repsDone = entry.repsCompleted.trim();
        const weightText = entry.weight.trim();
        const normalizedWeightText = weightText.replace(",", ".");
        const weight = normalizedWeightText === "" ? null : Number(normalizedWeightText);

        // Accept formats like "10" or "7-12", reject negatives/empty.
        const isNumberReps = /^\d+$/.test(repsDone);
        const isRangeReps = /^\d+\s*-\s*\d+$/.test(repsDone);
        if (!repsDone || (!isNumberReps && !isRangeReps)) {
          throw new Error(`Reps done for "${exercise.name}" must be a positive number or range (e.g. 7-12).`);
        }
        if (repsDone.startsWith("-")) {
          throw new Error(`Reps done for "${exercise.name}" cannot be negative.`);
        }
        if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
          throw new Error(`Weight for "${exercise.name}" must be >= 0.`);
        }

        const exKey = normalizeExerciseName(exercise.name);
        const prevBest = bestWeightByExercise.get(exKey);
        const isPr =
          weight !== null &&
          Number.isFinite(weight) &&
          weight > 0 &&
          (prevBest === undefined || weight > prevBest);

        const volume = computeExerciseVolume(exercise.sets, repsDone, weight);

        return {
          name: exercise.name,
          sets: exercise.sets,
          repsPlanned: String(exercise.reps ?? ""),
          repsDone,
          weight,
          rest: exercise.rest ?? "",
          tempo: exercise.tempo ?? "",
          rpe: exercise.rpe ?? null,
          volume,
          isPr,
        };
      });

      const totalVolume = computeTotalVolume(completedExercises);
      const prNames = completedExercises.filter((e) => e.isPr).map((e) => e.name);

      await workoutService.logCompletedWorkout({
        studentId: user.id,
        workoutPlanId: plan.id,
        workoutName: plan.name,
        exercises: completedExercises,
        completedAt: new Date().toISOString(),
        totalVolume,
      });

      console.log("[student/workoutExecution] submit success");
      if (prNames.length > 0) {
        Alert.alert("Great session!", `🔥 New PR on: ${prNames.join(", ")}`);
      }
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
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
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

      {plan.exercises.map((exercise, idx) => {
        const entry = entries[idx] ?? { repsCompleted: "", weight: "" };
        const kg = parseKgInput(entry.weight);
        const prev = bestWeightByExercise.get(normalizeExerciseName(exercise.name));
        const showPrHint =
          kg !== null && kg > 0 && (prev === undefined || kg > prev);
        const metaParts: string[] = [];
        if (exercise.rest && exercise.rest.trim() !== "") {
          metaParts.push(`Rest: ${exercise.rest}s`);
        }
        if (exercise.tempo && exercise.tempo.trim() !== "") {
          metaParts.push(`Tempo: ${exercise.tempo}`);
        }
        if (exercise.rpe !== null && exercise.rpe !== undefined) {
          metaParts.push(`RPE: ${exercise.rpe}`);
        }

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
            <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>
              Planned: {exercise.sets} sets × {exercise.reps} reps
            </Text>
            {exercise.weight != null && Number.isFinite(exercise.weight) ? (
              <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
                Weight: {exercise.weight}kg
              </Text>
            ) : null}

            {metaParts.length ? (
              <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>{metaParts.join(" • ")}</Text>
            ) : null}

            <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Completed Reps</Text>
            <TextInput
              value={entry.repsCompleted}
              onChangeText={(v) => updateEntry(idx, { repsCompleted: v })}
              // Allow pasting string reps; we validate/convert on submit.
              keyboardType="default"
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
            {showPrHint ? (
              <Text style={{ color: Colors.success, marginTop: Spacing.xs, fontWeight: "600" }}>
                🔥 New PR!
              </Text>
            ) : null}
          </View>
        );
      })}

      {message ? (
        <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
      ) : null}
      {saving ? <ActivityIndicator /> : <PrimaryButton title="Complete Workout" onPress={handleSubmit} />}
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

