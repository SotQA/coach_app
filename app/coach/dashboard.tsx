import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../../services/authService";
import { studentService } from "../../services/studentService";
import type { StudentSummary } from "../../types/StudentSummary";
import type { AppUser } from "../../types/User";
import { StudentCard } from "../../components/StudentCard";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

// Coach dashboard:
// - Loads the current coach user
// - Fetches and displays their student list
// - Allows navigation to create student or create workout plan flows
export default function CoachDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
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
        <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
        <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
      </View>
    );
  }

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
          <Text
            style={{
              ...Typography.title,
              fontSize: 22,
              marginBottom: 4,
            }}
          >
            Welcome, Coach
          </Text>
          <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
            Manage your students and assign workout plans.
          </Text>
          <PrimaryButton
            title="Create New Student"
            onPress={() => router.push("/coach/createStudent")}
          />
          <View style={{ marginTop: Spacing.sm }}>
            <PrimaryButton
              title="Logout"
              onPress={async () => {
                await logout();
                router.replace("/login");
              }}
              style={{ backgroundColor: "#1F2937" }}
            />
          </View>
        </View>

        <Text
          style={{
            ...Typography.section,
            marginBottom: Spacing.xs,
          }}
        >
          Your Students
        </Text>
        {students.length === 0 ? (
          <Text style={Typography.secondary}>
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

