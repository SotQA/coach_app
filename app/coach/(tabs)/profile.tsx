import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { useAuth } from "../../../context/AuthContext";
import { studentService } from "../../../services/studentService";
import { ExerciseLibraryModal } from "../../../components/ExerciseLibraryModal";
import { CoachProfileCard } from "../../../components/settings/CoachProfileCard";
import { SettingsSection } from "../../../components/settings/SettingsSection";
import { SettingsRow } from "../../../components/settings/SettingsRow";

function initialsFromUser(user: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!user) return "C";
  const a = user.firstName?.trim()?.[0] ?? "";
  const b = user.lastName?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "C";
}

export default function CoachProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [statsLoading, setStatsLoading] = useState(true);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const fullName = useMemo(() => {
    const n = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    return n || "—";
  }, [user?.firstName, user?.lastName]);

  const coachInitials = useMemo(() => initialsFromUser(user ?? null), [user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const students = await studentService.getStudentsForCoach(user.id);
        if (cancelled) return;
        setStudentCount(Array.isArray(students) ? students.length : 0);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load stats.";
        setStatsError(msg);
        setStudentCount(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return null;
  }

  return (
    <ScreenLayout>
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.md,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.md,
              paddingBottom: Spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <Text style={{ ...Typography.title, fontSize: 22 }}>Settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notification preferences"
              onPress={() =>
                Alert.alert("Notifications", "Notification preferences will be available in a future update.", [
                  { text: "OK", style: "default" },
                ])
              }
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          {statsError ? (
            <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>
              {statsError}
            </Text>
          ) : null}

          <CoachProfileCard
            fullName={fullName}
            email={user.email ?? ""}
            roleLabel="Coach"
            initials={coachInitials}
            studentCount={studentCount}
            statsLoading={statsLoading}
            onEditProfile={() =>
              Alert.alert("Coming soon", "Profile editing isn’t available yet.", [{ text: "OK", style: "default" }])
            }
          />

          <SettingsSection title="App preferences">
            <SettingsRow
              icon="scale-outline"
              title="Measurement units"
              subtitle="kg / lbs"
              onPress={() =>
                Alert.alert("Measurement units", "Unit preferences will be available in a future update.", [
                  { text: "OK", style: "default" },
                ])
              }
            />
            <SettingsRow
              icon="moon-outline"
              title="Theme"
              subtitle="Dark mode"
              onPress={() =>
                Alert.alert("Theme", "Additional themes will be available in a future update.", [
                  { text: "OK", style: "default" },
                ])
              }
            />
            <SettingsRow
              icon="notifications-outline"
              title="Notifications"
              subtitle="Workout reminders, student completion alerts"
              showDivider={false}
              onPress={() =>
                Alert.alert("Notifications", "Notification preferences will be available in a future update.", [
                  { text: "OK", style: "default" },
                ])
              }
            />
          </SettingsSection>

          <SettingsSection title="Coaching tools">
            <SettingsRow
              icon="barbell-outline"
              title="Exercise library"
              subtitle="Browse and manage custom exercises"
              onPress={() => setLibraryOpen(true)}
            />
            <SettingsRow
              icon="people-circle-outline"
              title="Training groups"
              subtitle="Assign splits & schedules — open a student to manage groups"
              onPress={() => router.push("/coach/students")}
            />
            <SettingsRow
              icon="people-outline"
              title="Student management"
              subtitle="Roster, workout plans, and profiles"
              onPress={() => router.push("/coach/students")}
            />
            <SettingsRow
              icon="stats-chart-outline"
              title="Progress analytics"
              subtitle="Trends, volume, and coaching signals"
              showDivider={false}
              onPress={() => router.push("/coach/progress")}
            />
          </SettingsSection>

          <SettingsSection title="Account" style={{ marginTop: Spacing.sm }}>
            <SettingsRow
              icon="log-out-outline"
              title="Log out"
              onPress={() => logout()}
              destructive
              showChevron={false}
              showDivider={false}
            />
          </SettingsSection>
        </ScrollView>

        <ExerciseLibraryModal
          visible={libraryOpen}
          coachId={user.id}
          onClose={() => setLibraryOpen(false)}
          onAddExercise={() => {
            /* Selection is handled inside the modal (usage + close). */
          }}
        />
      </View>
    </ScreenLayout>
  );
}
