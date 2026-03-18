import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { Exercise } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { BackButton } from "../../components/BackButton";
import { ScreenLayout } from "../../components/ScreenLayout";

export default function EditWorkout() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params]);

  const [planName, setPlanName] = useState("");
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

        const user = await authService.getCurrentUserWithRole();
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
  }, [workoutPlanId]);

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
        .map((e) => ({ ...e, name: (e.name ?? "").trim() }))
        .filter((e) => e.name.length > 0);

      await workoutService.updateWorkoutPlan(workoutPlanId, coachId, {
        name: trimmedName,
        exercises: normalizedExercises,
      });

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
        extraScrollHeight={24}
      >
        <BackButton />
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
            marginBottom: Spacing.md,
            color: Colors.text,
            backgroundColor: Colors.surface,
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

