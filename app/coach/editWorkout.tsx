import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { workoutService } from "../../services/workoutService";
import { exerciseTemplateService } from "../../services/exerciseTemplateService";
import type { Exercise } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";

export default function EditWorkout() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params]);

  const [planName, setPlanName] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      console.log("[coach/editWorkout] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);

        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }

        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setCoachId(user.id);

        const plan = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!plan) {
          setError("Workout plan not found.");
          return;
        }
        if (plan.coachId !== user.id) {
          setError("You don't have access to this workout plan.");
          return;
        }

        setPlanName(plan.name ?? "Workout Plan");
        setPlanNote(plan.note?.trim() ?? "");
        setExercises(Array.isArray(plan.exercises) && plan.exercises.length ? plan.exercises : [
          workoutService.createEmptyExercise(),
        ]);
      } catch (e: any) {
        console.error("[coach/editWorkout] load error", e);
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, user?.id, user?.role]);

  const updateExercise = (index: number, exercise: Exercise) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index] = exercise;
      return copy;
    });
  };

  const addExercise = () => {
    setExercises((prev) => [...prev, workoutService.createEmptyExercise()]);
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!coachId || !workoutPlanId) return;
    setSaving(true);
    setError(null);
    try {
      const trimmedName = planName.trim() || "Workout Plan";

      const normalizedExercises = exercises
        .map((e) => {
          const rest = (e.rest ?? "").trim();
          const tempo = (e.tempo ?? "").trim();
          const rpe = e.rpe === null || e.rpe === undefined ? null : e.rpe;

          return {
            ...e,
            name: (e.name ?? "").trim(),
            reps: (e.reps ?? "").trim(),
            rest,
            tempo,
            rpe: rpe === null ? null : rpe,
          };
        })
        .filter((e) => e.name.length > 0);

      for (const ex of normalizedExercises) {
        if (ex.rest !== "") {
          const n = Number(ex.rest);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error(`Rest for "${ex.name}" must be a number >= 0.`);
          }
        }
        if (ex.tempo.length > 20) {
          throw new Error(`Tempo for "${ex.name}" must be at most 20 characters.`);
        }
        if (ex.rpe !== null) {
          if (!Number.isFinite(ex.rpe) || ex.rpe < 1 || ex.rpe > 10) {
            throw new Error(`RPE for "${ex.name}" must be between 1 and 10.`);
          }
        }
      }

      await workoutService.updateWorkoutPlan(workoutPlanId, coachId, {
        name: trimmedName,
        exercises: normalizedExercises,
        note: planNote.trim(),
      });

      await Promise.all(
        normalizedExercises.map((e) => exerciseTemplateService.upsertNameIfNeeded(e.name))
      );

      router.back();
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout plan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
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
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
        <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.xs }}>Edit Workout</Text>

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Plan Name</Text>
        <TextInput
          value={planName}
          onChangeText={setPlanName}
          placeholder="Workout Plan"
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

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach note (optional)</Text>
        <TextInput
          value={planNote}
          onChangeText={setPlanNote}
          placeholder="Intent, cues, or progression notes…"
          placeholderTextColor={Colors.textMuted}
          multiline
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            padding: 12,
            borderRadius: Radius.sm,
            marginBottom: Spacing.md,
            color: Colors.text,
            backgroundColor: Colors.surface,
            minHeight: 72,
          }}
        />

        <FlatList
          data={exercises}
          scrollEnabled={false}
          keyExtractor={(_, index) => String(index)}
          renderItem={({ item, index }) => (
            <View style={{ marginBottom: Spacing.sm }}>
              <ExerciseInput value={item} onChange={(value) => updateExercise(index, value)} />
              <PrimaryButton
                title="Remove Exercise"
                onPress={() => {
                  if (exercises.length <= 1) {
                    Alert.alert("Cannot remove", "A workout must have at least one exercise.");
                    return;
                  }
                  removeExercise(index);
                }}
                style={{ backgroundColor: "#7F1D1D", width: "auto", alignSelf: "flex-start" }}
              />
            </View>
          )}
          ListFooterComponent={
            <View style={{ marginVertical: Spacing.xs }}>
              <PrimaryButton
                title="Add Exercise"
                onPress={addExercise}
                style={{ backgroundColor: Colors.border }}
              />
            </View>
          }
        />

        {error ? <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text> : null}

        <View style={{ marginTop: Spacing.md }}>
          {saving ? (
            <ActivityIndicator />
          ) : (
            <PrimaryButton title="Save Changes" onPress={handleSave} />
          )}
        </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

