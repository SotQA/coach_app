import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { AppUser } from "../../types/User";
import { StudentCard } from "../../components/StudentCard";
import { PrimaryButton } from "../../components/PrimaryButton";

// Coach dashboard:
// - Loads the current coach user
// - Fetches and displays their student list
// - Allows navigation to create student or create workout plan flows
export default function CoachDashboard() {
  const router = useRouter();
  const [, setCoach] = useState<AppUser | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      console.log("[coach/dashboard] load start");
      setLoading(true);
      try {
        setError(null);
        const user = await authService.getCurrentUserWithRole();
        console.log("[coach/dashboard] currentUser.id", user?.id);
        if (!user || user.role !== "coach") {
          setError("You must be logged in as a coach.");
          return;
        }
        setCoach(user);
        const data = await studentService.getStudentsForCoach(user.id);
        console.log("[coach/dashboard] students", data.length);
        setStudents(data);
      } catch (e: any) {
        console.error("[coach/dashboard] load error", e);
        setError(e.message ?? "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
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
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              marginBottom: 4,
              color: "#F9FAFB",
            }}
          >
            Welcome, Coach
          </Text>
          <Text style={{ color: "#9CA3AF", marginBottom: 16 }}>
            Manage your students and assign workout plans.
          </Text>
          <PrimaryButton
            title="Create New Student"
            onPress={() => router.push("/coach/createStudent")}
          />
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            marginBottom: 8,
            color: "#E5E7EB",
          }}
        >
          Your Students
        </Text>
        {students.length === 0 ? (
          <Text style={{ color: "#9CA3AF" }}>
            No students yet. Create one to get started.
          </Text>
        ) : (
          <FlatList
            data={students}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StudentCard
                student={item}
                onPress={() =>
                  router.push({
                    pathname: "/coach/studentDetails",
                    params: { studentId: item.id },
                  })
                }
              />
            )}
          />
        )}
      </ScrollView>
    </View>
  );
}

