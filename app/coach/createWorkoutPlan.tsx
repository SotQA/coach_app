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
  const [scheduledDaysInput, setScheduledDaysInput] = useState("");
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
      const scheduledDays =
        scheduledDaysInput
          .split(",")
          .map((d) => d.trim())
          .filter((d) => d.length > 0) || [];
      await workoutService.createWorkoutPlan({
        coachId,
        studentId,
        name,
        exercises: exercises.filter((e) => e.name.trim().length > 0),
        createdAt: new Date(),
        scheduledDays: scheduledDays.length ? scheduledDays : undefined,
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

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
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
            Scheduled Days (comma separated)
          </Text>
          <TextInput
            placeholder="e.g. Monday, Wednesday, Friday"
            placeholderTextColor={Colors.textMuted}
            value={scheduledDaysInput}
            onChangeText={setScheduledDaysInput}
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
  );
}

