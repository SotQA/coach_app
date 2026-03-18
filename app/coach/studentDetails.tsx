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
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export default function StudentDetails() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();

  const studentId = useMemo(() => String(params.studentId ?? "").trim(), [params]);

  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          padding: 16,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  if (!student) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>Student not loaded.</Text>
        <PrimaryButton title="Back to Dashboard" onPress={() => router.replace("/coach/dashboard")} />
      </View>
    );
  }

  const strongestByExercise = (() => {
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
  })();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}>
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
          <Text style={{ ...Typography.title, fontSize: 22, marginBottom: Spacing.xs }}>
            Student Details
          </Text>

          <Text style={Typography.secondary}>Name</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.sm }}>
            {student.email || "Student"}
          </Text>

          <Text style={Typography.secondary}>Email</Text>
          <Text style={{ ...Typography.section, marginBottom: Spacing.md }}>
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
          <View style={{ marginTop: Spacing.sm }}>
            <PrimaryButton
              title="View Progress"
              onPress={() =>
                router.push({
                  pathname: "/coach/viewProgress",
                  params: { studentId: student.id },
                })
              }
              style={{ backgroundColor: Colors.border }}
            />
          </View>

          <View style={{ marginTop: Spacing.sm }}>
            <PrimaryButton
              title="Back to Students"
              onPress={() => router.replace("/coach/dashboard")}
              style={{ backgroundColor: Colors.border }}
            />
          </View>
        </View>

        <Text style={{ ...Typography.section, marginBottom: Spacing.xs }}>
          Workout Plans
        </Text>

        {plans.length === 0 ? (
          <Text style={Typography.secondary}>No workout plans yet.</Text>
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
            ...Typography.section,
            marginTop: Spacing.lg,
            marginBottom: Spacing.xs,
          }}
        >
          Recent Workouts
        </Text>
        {logs.length === 0 ? (
          <Text style={Typography.secondary}>No workouts logged yet.</Text>
        ) : (
          logs.slice(0, 5).map((log) => (
            <View
              key={log.id}
              style={{
                borderRadius: Radius.md,
                padding: Spacing.sm,
                marginBottom: Spacing.xs,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.section}>{log.exercise}</Text>
              <Text style={Typography.secondary}>
                {log.sets} sets × {log.reps} reps
                {log.weight ? ` @ ${log.weight}kg` : ""}
              </Text>
            </View>
          ))
        )}

        <Text
          style={{
            ...Typography.section,
            marginTop: Spacing.lg,
            marginBottom: Spacing.xs,
          }}
        >
          Strongest Lifts
        </Text>
        {strongestByExercise.length === 0 ? (
          <Text style={Typography.secondary}>No lift data yet.</Text>
        ) : (
          strongestByExercise.map(([exercise, weight]) => (
            <View
              key={exercise}
              style={{
                borderRadius: Radius.md,
                padding: Spacing.sm,
                marginBottom: Spacing.xs,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.section}>{exercise}</Text>
              <Text style={Typography.secondary}>Best: {weight} kg</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

