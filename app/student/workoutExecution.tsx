import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { LoggedSet, WorkoutLog, WorkoutPlan } from "../../types/Workout";
import {
  buildBestWeightMapFromLogs,
  computeExerciseVolumeFromLoggedSets,
  computeTotalVolume,
  normalizeExerciseName,
} from "../../utils/workoutMetrics";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

type SetDraft = { reps: string; weight: string };
type ExerciseDraft = { sets: SetDraft[] };

function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function setIsDone(d: SetDraft): boolean {
  const r = Number(d.reps.trim());
  if (!Number.isInteger(r) || r <= 0) return false;
  if (d.weight.trim() === "") return true;
  const w = parseKgInput(d.weight);
  return w !== null;
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
  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [focus, setFocus] = useState<{ ex: number; set: number }>({ ex: 0, set: 0 });
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
        setPlan(null);

        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }

        const user = await authService.getCurrentUserWithRole();
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const loaded = await workoutService.getWorkoutPlanById(workoutPlanId);
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
        setDrafts(
          loaded.exercises.map((ex) => ({
            sets: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({
              reps: "0",
              weight:
                ex.weight != null && Number.isFinite(Number(ex.weight))
                  ? String(ex.weight)
                  : "",
            })),
          }))
        );
        setFocus({ ex: 0, set: 0 });
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

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetDraft>) => {
    setDrafts((prev) =>
      prev.map((row, i) =>
        i !== exIdx
          ? row
          : {
              sets: row.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })),
            }
      )
    );
  };

  const handleSubmit = async () => {
    if (!plan) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const user = await authService.getCurrentUserWithRole();
      if (!user || user.role !== "student") {
        setError("You must be logged in as a student.");
        return;
      }

      const completedExercises = plan.exercises.map((exercise, exIdx) => {
        const draft = drafts[exIdx];
        if (!draft || draft.sets.length === 0) {
          throw new Error(`Missing set data for "${exercise.name}".`);
        }

        const loggedSets: LoggedSet[] = draft.sets.map((d, si) => {
          const r = Number(String(d.reps).trim());
          if (!Number.isFinite(r) || r <= 0 || !Number.isInteger(r)) {
            throw new Error(
              `Set ${si + 1} (${exercise.name}): enter whole-number reps greater than 0.`
            );
          }
          const trimmedW = d.weight.trim();
          let weightOut: number | null = null;
          if (trimmedW !== "") {
            const w = parseKgInput(d.weight);
            if (w === null) {
              throw new Error(`Set ${si + 1} (${exercise.name}): invalid weight.`);
            }
            weightOut = w;
          }

          return {
            setNumber: si + 1,
            reps: r,
            weight: weightOut,
          };
        });

        const exKey = normalizeExerciseName(exercise.name);
        const prevBest = bestWeightByExercise.get(exKey);
        const maxKg = Math.max(
          0,
          ...loggedSets.map((s) => (s.weight != null && Number.isFinite(s.weight) ? s.weight : 0))
        );
        const isPr =
          maxKg > 0 && (prevBest === undefined || maxKg > prevBest);

        const volume = computeExerciseVolumeFromLoggedSets(loggedSets);

        return {
          name: exercise.name,
          repsPlanned: String(exercise.reps ?? ""),
          sets: loggedSets,
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

  if (error && !plan) {
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
          <Text style={Typography.secondary}>Log each set: reps and weight (optional for bodyweight).</Text>
        </View>

        {plan.exercises.map((exercise, exIdx) => {
          const draft = drafts[exIdx];
          const sets = draft?.sets ?? [];
          const prev = bestWeightByExercise.get(normalizeExerciseName(exercise.name));
          const maxDraftKg = Math.max(
            0,
            ...sets.map((s) => parseKgInput(s.weight) ?? 0)
          );
          const showPrHint = maxDraftKg > 0 && (prev === undefined || maxDraftKg > prev);

          const metaParts: string[] = [];
          if (exercise.rest && exercise.rest.trim() !== "") metaParts.push(`Rest: ${exercise.rest}s`);
          if (exercise.tempo && exercise.tempo.trim() !== "") metaParts.push(`Tempo: ${exercise.tempo}`);
          if (exercise.rpe !== null && exercise.rpe !== undefined) metaParts.push(`RPE: ${exercise.rpe}`);

          return (
            <View
              key={`${exercise.name}-${exIdx}`}
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
                Planned: {exercise.sets} × {exercise.reps}
              </Text>
              {exercise.weight != null && Number.isFinite(exercise.weight) ? (
                <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
                  Target weight: {exercise.weight} kg
                </Text>
              ) : null}
              {metaParts.length ? (
                <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>{metaParts.join(" • ")}</Text>
              ) : null}

              {sets.map((setDraft, setIdx) => {
                const active = focus.ex === exIdx && focus.set === setIdx;
                const done = setIsDone(setDraft);
                return (
                  <Pressable
                    key={`set-${exIdx}-${setIdx}`}
                    onPress={() => setFocus({ ex: exIdx, set: setIdx })}
                    style={{
                      marginBottom: Spacing.sm,
                      padding: Spacing.sm,
                      borderRadius: Radius.sm,
                      borderWidth: 2,
                      borderColor: active ? Colors.primary : Colors.border,
                      backgroundColor: active ? Colors.card : "transparent",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: Spacing.xs,
                      }}
                    >
                      <Text style={{ ...Typography.section, fontSize: 15 }}>Set {setIdx + 1}</Text>
                      {done ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                          <Text style={{ color: Colors.success, fontSize: 13 }}>Done</Text>
                        </View>
                      ) : (
                        <Text style={{ ...Typography.secondary, fontSize: 12 }}>Log reps to complete</Text>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.secondary, marginBottom: 4, fontSize: 12 }}>Reps</Text>
                        <TextInput
                          value={setDraft.reps}
                          onChangeText={(v) => updateSet(exIdx, setIdx, { reps: v.replace(/[^\d]/g, "") })}
                          onFocus={() => setFocus({ ex: exIdx, set: setIdx })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          style={{
                            borderWidth: 1,
                            borderColor: Colors.border,
                            padding: 10,
                            borderRadius: Radius.sm,
                            color: Colors.text,
                            backgroundColor: Colors.surface,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.secondary, marginBottom: 4, fontSize: 12 }}>
                          Weight (kg)
                        </Text>
                        <TextInput
                          value={setDraft.weight}
                          onChangeText={(v) => updateSet(exIdx, setIdx, { weight: v })}
                          onFocus={() => setFocus({ ex: exIdx, set: setIdx })}
                          keyboardType="decimal-pad"
                          placeholder="Optional"
                          placeholderTextColor={Colors.textMuted}
                          style={{
                            borderWidth: 1,
                            borderColor: Colors.border,
                            padding: 10,
                            borderRadius: Radius.sm,
                            color: Colors.text,
                            backgroundColor: Colors.surface,
                          }}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {showPrHint ? (
                <Text style={{ color: Colors.success, marginTop: Spacing.xs, fontWeight: "600" }}>
                  🔥 New PR!
                </Text>
              ) : null}
            </View>
          );
        })}

        {error ? <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text> : null}
        {message ? (
          <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
        ) : null}
        {saving ? <ActivityIndicator /> : <PrimaryButton title="Complete Workout" onPress={handleSubmit} />}
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}
