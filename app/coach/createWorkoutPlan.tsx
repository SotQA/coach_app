import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  View,
} from "react-native";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { Exercise } from "../../types/Workout";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { BackButton } from "../../components/BackButton";
import { ScreenLayout } from "../../components/ScreenLayout";

// Screen for coaches to build a workout plan for a specific student.
// Uses ExerciseInput to keep exercise editing logic reusable.
export default function CreateWorkoutPlan() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    studentId?: string;
    studentName?: string;
  }>();

  const [studentName] = useState(params.studentName ?? "Student");
  const [studentId] = useState(params.studentId ?? "");
  const [planName, setPlanName] = useState("Workout Plan");
  const [orderInput, setOrderInput] = useState("1");
  const [note, setNote] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([
    workoutService.createEmptyExercise(),
  ]);
  const [loading, setLoading] = useState(false);
  const [initializingUser, setInitializingUser] = useState(true);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await authService.getCurrentUserWithRole();
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setCoachId(user.id);

        // Best-effort default ordering: append to the end.
        if (studentId) {
          const existing = await workoutService.getWorkoutPlansForStudentAsCoach(user.id, studentId);
          const maxOrder = existing.reduce((max, p) => {
            const n = typeof p.order === "number" && Number.isFinite(p.order) ? p.order : -1;
            return Math.max(max, n);
          }, -1);
          setOrderInput(String(maxOrder + 1));
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to load user.");
      } finally {
        setInitializingUser(false);
      }
    };

    init();
  }, []);

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

  const handleSavePlan = async () => {
    if (!coachId || !studentId) {
      setError("Missing coach or student information.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const name = planName.trim() || `Workout Plan for ${studentName}`;
      const parsedOrder = Number(orderInput);
      const order = Number.isFinite(parsedOrder) ? parsedOrder : 0;

      const sanitizedExercises = exercises
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

      for (const ex of sanitizedExercises) {
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

      await workoutService.createWorkoutPlan({
        coachId,
        studentId,
        name,
        exercises: sanitizedExercises,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        order,
        note: note.trim() || undefined,
      });
      router.replace("/coach/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout plan.");
    } finally {
      setLoading(false);
    }
  };

  if (initializingUser) {
    return (
      <ScreenLayout>
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
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
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
          <Text
            style={{
              ...Typography.title,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Create Workout Plan
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            For: {studentName}
          </Text>

          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Plan Name</Text>
          <TextInput
            placeholder="e.g. Strength Block A"
            placeholderTextColor={Colors.textMuted}
            value={planName}
            onChangeText={setPlanName}
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

          <Text style={{ ...Typography.secondary, marginBottom: 6, marginTop: Spacing.xs }}>
            Order
          </Text>
          <TextInput
            placeholder="e.g. 1"
            placeholderTextColor={Colors.textMuted}
            value={orderInput}
            onChangeText={setOrderInput}
            keyboardType="number-pad"
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

          <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Coach Note (optional)</Text>
          <TextInput
            placeholder="Guidance or intent for this plan..."
            placeholderTextColor={Colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.sm,
              marginBottom: Spacing.sm,
              color: Colors.text,
              backgroundColor: Colors.surface,
              minHeight: 60,
            }}
          />

          <FlatList
            data={exercises}
            scrollEnabled={false}
            keyExtractor={(_, index) => String(index)}
            renderItem={({ item, index }) => (
              <ExerciseInput
                value={item}
                onChange={(value) => updateExercise(index, value)}
              />
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

          <View style={{ marginTop: Spacing.md }}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <PrimaryButton title="Save Plan" onPress={handleSavePlan} />
            )}
            {error ? (
              <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
            ) : null}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}

