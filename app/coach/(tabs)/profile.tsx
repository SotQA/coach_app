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
import {
  useI18n,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from "../../../context/I18nContext";
import { studentService } from "../../../services/studentService";
import { ExerciseLibraryModal } from "../../../components/ExerciseLibraryModal";
import { SettingsProfileCard } from "../../../components/settings/SettingsProfileCard";
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
  const { t, locale, setLocale } = useI18n();
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
        const msg = e instanceof Error ? e.message : t("failedToLoad");
        setStatsError(msg);
        setStudentCount(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const metaLine = useMemo(() => {
    if (statsLoading || studentCount == null) return null;
    const count = studentCount;
    return t(count === 1 ? "studentsOnRoster_one" : "studentsOnRoster_other", { count });
  }, [statsLoading, studentCount, t]);

  const openLanguagePicker = () => {
    Alert.alert(
      t("selectLanguage"),
      undefined,
      [
        ...SUPPORTED_LOCALES.map((loc) => ({
          text: LOCALE_LABELS[loc] + (loc === locale ? " ✓" : ""),
          onPress: () => setLocale(loc as SupportedLocale),
        })),
        { text: t("cancel"), style: "cancel" as const },
      ]
    );
  };

  if (!user) return null;

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
            <Text style={{ ...Typography.title, fontSize: 22 }}>{t("settings")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("notifications")}
              onPress={() =>
                Alert.alert(t("notifications"), t("notificationPrefsComing"), [
                  { text: t("ok"), style: "default" },
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

          <SettingsProfileCard
            fullName={fullName}
            email={user.email ?? ""}
            roleLabel={t("roleCoach")}
            initials={coachInitials}
            statsLoading={statsLoading}
            metaLine={metaLine}
            onEditProfile={() =>
              Alert.alert(t("comingSoon"), t("profileEditComingSoon"), [
                { text: t("ok"), style: "default" },
              ])
            }
          />

          <SettingsSection title={t("appPreferences")}>
            <SettingsRow
              icon="language-outline"
              title={t("language")}
              subtitle={LOCALE_LABELS[locale]}
              onPress={openLanguagePicker}
            />
            <SettingsRow
              icon="scale-outline"
              title={t("measurementUnits")}
              subtitle={t("measurementUnitsSubtitle")}
              onPress={() =>
                Alert.alert(t("measurementUnits"), t("measurementUnitsComing"), [
                  { text: t("ok"), style: "default" },
                ])
              }
            />
            <SettingsRow
              icon="moon-outline"
              title={t("theme")}
              subtitle={t("themeDark")}
              onPress={() =>
                Alert.alert(t("theme"), t("themeComing"), [
                  { text: t("ok"), style: "default" },
                ])
              }
            />
            <SettingsRow
              icon="notifications-outline"
              title={t("notifications")}
              subtitle={t("notificationsSubtitleCoach")}
              showDivider={false}
              onPress={() =>
                Alert.alert(t("notifications"), t("notificationPrefsComing"), [
                  { text: t("ok"), style: "default" },
                ])
              }
            />
          </SettingsSection>

          <SettingsSection title={t("coachingTools")}>
            <SettingsRow
              icon="barbell-outline"
              title={t("exerciseLibrary")}
              subtitle={t("exerciseLibrarySubtitle")}
              onPress={() => setLibraryOpen(true)}
            />
            <SettingsRow
              icon="people-circle-outline"
              title={t("trainingGroups")}
              subtitle={t("trainingGroupsSubtitle")}
              onPress={() => router.push("/coach/students")}
            />
            <SettingsRow
              icon="people-outline"
              title={t("studentManagement")}
              subtitle={t("studentManagementSubtitle")}
              onPress={() => router.push("/coach/students")}
            />
            <SettingsRow
              icon="stats-chart-outline"
              title={t("progressAnalytics")}
              subtitle={t("progressAnalyticsSubtitle")}
              showDivider={false}
              onPress={() => router.push("/coach/progress")}
            />
          </SettingsSection>

          <SettingsSection title={t("account")} style={{ marginTop: Spacing.sm }}>
            <SettingsRow
              icon="log-out-outline"
              title={t("logOut")}
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
          onAddExercise={() => {}}
        />
      </View>
    </ScreenLayout>
  );
}
