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
import { workoutService } from "../../../services/workoutService";
import type { WorkoutLog } from "../../../types/Workout";
import { Colors } from "../../../theme/colors";
import { Spacing } from "../../../theme/spacing";
import { Typography } from "../../../theme/typography";
import { formatDateFull } from "../../../utils/formatLocale";
import { toMs } from "../../../utils/dateConvert";

function initialsFromUser(user: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!user) return "S";
  const a = user.firstName?.trim()?.[0] ?? "";
  const b = user.lastName?.trim()?.[0] ?? "";
  const s = `${a}${b}`.toUpperCase();
  return s || "S";
}

export default function StudentProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
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
        const msg = e instanceof Error ? e.message : t("failedToLoad");
        setStatsError(msg);
        setLogs([]);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const metaLine = useMemo(() => {
    if (statsLoading || statsError) return null;
    const count = logs.length;
    const lastMs = count
      ? toMs((logs[0] as { completedAt?: string; date?: string })?.completedAt ?? (logs[0] as { date?: string })?.date)
      : 0;
    const lastDate = lastMs > 0 ? formatDateFull(lastMs, locale) : "—";
    return t(count === 1 ? "workoutsLogged_one" : "workoutsLogged_other", { count, date: lastDate });
  }, [statsLoading, statsError, logs, locale, t]);

  const sexLabel = user?.sex
    ? String(user.sex).charAt(0).toUpperCase() + String(user.sex).slice(1)
    : "—";

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
            roleLabel={t("roleStudent")}
            initials={initials}
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
              subtitle={t("notificationsSubtitleStudent")}
              showDivider={false}
              onPress={() =>
                Alert.alert(t("notifications"), t("notificationPrefsComing"), [
                  { text: t("ok"), style: "default" },
                ])
              }
            />
          </SettingsSection>

          <SettingsSection title={t("yourProfile")}>
            <SettingsRow
              icon="calendar-outline"
              title={t("dateOfBirth")}
              subtitle={user.dateOfBirth?.trim() ? user.dateOfBirth : t("notSet")}
              onPress={() =>
                Alert.alert(
                  t("dateOfBirth"),
                  user.dateOfBirth?.trim() ? user.dateOfBirth : t("notSet"),
                  [{ text: t("ok"), style: "default" }]
                )
              }
            />
            <SettingsRow
              icon="person-outline"
              title={t("sex")}
              subtitle={sexLabel === "—" ? t("notSet") : sexLabel}
              showDivider={false}
              onPress={() =>
                Alert.alert(
                  t("sex"),
                  sexLabel === "—" ? t("notSet") : sexLabel,
                  [{ text: t("ok"), style: "default" }]
                )
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
