import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { useAuth } from "../../../context/AuthContext";
import { ProfileCard } from "../../../components/profile/ProfileCard";
import { InfoRow } from "../../../components/profile/InfoRow";
import { studentService } from "../../../services/studentService";

export default function CoachProfile() {
  const { user, logout } = useAuth();
  const [statsLoading, setStatsLoading] = useState(true);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [statsError, setStatsError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const fullName = useMemo(() => {
    const n = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return n || "—";
  }, [user.firstName, user.lastName]);

  const roleLabel = "Coach";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const students = await studentService.getStudentsForCoach(user.id);
        if (cancelled) return;
        setStudentCount(Array.isArray(students) ? students.length : 0);
      } catch (e: any) {
        if (cancelled) return;
        setStatsError(e?.message ?? "Failed to load stats.");
        setStudentCount(0);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <ScreenLayout>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: Spacing.lg,
          paddingTop: Spacing.lg,
        }}
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
          <InfoRow label="Students" value={String(studentCount)} icon="people-outline" showDivider={false} />
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
