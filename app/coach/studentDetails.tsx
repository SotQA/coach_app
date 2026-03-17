import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import { workoutService } from "../../services/workoutService";
import type { Student } from "../../types/Student";
import type { WorkoutPlan } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";

export default function StudentDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const [student, setStudent] = useState<Student | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);

        if (!studentId) {
          setError("Missing studentId.");
          return;
        }

        const user = await authService.getCurrentUserWithRole();
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }

        const studentDoc = await studentService.getStudentById(studentId);
        if (!studentDoc) {
          setError("Student not found.");
          return;
        }

        // Basic ownership check (UI-level). Security should be enforced via Firestore rules too.
        if (studentDoc.coachId !== user.id) {
          setError("You don't have access to this student.");
          return;
        }

        setStudent(studentDoc);

        const workoutPlans = await workoutService.getWorkoutPlansForStudentAsCoach(
          user.id,
          studentId
        );
        setPlans(workoutPlans);
      } catch (e: any) {
        setError(e.message ?? "Failed to load student details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: "#0F172A",
        }}
      >
        <Text style={{ color: "#FCA5A5", marginBottom: 12 }}>{error}</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#0F172A" }}>
        <Text style={{ color: "#FCA5A5", marginBottom: 12 }}>Student not loaded.</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
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
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8, color: "#F9FAFB" }}>
            Student Details
          </Text>

          <Text style={{ color: "#9CA3AF" }}>Name</Text>
          <Text style={{ color: "#F9FAFB", fontWeight: "600", marginBottom: 12 }}>
            {student.name}
          </Text>

          <Text style={{ color: "#9CA3AF" }}>Email</Text>
          <Text style={{ color: "#F9FAFB", fontWeight: "600", marginBottom: 16 }}>
            {student.email}
          </Text>

          <PrimaryButton
            title="Create Workout Plan"
            onPress={() =>
              router.push({
                pathname: "/coach/createWorkoutPlan",
                params: { studentId: student.id, studentName: student.name },
              })
            }
          />
          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              title="View Progress"
              onPress={() =>
                router.push({
                  pathname: "/coach/viewProgress",
                  params: { studentId: student.id },
                })
              }
              style={{ backgroundColor: "#1F2937" }}
            />
          </View>
        </View>

        <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8, color: "#E5E7EB" }}>
          Workout Plans
        </Text>

        {plans.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>No workout plans yet.</Text>
        ) : (
          <FlatList
            data={plans}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <WorkoutCard plan={item} />}
          />
        )}
      </ScrollView>
    </View>
  );
}

