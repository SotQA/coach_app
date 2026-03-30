import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { studentService } from "../../../services/studentService";
import type { StudentSummary } from "../../../types/StudentSummary";
import { StudentCard } from "../../../components/StudentCard";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";

export default function CoachStudents() {
  const router = useRouter();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "coach") {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      console.log("[coach/students] load start");
      setLoading(true);
      try {
        setError(null);
        console.log("[coach/students] currentUser.id", user.id);
        const data = await studentService.getStudentsForCoach(user.id);
        console.log("[coach/students] students", data.length);
        setStudents(data);
      } catch (e: any) {
        console.error("[coach/students] load error", e);
        setError(e.message ?? "Failed to load students.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
          <ActivityIndicator />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
        <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: Colors.bg }}>
          <Text style={{ color: Colors.danger, marginBottom: Spacing.xs }}>{error}</Text>
          <PrimaryButton title="Go to Login" onPress={() => router.replace("/login")} />
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.md,
            paddingBottom: Spacing.lg,
            paddingTop: Spacing.lg,
          }}
        >
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
            <Text style={{ ...Typography.title, fontSize: 22, marginBottom: 4 }}>Students</Text>
            <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>
              Tap a student to view plans and progress.
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                marginBottom: Spacing.sm,
              }}
            >
              <View
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: Spacing.sm,
                  borderRadius: Radius.pill,
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ ...Typography.section, fontWeight: "800" }}>{students.length}</Text>
                <Text style={{ ...Typography.secondary, marginTop: 2 }}>Students</Text>
              </View>
            </View>

            <PrimaryButton title="Create Student" onPress={() => router.push("/coach/createStudent")} />
          </View>

          {students.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.card,
                borderRadius: Radius.md,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={Typography.secondary}>
                No students yet. Create your first student to start assigning workout plans.
              </Text>
            </View>
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
    </ScreenLayout>
  );
}

