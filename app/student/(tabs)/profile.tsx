import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { SettingsProfileCard } from "../../../components/settings/SettingsProfileCard";
import { SettingsSection } from "../../../components/settings/SettingsSection";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useAuth } from "../../../context/AuthContext";
import { workoutService } from "../../../services/workoutService";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";

function initialsFromUser(user: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!user) return "S";
  const a = user.firstName?.trim()?.[0] ?? "";
  const b = user.lastName?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "S";
}

const toMs = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  return 0;
};

export default function StudentProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [statsLoading, setStatsLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    const n = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    return n || "—";
  }, [user?.firstName, user?.lastName]);

  const initials = useMemo(() => initialsFromUser(user ?? null), [user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const history = await workoutService.getWorkoutHistory(user.id);
        if (cancelled) return;
        setLogs(Array.isArray(history) ? history : []);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load stats.";
        setStatsError(msg);
        setLogs([]);
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

  const workoutsCompleted = logs.length;
  const lastMs = logs.length ? toMs((logs[0] as { completedAt?: string; date?: string })?.completedAt ?? (logs[0] as { date?: string })?.date) : 0;
  const lastWorkoutDate =
    lastMs > 0 ? new Date(lastMs).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  const metaLine =
    statsLoading || statsError
      ? null
      : `${workoutsCompleted} ${workoutsCompleted === 1 ? "workout" : "workouts"} logged · Last: ${lastWorkoutDate}`;

  const sexLabel = user.sex ? String(user.sex).charAt(0).toUpperCase() + String(user.sex).slice(1) : "—";

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
            <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>{statsError}</Text>
          ) : null}

          <SettingsProfileCard
            fullName={fullName}
            email={user.email ?? ""}
            roleLabel="Student"
            initials={initials}
            statsLoading={statsLoading}
            metaLine={metaLine}
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
              subtitle="Workout reminders, plan updates"
              showDivider={false}
              onPress={() =>
                Alert.alert("Notifications", "Notification preferences will be available in a future update.", [
                  { text: "OK", style: "default" },
                ])
              }
            />
          </SettingsSection>

          <SettingsSection title="Your profile">
            <SettingsRow
              icon="calendar-outline"
              title="Date of birth"
              subtitle={user.dateOfBirth?.trim() ? user.dateOfBirth : "Not set"}
              onPress={() =>
                Alert.alert(
                  "Date of birth",
                  user.dateOfBirth?.trim() ? user.dateOfBirth : "Not set in your profile yet.",
                  [{ text: "OK", style: "default" }]
                )
              }
            />
            <SettingsRow
              icon="person-outline"
              title="Sex"
              subtitle={sexLabel}
              showDivider={false}
              onPress={() => Alert.alert("Sex", sexLabel === "—" ? "Not set in your profile yet." : sexLabel, [{ text: "OK", style: "default" }])}
            />
          </SettingsSection>

          <SettingsSection title="Training">
            <SettingsRow
              icon="barbell-outline"
              title="My workouts"
              subtitle="Plans assigned by your coach"
              onPress={() => router.push("/student/workouts")}
            />
            <SettingsRow
              icon="stats-chart-outline"
              title="Progress"
              subtitle="PRs and strength trends"
              onPress={() => router.push("/student/progress")}
            />
            <SettingsRow
              icon="time-outline"
              title="Workout history"
              subtitle="Past sessions and logs"
              showDivider={false}
              onPress={() => router.push("/student/workoutHistory")}
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
      </View>
    </ScreenLayout>
  );
}
