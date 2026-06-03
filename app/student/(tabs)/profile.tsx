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
import {
  useI18n,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from "../../../context/I18nContext";
import { useUnits } from "../../../context/UnitsContext";
import { workoutService } from "../../../services/workoutService";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography, FontSizes } from "../../../theme/typography";
import { formatDateFull } from "../../../utils/formatLocale";
import { toMs } from "../../../utils/dateConvert";
import { getUserInitials } from "../../../utils/userDisplay";

export default function StudentProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { unit, setUnit } = useUnits();
  const insets = useSafeAreaInsets();

  const [statsLoading, setStatsLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fullName = useMemo(() => {
    const n = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    return n || "—";
  }, [user?.firstName, user?.lastName]);

  const initials = useMemo(
    () => getUserInitials(user ?? null, "S"),
    [user]
  );

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const history = await workoutService.getWorkoutHistory(user.id);
        if (cancelled) return;
        setLogs(Array.isArray(history) ? history : []);
      } catch (e: unknown) {
        if (cancelled) return;
        setStatsError(e instanceof Error ? e.message : t("failedToLoad"));
        setLogs([]);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, t]);

  const metaLine = useMemo(() => {
    if (statsLoading || statsError) return null;
    const count = logs.length;
    const lastMs = count
      ? toMs(
          (logs[0] as { completedAt?: string; date?: string })?.completedAt ??
          (logs[0] as { date?: string })?.date
        )
      : 0;
    const lastDate = lastMs > 0 ? formatDateFull(lastMs, locale) : "—";
    return t(count === 1 ? "workoutsLogged_one" : "workoutsLogged_other", { count, date: lastDate });
  }, [statsLoading, statsError, logs, locale, t]);

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

  const openUnitPicker = () => {
    Alert.alert(t("measurementUnits"), undefined, [
      {
        text: t("units_kg") + (unit === "kg" ? " ✓" : ""),
        onPress: () => setUnit("kg"),
      },
      {
        text: t("units_lb") + (unit === "lb" ? " ✓" : ""),
        onPress: () => setUnit("lb"),
      },
      { text: t("cancel"), style: "cancel" as const },
    ]);
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
          {/* Header */}
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
            <Text style={{ ...Typography.title, fontSize: FontSizes.h3 }}>{t("settings")}</Text>
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
                borderRadius: Radius.xl,
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

          {/* Profile card */}
          <SettingsProfileCard
            fullName={fullName}
            email={user.email ?? ""}
            roleLabel={
              user.role === "coach"
                ? t("roleCoach")
                : user.role === "athlete"
                ? t("roleAthlete")
                : t("roleStudent")
            }
            initials={initials}
            statsLoading={statsLoading}
            metaLine={metaLine}
            photoURL={user.photoURL}
            onEditProfile={() => router.push("/(profile)/edit")}
          />

          {statsError ? (
            <Text style={{ ...Typography.secondary, color: Colors.danger, marginBottom: Spacing.sm }}>
              {statsError}
            </Text>
          ) : null}

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
              subtitle={unit === "lb" ? t("unitsActiveSubtitle_lb") : t("unitsActiveSubtitle_kg")}
              onPress={openUnitPicker}
            />
            <SettingsRow
              icon="notifications-outline"
              title={t("notifications")}
              subtitle={t("notificationsSubtitleStudent")}
              showDivider={false}
              onPress={() =>
                Alert.alert(t("notifications"), t("notificationPrefsComing"), [
                  { text: t("ok"), style: "default" },
                ])
              }
            />
          </SettingsSection>

          <SettingsSection title={t("training")}>
            <SettingsRow
              icon="barbell-outline"
              title={t("myWorkouts")}
              subtitle={t("myWorkoutsSubtitle")}
              onPress={() => router.push("/student/workouts")}
            />
            <SettingsRow
              icon="stats-chart-outline"
              title={t("nav_progress")}
              subtitle={t("progressSubtitle")}
              onPress={() => router.push("/student/progress")}
            />
            <SettingsRow
              icon="time-outline"
              title={t("workoutHistory")}
              subtitle={t("workoutHistorySubtitle")}
              showDivider={false}
              onPress={() => router.push("/student/workoutHistory")}
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
      </View>
    </ScreenLayout>
  );
}
