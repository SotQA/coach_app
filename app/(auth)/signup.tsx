import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Sex, UserRole } from "../../types/User";
import { PrimaryButton } from "../../components/PrimaryButton";
import { InputField } from "../../components/InputField";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

const TOTAL_STEPS = 3;
const PRESS_SCALE = 0.97;

/** Reanimated spring scale on press for `Pressable`s (0.97). */
function SpringPressScale({
  children,
  disabled,
  onPress,
  fullWidth,
  accessibilityRole,
  accessibilityLabel,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  fullWidth?: boolean;
  accessibilityRole?: ComponentProps<typeof Pressable>["accessibilityRole"];
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(PRESS_SCALE);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      <Animated.View style={fullWidth ? [{ width: "100%" }, animStyle] : animStyle}>{children}</Animated.View>
    </Pressable>
  );
}

function parseYMD(value: string): Date | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

function formatYMD(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function validateEmail(e: string): boolean {
  const t = e.trim();
  return Boolean(t && /^\S+@\S+\.\S+$/.test(t));
}

function SignupSexChip({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Sex;
  label: string;
  selected: boolean;
  onSelect: (v: Sex) => void;
}) {
  const pressM = useSharedValue(1);
  const chipAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressM.value }],
  }));
  return (
    <Pressable
      onPress={() => onSelect(value)}
      onPressIn={() => {
        pressM.value = withSpring(PRESS_SCALE);
      }}
      onPressOut={() => {
        pressM.value = withSpring(1);
      }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: Spacing.sm,
            borderWidth: 1,
            borderColor: selected ? Colors.primary : Colors.border,
            borderRadius: Radius.sm,
            backgroundColor: selected ? Colors.primaryGlow : Colors.surface,
            alignItems: "center",
          },
          chipAnim,
        ]}
      >
        <Text style={{ ...Typography.section, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function SignupRoleCard({
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
  const pressMult = useSharedValue(1);

  useEffect(() => {
    selectScale.value = withSpring(selected ? 1.02 : 1);
  }, [selected, selectScale]);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: selectScale.value * pressMult.value }],
  }));

  return (
    <Pressable
      disabled={submitting}
      onPress={() => onSelect(value)}
      onPressIn={() => {
        if (!submitting) pressMult.value = withSpring(PRESS_SCALE);
      }}
      onPressOut={() => {
        pressMult.value = withSpring(1);
      }}
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
              ? {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: selected ? 0.2 : 0.12,
                  shadowRadius: 10,
                }
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

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, loading: authLoading, signup } = useAuth();
  const { t } = useI18n();
  const scrollRef = useRef<KeyboardAwareScrollView | null>(null);
  const trackWidth = Math.max(0, windowWidth - Spacing.lg * 2);
  const barW = useSharedValue((trackWidth * 1) / TOTAL_STEPS);

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [role, setRole] = useState<UserRole | null>(null);
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobDraft, setDobDraft] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const STEP_TITLES = [t("stepYourRole"), t("stepAboutYou"), t("stepAccount")] as const;

  useEffect(() => {
    const w = Math.max(0, windowWidth - Spacing.lg * 2);
    barW.value = withTiming((w * (step + 1)) / TOTAL_STEPS, { duration: 320 });
  }, [step, windowWidth, barW]);

  const barStyle = useAnimatedStyle(() => ({
    width: barW.value,
  }));

  useEffect(() => {
    scrollRef.current?.scrollToPosition(0, 0, true);
  }, [step]);

  const validateRoleStep = useCallback((): string | null => {
    if (role == null) return t("errorSelectRole");
    return null;
  }, [role, t]);

  const validateAboutStep = useCallback((): string | null => {
    if (!firstName.trim()) return t("errorFirstNameRequired");
    if (!lastName.trim()) return t("errorLastNameRequired");
    if (!dateOfBirth.trim()) return t("errorDobRequired");
    return null;
  }, [firstName, lastName, dateOfBirth, t]);

  const validateAccountStep = useCallback((): string | null => {
    if (!validateEmail(email)) return t("errorInvalidEmail");
    if (password.length < 8) return t("errorPasswordMin");
    if (password !== confirmPassword) return t("errorPasswordMatch");
    return null;
  }, [email, password, confirmPassword, t]);

  const goNext = () => {
    setError(null);
    if (step === 0) {
      const err = validateRoleStep();
      if (err) {
        setError(err);
        return;
      }
    }
    if (step === 1) {
      const err = validateAboutStep();
      if (err) {
        setError(err);
        return;
      }
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    setError(null);
    if (step > 0) setStep((s) => s - 1);
    else router.replace("/login");
  };

  const handleCreateAccount = async () => {
    setError(null);
    const eRole = validateRoleStep();
    const eAbout = validateAboutStep();
    const eAccount = validateAccountStep();
    if (eRole || eAbout || eAccount) {
      setError(eRole ?? eAbout ?? eAccount ?? t("errorCompleteSteps"));
      return;
    }
    if (role == null) return;

    setSubmitting(true);
    try {
      await signup(
        email.trim(),
        password,
        role,
        firstName.trim(),
        lastName.trim(),
        dateOfBirth.trim(),
        sex
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("failedToSignup");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const dobValue = dateOfBirth ? parseYMD(dateOfBirth) ?? new Date(2000, 0, 1) : new Date(2000, 0, 1);
  const activeDobValue = dobDraft ?? dobValue;

  const inputStyle = {
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 14,
    backgroundColor: Colors.surface,
  } as const;

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, paddingTop: insets.top }}>
      <KeyboardAwareScrollView
        ref={(r) => { scrollRef.current = r; }}
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingTop: Spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={32}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
          <SpringPressScale
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={goBack}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: Radius.md,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                alignItems: "center",
                justifyContent: "center",
                marginRight: Spacing.sm,
              }}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </View>
          </SpringPressScale>
          <View style={{ flex: 1 }}>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "700", fontSize: FontSizes.caption }}>
              {t("stepOf", { n: step + 1, total: TOTAL_STEPS })}
            </Text>
            <Text style={{ ...Typography.title, fontSize: 20, marginTop: 2 }}>{STEP_TITLES[step]}</Text>
          </View>
        </View>

        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: Colors.border,
            overflow: "hidden",
            marginBottom: Spacing.lg,
          }}
        >
          <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: Colors.primary }, barStyle]} />
        </View>

        <View key={step} style={{ width: "100%" }}>
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
            {step === 0 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  {t("howWillYouUse")}
                </Text>
                <SignupRoleCard
                  value="coach"
                  title={t("roleCoach")}
                  subtitle={t("roleCoachDesc")}
                  icon="school-outline"
                  selected={role === "coach"}
                  submitting={submitting}
                  onSelect={(v) => {
                    setRole(v);
                    setError(null);
                  }}
                />
                <SignupRoleCard
                  value="student"
                  title={t("roleStudent")}
                  subtitle={t("roleStudentDesc")}
                  icon="barbell-outline"
                  selected={role === "student"}
                  submitting={submitting}
                  onSelect={(v) => {
                    setRole(v);
                    setError(null);
                  }}
                />
                <SignupRoleCard
                  value="athlete"
                  title={t("roleAthlete")}
                  subtitle={t("roleAthleteDesc")}
                  icon="fitness-outline"
                  selected={role === "athlete"}
                  submitting={submitting}
                  onSelect={(v) => {
                    setRole(v);
                    setError(null);
                  }}
                />
                <PrimaryButton title={t("continue")} onPress={goNext} disabled={submitting} />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  {t("tellAboutYou")}
                </Text>
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>{t("firstName")}</Text>
                <TextInput
                  placeholder={t("firstName")}
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>{t("lastName")}</Text>
                <TextInput
                  placeholder={t("lastName")}
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>{t("dateOfBirth")}</Text>
                <SpringPressScale fullWidth onPress={() => setDobPickerOpen(true)}>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: Radius.sm,
                      marginBottom: Spacing.md,
                      padding: 14,
                      backgroundColor: Colors.surface,
                    }}
                  >
                    <Text style={[Typography.body, { color: dateOfBirth ? Colors.text : Colors.textMuted }]}>
                      {dateOfBirth ? dateOfBirth : t("selectDate")}
                    </Text>
                  </View>
                </SpringPressScale>

                {dobPickerOpen ? (
                  <DateTimePicker
                    value={activeDobValue}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) setDobDraft(selectedDate);
                      if (Platform.OS === "android") {
                        if (event?.type === "set" && selectedDate) {
                          setDateOfBirth(formatYMD(selectedDate));
                          setDobDraft(null);
                          setDobPickerOpen(false);
                        } else if (event?.type === "dismissed") {
                          setDobDraft(null);
                          setDobPickerOpen(false);
                        }
                      }
                    }}
                  />
                ) : null}

                {dobPickerOpen && Platform.OS === "ios" ? (
                  <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md, alignItems: "stretch" }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <PrimaryButton
                        title={t("apply")}
                        onPress={() => {
                          if (!dobDraft) return;
                          setDateOfBirth(formatYMD(dobDraft));
                          setDobDraft(null);
                          setDobPickerOpen(false);
                        }}
                      />
                    </View>
                    <SpringPressScale
                      onPress={() => {
                        setDobDraft(null);
                        setDobPickerOpen(false);
                      }}
                    >
                      <View
                        style={{
                          flexShrink: 0,
                          justifyContent: "center",
                          paddingVertical: 15,
                          paddingHorizontal: Spacing.md,
                          borderRadius: Radius.lg,
                          backgroundColor: Colors.surface,
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      >
                        <Text style={{ ...Typography.section, color: Colors.textMuted, fontWeight: "700" }}>
                          {t("cancel")}
                        </Text>
                      </View>
                    </SpringPressScale>
                  </View>
                ) : null}

                <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs, fontWeight: "600" }}>{t("sex")}</Text>
                <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
                  <SignupSexChip value="male" label={t("male")} selected={sex === "male"} onSelect={setSex} />
                  <SignupSexChip value="female" label={t("female")} selected={sex === "female"} onSelect={setSex} />
                </View>
                <PrimaryButton title={t("continue")} onPress={goNext} disabled={submitting} />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  {t("createCredentials")}
                </Text>
                <View style={{ marginBottom: Spacing.sm }}>
                  <InputField
                    label={t("email")}
                    placeholder={t("emailPlaceholder")}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
                <View style={{ marginBottom: Spacing.sm }}>
                  <InputField
                    label={t("password")}
                    placeholder={t("passwordMin")}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password-new"
                  />
                </View>
                <View style={{ marginBottom: Spacing.md }}>
                  <InputField
                    label={t("confirmPassword")}
                    placeholder={t("reEnterPassword")}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoComplete="password-new"
                  />
                </View>
                <PrimaryButton
                  title={t("createAccountBtn")}
                  onPress={handleCreateAccount}
                  loading={submitting}
                />
              </>
            ) : null}

            {error ? (
              <Text style={[Typography.secondary, { color: Colors.danger, marginTop: Spacing.md, fontWeight: "600" }]}>
                {error}
              </Text>
            ) : null}
          </View>
        </View>

        {step === 0 ? (
          <SpringPressScale fullWidth onPress={() => router.replace("/login")}>
            <View style={{ marginTop: Spacing.lg, paddingVertical: Spacing.sm }}>
              <Text style={[Typography.secondary, { color: Colors.textMuted, textAlign: "center", fontWeight: "600" }]}>
                {t("alreadyHaveAccount")}{" "}
                <Text style={{ color: Colors.primary }}>{t("logInLink")}</Text>
              </Text>
            </View>
          </SpringPressScale>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}


