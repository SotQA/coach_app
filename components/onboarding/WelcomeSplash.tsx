import { useEffect } from "react";
import { BackHandler, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { useOnboardingTour } from "../../context/OnboardingTourContext";
import { PrimaryButton } from "../PrimaryButton";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import type { UserRole } from "../../types/User";

const ROLE_META: Record<UserRole, { emoji: string; accent: string; greetingKey: string; subKey: string; labelKey: string }> = {
  coach: {
    emoji: "🏋️",
    accent: "#5AC8FA",
    greetingKey: "onboardingWelcomeCoachGreeting",
    subKey: "onboardingWelcomeCoachSub",
    labelKey: "onboardingRoleCoach",
  },
  student: {
    emoji: "💪",
    accent: Colors.primary,
    greetingKey: "onboardingWelcomeStudentGreeting",
    subKey: "onboardingWelcomeStudentSub",
    labelKey: "onboardingRoleStudent",
  },
  athlete: {
    emoji: "🔥",
    accent: "#FF6B9D",
    greetingKey: "onboardingWelcomeAthleteGreeting",
    subKey: "onboardingWelcomeAthleteSub",
    labelKey: "onboardingRoleAthlete",
  },
};

/**
 * Full-screen splash shown once, immediately after registration completes,
 * before the spotlight tour runs. Mounted at the app root (app/_layout.tsx)
 * so it renders on top of whichever screen the post-registration redirect
 * lands on.
 */
export function WelcomeSplash() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { pendingWelcome, hasSeenOnboarding, startTour, skip } = useOnboardingTour();
  const insets = useSafeAreaInsets();

  const visible = Boolean(pendingWelcome && user && !hasSeenOnboarding);

  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = visible ? withTiming(1, { duration: 300 }) : 0;
  }, [visible, opacity]);

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      skip();
      return true;
    });
    return () => sub.remove();
  }, [visible, skip]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible || !user || !pendingWelcome) return null;

  const meta = ROLE_META[user.role];

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.92)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing.xl,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          zIndex: 1000,
          elevation: 1000,
        },
        animStyle,
      ]}
    >
      <Text style={{ fontSize: 56, marginBottom: Spacing.md }}>{meta.emoji}</Text>
      <Text style={{ ...Typography.title, fontSize: 26, marginBottom: Spacing.sm, textAlign: "center" }}>
        {t(meta.greetingKey, { name: pendingWelcome.firstName })}
      </Text>
      <Text
        style={{
          ...Typography.secondary,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: Spacing.xl,
        }}
      >
        {t(meta.subKey).split(t(meta.labelKey)).map((chunk, i, arr) =>
          i < arr.length - 1 ? (
            <Text key={i}>
              {chunk}
              <Text style={{ color: meta.accent, fontWeight: "700" }}>{t(meta.labelKey)}</Text>
            </Text>
          ) : (
            <Text key={i}>{chunk}</Text>
          )
        )}
      </Text>

      <View style={{ width: "100%", maxWidth: 320 }}>
        <PrimaryButton title={t("onboardingShowMeAround")} onPress={() => startTour(user.role)} />
        <View style={{ marginTop: Spacing.md, alignItems: "center" }}>
          <Text
            onPress={skip}
            accessibilityRole="button"
            style={{ ...Typography.secondary, color: Colors.textMuted, padding: Spacing.sm }}
          >
            {t("onboardingSkipTour")}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
