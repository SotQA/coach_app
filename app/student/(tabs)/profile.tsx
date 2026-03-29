import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { useAuth } from "../../../context/AuthContext";
import { ProfileCard } from "../../../components/profile/ProfileCard";
import { InfoRow } from "../../../components/profile/InfoRow";
import { workoutService } from "../../../services/workoutService";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";

export default function StudentProfile() {
  const { user, logout } = useAuth();
  const [statsLoading, setStatsLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const fullName = useMemo(() => {
    const n = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return n || "—";
  }, [user.firstName, user.lastName]);

  const roleLabel = "Student";

  const toMs = (value: any): number => {
    if (!value) return 0;
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isFinite(ms) ? ms : 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date ? d.getTime() : 0;
    }
    return 0;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const history = await workoutService.getWorkoutHistory(user.id);
        if (cancelled) return;
        setLogs(Array.isArray(history) ? history : []);
      } catch (e: any) {
        if (cancelled) return;
        setStatsError(e?.message ?? "Failed to load stats.");
        setLogs([]);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const workoutsCompleted = logs.length;
  const lastMs = logs.length ? toMs((logs[0] as any)?.completedAt ?? (logs[0] as any)?.date) : 0;
  const lastWorkoutDate =
    lastMs > 0 ? new Date(lastMs).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
      >
        <ProfileCard style={{ alignItems: "center", paddingVertical: 20, marginBottom: Spacing.sm }}>
          <Text style={{ ...Typography.title, fontSize: 28, textAlign: "center" }}>{fullName}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 6 }}>{roleLabel}</Text>
        </ProfileCard>

        <ProfileCard title="Personal info" style={{ marginBottom: Spacing.sm }}>
          <InfoRow label="Email" value={user.email} icon="mail-outline" />
          <InfoRow label="Date of Birth" value={user.dateOfBirth} icon="calendar-outline" />
          <InfoRow
            label="Sex"
            value={
              user.sex ? String(user.sex).charAt(0).toUpperCase() + String(user.sex).slice(1) : null
            }
            icon="person-outline"
            showDivider={false}
          />
        </ProfileCard>

        <ProfileCard
          title="Stats"
          right={statsLoading ? <ActivityIndicator /> : null}
          style={{ marginBottom: Spacing.sm }}
        >
          {statsError ? (
            <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>
              {statsError}
            </Text>
          ) : null}
          <InfoRow label="Workouts completed" value={String(workoutsCompleted)} icon="barbell-outline" />
          <InfoRow label="Last workout" value={lastWorkoutDate} icon="time-outline" showDivider={false} />
        </ProfileCard>

        <ProfileCard title="Actions">
          <View style={{ gap: Spacing.sm }}>
            <PrimaryButton
              title="Edit Profile"
              onPress={() => Alert.alert("Coming soon", "Profile editing isn’t available yet.")}
              style={{ backgroundColor: Colors.border }}
            />
            <PrimaryButton
              title="Logout"
              onPress={() => logout()}
              style={{
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: Colors.danger,
              }}
              textStyle={{ color: Colors.danger, fontWeight: "800" }}
            />
          </View>
        </ProfileCard>
      </ScrollView>
    </ScreenLayout>
  );
}
