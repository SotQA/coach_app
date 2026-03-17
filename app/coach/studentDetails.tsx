import { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import { workoutService } from "../../services/workoutService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { WorkoutPlan, WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";
import { WorkoutCard } from "../../components/WorkoutCard";

export default function StudentDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const strongestByExercise = useMemo(() => {
    const best = new Map<string, number>();
    for (const log of logs) {
      if (typeof log.weight !== "number" || !Number.isFinite(log.weight)) continue;
      const key = (log.exercise ?? "").trim();
      if (!key) continue;
      const current = best.get(key);
      if (current === undefined || log.weight > current) {
        best.set(key, log.weight);
      }
    }
    return Array.from(best.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
    );
  }, [logs]);

  useEffect(() => {
    const load = async () => {
      console.log("[coach/studentDetails] load start", { studentId });
      setLoading(true);
      try {
        setError(null);

        if (!studentId) {
          setError("Missing studentId.");
          return;
        }

        const user = await authService.getCurrentUserWithRole();
        console.log("[coach/studentDetails] currentUser", user);
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }

        const studentDoc = await studentService.getStudentById(studentId);
        console.log("[coach/studentDetails] fetched student", studentDoc?.id);
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
        console.log("[coach/studentDetails] fetched plans", workoutPlans.length);
        setPlans(workoutPlans);

        const history = await workoutService.getWorkoutHistory(studentId);
        console.log("[coach/studentDetails] fetched logs", history.length);
        setLogs(history);
      } catch (e: any) {
        console.error("[coach/studentDetails] load error", e);
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
            {student.email || "Student"}
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
                params: { studentId: student.id, studentName: student.email || "Student" },
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

        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            marginTop: 24,
            marginBottom: 8,
            color: "#E5E7EB",
          }}
        >
          Recent Workouts
        </Text>
        {logs.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>No workouts logged yet.</Text>
        ) : (
          logs.slice(0, 5).map((log) => (
            <View
              key={log.id}
              style={{
                borderRadius: 16,
                padding: 12,
                marginBottom: 8,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "#F9FAFB", fontWeight: "600" }}>{log.exercise}</Text>
              <Text style={{ color: "#9CA3AF" }}>
                {log.sets} sets × {log.reps} reps
                {log.weight ? ` @ ${log.weight}kg` : ""}
              </Text>
            </View>
          ))
        )}

        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            marginTop: 24,
            marginBottom: 8,
            color: "#E5E7EB",
          }}
        >
          Strongest Lifts
        </Text>
        {strongestByExercise.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>No lift data yet.</Text>
        ) : (
          strongestByExercise.map(([exercise, weight]) => (
            <View
              key={exercise}
              style={{
                borderRadius: 16,
                padding: 12,
                marginBottom: 8,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "#F9FAFB", fontWeight: "600" }}>{exercise}</Text>
              <Text style={{ color: "#9CA3AF" }}>Best: {weight} kg</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

