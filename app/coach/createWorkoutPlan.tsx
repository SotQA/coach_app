import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { Exercise } from "../../types/Workout";
import { ExerciseInput } from "../../components/ExerciseInput";
import { PrimaryButton } from "../../components/PrimaryButton";

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
      await workoutService.createWorkoutPlan({
        coachId,
        studentId,
        exercises: exercises.filter((e) => e.name.trim().length > 0),
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
          backgroundColor: "#0F172A",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View
          style={{
            backgroundColor: "#111827",
            borderRadius: 24,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
              color: "#F9FAFB",
            }}
          >
            Create Workout Plan
          </Text>
          <Text style={{ marginBottom: 16, color: "#9CA3AF" }}>
            For: {studentName}
          </Text>

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
              <View style={{ marginVertical: 8 }}>
                <PrimaryButton
                  title="Add Exercise"
                  onPress={addExercise}
                  style={{ backgroundColor: "#1F2937" }}
                />
              </View>
            }
          />

          <View style={{ marginTop: 16 }}>
            {loading ? (
              <ActivityIndicator />
            ) : (
              <PrimaryButton title="Save Plan" onPress={handleSavePlan} />
            )}
            {error ? (
              <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

