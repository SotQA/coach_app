import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { studentService } from "../../../services/studentService";
import { workoutService } from "../../../services/workoutService";
import type { StudentSummary } from "../../../types/StudentSummary";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { ScreenLayout } from "../../../components/ScreenLayout";

function coachDisplayName(user: { firstName: string; lastName: string } | null): string {
  if (!user) return "Coach";
  const n = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return n || "Coach";
}

function initials(user: { firstName: string; lastName: string } | null): string {
  if (!user) return "C";
  const a = user.firstName?.trim()?.[0] ?? "";
  const b = user.lastName?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "C";
}

export default function CoachDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [workoutsCompletedToday, setWorkoutsCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayLine = useMemo(() => {
    const d = new Date();
    return `Here's what's happening today, ${d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}.`;
  }, []);

  useEffect(() => {
    if (!user || user.role !== "coach") {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        setError(null);
        const data = await studentService.getStudentsForCoach(user.id);
        setStudents(data);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const startMs = start.getTime();
        const endMs = end.getTime();

        const logsByStudent = await Promise.all(
          data.map(async (s) => {
            try {
              return await workoutService.getWorkoutHistory(s.id);
            } catch {
              return [];
            }
          })
        );
        const count = logsByStudent
          .flat()
          .filter((l: any) => {
            const when = l?.completedAt ?? l?.date;
            if (!when) return false;
            const ms = new Date(String(when)).getTime();
            return Number.isFinite(ms) && ms >= startMs && ms < endMs;
          }).length;
        setWorkoutsCompletedToday(count);
      } catch (e: any) {
        console.error("[coach/dashboard] load error", e);
        setError(e.message ?? "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  if (loading) {
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
          <ActivityIndicator color={Colors.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (error) {
    return (
      <ScreenLayout>
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
      </ScreenLayout>
    );
  }

  const name = coachDisplayName(user);
  const ini = initials(user);

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.md,
            paddingBottom: Spacing.xl,
            // Give the header (avatar + name) more breathing room below the notch.
            paddingTop: Spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: Spacing.md,
              marginBottom: Spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile settings"
                onPress={() => router.push("/coach/profile")}
                style={({ pressed }) => ({
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  borderWidth: 2,
                  borderColor: Colors.primary,
                  backgroundColor: Colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ ...Typography.section, fontSize: 18, fontWeight: "800" }}>{ini}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.title, fontSize: 22 }}>{name}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.primary, marginTop: 2, fontWeight: "600" }}>
                  Active Now
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.text} />
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.danger,
                }}
              />
            </Pressable>
          </View>

          <Text style={{ ...Typography.title, fontSize: 26, marginBottom: 4 }}>Overview</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.md }}>
            {todayLine}
          </Text>

          <View
            style={{
              width: "100%",
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.lg,
              marginBottom: Spacing.md,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: Colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: Spacing.md,
                  }}
                >
                  <Ionicons name="people" size={22} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 40, fontWeight: "800", color: Colors.text }}>{students.length}</Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  Total Students
                </Text>
              </View>

              <View
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  backgroundColor: Colors.border,
                  opacity: 0.8,
                }}
              />

              <View style={{ flex: 1 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: Colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: Spacing.md,
                  }}
                >
                  <Ionicons name="barbell-outline" size={22} color={Colors.primary} />
                </View>
                <Text style={{ fontSize: 40, fontWeight: "800", color: Colors.text }}>
                  {workoutsCompletedToday}
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
                  Workouts Completed
                </Text>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                  Today
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "stretch",
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}
          >
            <Pressable
              onPress={() =>
                Alert.alert("Coming soon", "Start Log will be available in a future update.")
              }
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: 16,
                paddingHorizontal: Spacing.sm,
                borderRadius: Radius.lg,
                backgroundColor: Colors.primary,
                opacity: pressed ? 0.92 : 1,
                ...(Platform.OS === "ios"
                  ? {
                      shadowColor: Colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                    }
                  : { elevation: 8 }),
              })}
            >
              <Ionicons name="play" size={18} color={Colors.onPrimary} />
              <Text style={{ ...Typography.section, fontWeight: "800", color: Colors.onPrimary }}>
                Start Log
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/coach/createStudent")}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: Spacing.sm,
                paddingVertical: 16,
                paddingHorizontal: Spacing.sm,
                borderRadius: Radius.lg,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Ionicons name="person-add-outline" size={22} color={Colors.primary} />
              <Text style={{ ...Typography.section, fontWeight: "700", color: Colors.text }}>
                Add Student
              </Text>
            </Pressable>
          </View>

          {/* Students list removed (available in Students tab). */}
        </ScrollView>
      </View>
    </ScreenLayout>
  );
}
