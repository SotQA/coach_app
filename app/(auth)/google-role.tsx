import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { UserRole } from "../../types/User";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

const PRESS_SCALE = 0.97;

function RoleCard({
  value,
  title,
  subtitle,
  icon,
  selected,
  submitting,
  onSelect,
}: {
  value: UserRole;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  selected: boolean;
  submitting: boolean;
  onSelect: (v: UserRole) => void;
}) {
  const selectScale = useSharedValue(1);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    selectScale.value = withSpring(selected ? 1.02 : 1);
  }, [selected, selectScale]);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: selectScale.value * pressScale.value }],
  }));

  return (
    <Pressable
      disabled={submitting}
      onPress={() => onSelect(value)}
      onPressIn={() => { if (!submitting) pressScale.value = withSpring(PRESS_SCALE); }}
      onPressOut={() => { pressScale.value = withSpring(1); }}
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.md,
            padding: Spacing.md,
            borderRadius: Radius.lg,
            borderWidth: 2,
            borderColor: selected ? Colors.primary : Colors.border,
            backgroundColor: selected ? Colors.primaryGlow : Colors.surface,
            marginBottom: Spacing.sm,
            ...(Platform.OS === "ios"
              ? { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: selected ? 0.2 : 0.12, shadowRadius: 10 }
              : { elevation: selected ? 4 : 2 }),
          },
          cardAnim,
        ]}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: Radius.md,
            backgroundColor: selected ? "rgba(212,255,68,0.2)" : Colors.card,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: selected ? Colors.primary : Colors.border,
          }}
        >
          <Ionicons name={icon} size={26} color={selected ? Colors.primary : Colors.textMuted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Typography.section, fontSize: 17, fontWeight: "800" }}>{title}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4, lineHeight: 20 }}>
            {subtitle}
          </Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={26} color={Colors.primary} /> : null}
      </Animated.View>
    </Pressable>
  );
}

function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(PRESS_SCALE); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          {
            width: 44,
            height: 44,
            borderRadius: Radius.md,
            backgroundColor: Colors.card,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: "center",
            justifyContent: "center",
          },
          anim,
        ]}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.text} />
      </Animated.View>
    </Pressable>
  );
}

export default function GoogleRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingGoogleUser, completeGoogleSignup, cancelGoogleSignup } = useAuth();
  const { t } = useI18n();

  const [role, setRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingGoogleUser) {
    return <Redirect href="/login" />;
  }

  const handleBack = async () => {
    await cancelGoogleSignup();
    router.replace("/login");
  };

  const handleContinue = async () => {
    if (!role) {
      setError(t("errorSelectRole"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await completeGoogleSignup(role);
    } catch (e: any) {
      setError(e.message ?? t("failedToSignup"));
      setSubmitting(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.lg }}>
        <BackButton onPress={handleBack} label={t("back")} />
        <View style={{ marginLeft: Spacing.sm }}>
          <Text style={{ ...Typography.title, fontSize: 20 }}>{t("stepYourRole")}</Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.lg,
          padding: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.border,
          ...(Platform.OS === "ios"
            ? { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16 }
            : { elevation: 6 }),
        }}
      >
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
          {t("howWillYouUse")}
        </Text>

        <RoleCard
          value="coach"
          title={t("roleCoach")}
          subtitle={t("roleCoachDesc")}
          icon="school-outline"
          selected={role === "coach"}
          submitting={submitting}
          onSelect={(v) => { setRole(v); setError(null); }}
        />
        <RoleCard
          value="student"
          title={t("roleStudent")}
          subtitle={t("roleStudentDesc")}
          icon="barbell-outline"
          selected={role === "student"}
          submitting={submitting}
          onSelect={(v) => { setRole(v); setError(null); }}
        />
        <RoleCard
          value="athlete"
          title={t("roleAthlete")}
          subtitle={t("roleAthleteDesc")}
          icon="fitness-outline"
          selected={role === "athlete"}
          submitting={submitting}
          onSelect={(v) => { setRole(v); setError(null); }}
        />

        <PrimaryButton
          title={submitting ? "" : t("continue")}
          onPress={handleContinue}
          loading={submitting}
          disabled={submitting}
        />

        {error ? (
          <Text style={{ ...Typography.secondary, color: Colors.danger, marginTop: Spacing.md, fontWeight: "600" }}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
