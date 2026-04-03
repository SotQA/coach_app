import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Sex, UserRole } from "../../types/User";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

const TOTAL_STEPS = 3;

const STEP_TITLES = ["Account", "About you", "Your role"] as const;

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

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, loading: authLoading, signup } = useAuth();
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

  const validateStep0 = useCallback((): string | null => {
    if (!validateEmail(email)) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [email, password, confirmPassword]);

  const validateStep1 = useCallback((): string | null => {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!dateOfBirth.trim()) return "Date of birth is required.";
    return null;
  }, [firstName, lastName, dateOfBirth]);

  const goNext = () => {
    setError(null);
    if (step === 0) {
      const err = validateStep0();
      if (err) {
        setError(err);
        return;
      }
    }
    if (step === 1) {
      const err = validateStep1();
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
    if (role == null) {
      setError("Please select Coach or Student.");
      return;
    }
    const e0 = validateStep0();
    const e1 = validateStep1();
    if (e0 || e1) {
      setError(e0 ?? e1 ?? "Please complete all steps.");
      return;
    }

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
      const msg = err instanceof Error ? err.message : "Failed to sign up.";
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

  const SexChip = ({ value, label }: { value: Sex; label: string }) => {
    const selected = sex === value;
    return (
      <Pressable
        onPress={() => setSex(value)}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: Spacing.sm,
          borderWidth: 1,
          borderColor: selected ? Colors.primary : Colors.border,
          borderRadius: Radius.sm,
          backgroundColor: selected ? "rgba(212,255,68,0.12)" : Colors.surface,
          alignItems: "center",
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Text style={{ ...Typography.section, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      </Pressable>
    );
  };

  const RoleCard = ({
    value,
    title,
    subtitle,
    icon,
  }: {
    value: UserRole;
    title: string;
    subtitle: string;
    icon: ComponentProps<typeof Ionicons>["name"];
  }) => {
    const selected = role === value;
    return (
      <Pressable
        disabled={submitting}
        onPress={() => {
          setRole(value);
          setError(null);
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          padding: Spacing.md,
          borderRadius: Radius.lg,
          borderWidth: 2,
          borderColor: selected ? Colors.primary : Colors.border,
          backgroundColor: selected ? "rgba(212,255,68,0.08)" : Colors.surface,
          marginBottom: Spacing.sm,
          opacity: pressed ? 0.92 : 1,
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selected ? 0.2 : 0.12,
                shadowRadius: 10,
              }
            : { elevation: selected ? 4 : 2 }),
        })}
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
      </Pressable>
    );
  };

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
        ref={(r) => {
          scrollRef.current = r;
        }}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? "Back to login" : "Previous step"}
            onPress={goBack}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              backgroundColor: Colors.card,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
              justifyContent: "center",
              marginRight: Spacing.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "700", fontSize: 12 }}>
              Step {step + 1} of {TOTAL_STEPS}
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
          <Animated.View
            style={[
              {
                height: 4,
                borderRadius: 2,
                backgroundColor: Colors.primary,
              },
              barStyle,
            ]}
          />
        </View>

        <Animated.View
          key={step}
          entering={SlideInRight.springify().damping(22).stiffness(200)}
          exiting={SlideOutLeft.duration(240)}
          style={{ width: "100%" }}
        >
          <View
            style={{
              backgroundColor: Colors.card,
              borderRadius: Radius.lg,
              padding: Spacing.lg,
              borderWidth: 1,
              borderColor: Colors.border,
              ...(Platform.OS === "ios"
                ? {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 16,
                  }
                : { elevation: 6 }),
            }}
          >
            {step === 0 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  Create your credentials. You can finish your profile in the next steps.
                </Text>
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>Email</Text>
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>Password</Text>
                <TextInput
                  placeholder="At least 8 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password-new"
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>Confirm password</Text>
                <TextInput
                  placeholder="Re-enter password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoComplete="password-new"
                  style={{ ...inputStyle, marginBottom: Spacing.md }}
                />
                <PrimaryButton title="Continue" onPress={goNext} />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  Tell us a bit about you. This helps personalize your experience.
                </Text>
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>First name</Text>
                <TextInput
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>Last name</Text>
                <TextInput
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  style={{ ...inputStyle, marginBottom: Spacing.sm }}
                />
                <Text style={{ ...Typography.secondary, marginBottom: 6, fontWeight: "600" }}>Date of birth</Text>
                <Pressable
                  onPress={() => setDobPickerOpen(true)}
                  style={({ pressed }) => ({
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: Radius.sm,
                    marginBottom: Spacing.md,
                    padding: 14,
                    backgroundColor: Colors.surface,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={[Typography.body, { color: dateOfBirth ? Colors.text : Colors.textMuted }]}>
                    {dateOfBirth ? dateOfBirth : "Select date"}
                  </Text>
                </Pressable>

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
                    {/* PrimaryButton uses width: 100% on its root — wrap so row split works (see StudentCard). */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <PrimaryButton
                        title="Apply"
                        onPress={() => {
                          if (!dobDraft) return;
                          setDateOfBirth(formatYMD(dobDraft));
                          setDobDraft(null);
                          setDobPickerOpen(false);
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => {
                        setDobDraft(null);
                        setDobPickerOpen(false);
                      }}
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
                      <Text style={{ ...Typography.section, color: Colors.textMuted, fontWeight: "700" }}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs, fontWeight: "600" }}>Sex</Text>
                <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md }}>
                  <SexChip value="male" label="Male" />
                  <SexChip value="female" label="Female" />
                </View>
                <PrimaryButton title="Continue" onPress={goNext} />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: Spacing.lg, lineHeight: 22 }}>
                  How will you use the app? Pick the experience that matches you.
                </Text>
                <RoleCard
                  value="coach"
                  title="Coach"
                  subtitle="Manage students, build plans, track progress"
                  icon="school-outline"
                />
                <RoleCard
                  value="student"
                  title="Student"
                  subtitle="Follow workouts, log sessions, track PRs"
                  icon="barbell-outline"
                />
                {submitting ? (
                  <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[Typography.secondary, { color: Colors.textMuted, marginTop: Spacing.md }]}>
                      Creating your account…
                    </Text>
                  </View>
                ) : (
                  <PrimaryButton title="Create Account" onPress={handleCreateAccount} />
                )}
              </>
            ) : null}

            {error ? (
              <Text style={[Typography.secondary, { color: Colors.danger, marginTop: Spacing.md, fontWeight: "600" }]}>
                {error}
              </Text>
            ) : null}
          </View>
        </Animated.View>

        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: Spacing.lg, paddingVertical: Spacing.sm }}>
          <Text style={[Typography.secondary, { color: Colors.textMuted, textAlign: "center", fontWeight: "600" }]}>
            Already have an account? <Text style={{ color: Colors.primary }}>Log in</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}
