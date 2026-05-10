import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenLayout } from "../../../components/ScreenLayout";
import { Colors } from "../../../theme/colors";
import { Radius, Spacing } from "../../../theme/spacing";
import { Typography, FontSizes } from "../../../theme/typography";
import { useAuth } from "../../../context/AuthContext";
import {
  useI18n,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type SupportedLocale,
} from "../../../context/I18nContext";
import { useUnits } from "../../../context/UnitsContext";
import { ExerciseLibraryModal } from "../../../components/ExerciseLibraryModal";
import { SettingsSection } from "../../../components/settings/SettingsSection";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useState } from "react";

export default function CoachProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { unit, setUnit } = useUnits();
  const insets = useSafeAreaInsets();
  const [libraryOpen, setLibraryOpen] = useState(false);

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

          <SettingsSection title={t("appPreferences")}>
            <SettingsRow
              icon="person-circle-outline"
              title={t("editProfile")}
              subtitle={`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || (user.email ?? undefined)}
              onPress={() => router.push("/(profile)/edit")}
            />
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
