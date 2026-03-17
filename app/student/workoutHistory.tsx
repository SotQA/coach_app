import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { workoutService } from "../../services/workoutService";
import type { WorkoutLog } from "../../types/Workout";
import { PrimaryButton } from "../../components/PrimaryButton";

// Displays the student's historical workout logs in a simple list.
export default function WorkoutHistory() {
  const router = useRouter();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const user = await authService.getCurrentUserWithRole();
        if (!user || user.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }
        const history = await workoutService.getWorkoutHistory(user.id);
        setLogs(history);
      } catch (e: any) {
        setError(e.message ?? "Failed to load workout history.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
        <Text style={{ color: "#FCA5A5", marginBottom: 8 }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: "#0F172A" }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          marginBottom: 12,
          color: "#F9FAFB",
        }}
      >
        Workout History
      </Text>
      {logs.length === 0 ? (
        <Text style={{ color: "#9CA3AF" }}>No logs yet.</Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                borderRadius: 16,
                padding: 12,
                marginBottom: 8,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ fontWeight: "600", color: "#F9FAFB" }}>
                {item.exercise}
              </Text>
              <Text style={{ color: "#9CA3AF" }}>
                {item.sets} sets x {item.reps} reps
                {item.weight ? ` @ ${item.weight}kg` : ""}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 4 }}>
                {new Date(item.date).toLocaleString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

