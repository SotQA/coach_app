import { useState } from "react";
import { Platform, View, Text, TextInput, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import type { Sex, UserRole } from "../../types/User";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function Signup() {
  const router = useRouter();
  const { user, loading: authLoading, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coach");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobDraft, setDobDraft] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parseYMD = (value: string): Date | null => {
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map((p) => Number(p));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;
    return new Date(y, m - 1, d);
  };

  const formatYMD = (value: Date): string => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const dobValue = dateOfBirth ? parseYMD(dateOfBirth) ?? new Date(2000, 0, 1) : new Date(2000, 0, 1);
  const activeDobValue = dobDraft ?? dobValue;

  const validate = (): string | null => {
    const e = email.trim();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return "Please enter a valid email address.";
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!dateOfBirth.trim()) return "Date of birth is required.";
    return null;
  };

  const handleSignup = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      await signup(
        email.trim(),
        password,
        role,
        firstName.trim(),
        lastName.trim(),
        dateOfBirth.trim(),
        sex
      );
    } catch (e: any) {
      setError(e.message ?? "Failed to sign up.");
    } finally {
      setSubmitting(false);
    }
  };

  const RoleButton = ({
    value,
    label,
  }: {
    value: UserRole;
    label: string;
  }) => {
    const selected = role === value;
    return (
      <Pressable
        onPress={() => setRole(value)}
        style={{
          flex: 1,
          padding: Spacing.sm,
          borderWidth: 1,
          borderColor: selected ? Colors.primary : Colors.border,
          borderRadius: Radius.pill,
          marginHorizontal: 4,
          backgroundColor: selected ? Colors.primary : Colors.surface,
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: "600",
            color: Colors.text,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const SexButton = ({
    value,
    label,
  }: {
    value: Sex;
    label: string;
  }) => {
    const selected = sex === value;
    return (
      <Pressable
        onPress={() => setSex(value)}
        style={{
          flex: 1,
          padding: Spacing.sm,
          borderWidth: 1,
          borderColor: selected ? Colors.primary : Colors.border,
          borderRadius: Radius.pill,
          marginHorizontal: 4,
          backgroundColor: selected ? Colors.primary : Colors.surface,
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "600", color: Colors.text }}>{label}</Text>
      </Pressable>
    );
  };

  const DobButton = () => {
    const formatted = dateOfBirth || "";
    return (
      <Pressable
        onPress={() => setDobPickerOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: Radius.sm,
          marginBottom: Spacing.md,
          padding: 12,
          backgroundColor: Colors.surface,
        }}
      >
        <Text style={{ color: formatted ? Colors.text : Colors.textMuted }}>
          {formatted ? formatted : "Select date"}
        </Text>
      </Pressable>
    );
  };

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Protected by (auth)/_layout.tsx; render nothing during redirect.
  if (user) return null;

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: Spacing.lg,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      enableResetScrollToCoords={false}
      extraScrollHeight={24}
    >
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Text style={{ ...Typography.title, marginBottom: Spacing.xs }}>Create your account</Text>
        <Text style={{ ...Typography.secondary, marginBottom: Spacing.lg }}>
          Choose whether you&apos;re coaching or training and get started.
        </Text>

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Email</Text>
        <TextInput
          placeholder="you@example.com"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.sm,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Password</Text>
        <TextInput
          placeholder="••••••••"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.md,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        <Text style={{ ...Typography.secondary, marginBottom: 6, marginTop: Spacing.md }}>First Name</Text>
        <TextInput
          placeholder="First name"
          placeholderTextColor={Colors.textMuted}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.sm,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Last Name</Text>
        <TextInput
          placeholder="Last name"
          placeholderTextColor={Colors.textMuted}
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          style={{
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.sm,
            marginBottom: Spacing.sm,
            padding: 12,
            color: Colors.text,
            backgroundColor: Colors.surface,
          }}
        />

        <Text style={{ ...Typography.secondary, marginBottom: 6 }}>Date of Birth</Text>
        <DobButton />

        {dobPickerOpen ? (
          <DateTimePicker
            value={activeDobValue}
            mode="date"
            // Use `spinner` on iOS for stability (some iOS builds crash with `calendar`).
            // We still prevent wrong auto-selection by committing only on `Apply`.
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              // Keep picker open until user taps Apply (iOS/web-like behavior),
              // but on Android we also respect native set/dismiss events.
              if (selectedDate) {
                setDobDraft(selectedDate);
              }

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
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg, alignItems: "center" }}>
            <PrimaryButton
              title="Apply"
              onPress={() => {
                if (!dobDraft) return;
                setDateOfBirth(formatYMD(dobDraft));
                setDobDraft(null);
                setDobPickerOpen(false);
              }}
              style={{ width: "auto" }}
            />
            <Pressable
              onPress={() => {
                setDobDraft(null);
                setDobPickerOpen(false);
              }}
              style={{
                paddingVertical: 15,
                paddingHorizontal: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.section, color: Colors.textMuted, fontWeight: "700" }}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>Sex</Text>
        <View style={{ flexDirection: "row", marginBottom: Spacing.lg }}>
          <SexButton value="male" label="Male" />
          <SexButton value="female" label="Female" />
        </View>

        <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>I am a</Text>
        <View style={{ flexDirection: "row", marginBottom: Spacing.lg }}>
          <RoleButton value="coach" label="Coach" />
          <RoleButton value="student" label="Student" />
        </View>

        {submitting ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : (
          <>
            <PrimaryButton title="Sign Up" onPress={handleSignup} />
            <View style={{ marginTop: Spacing.sm }}>
              <PrimaryButton
                title="Back to Login"
                onPress={() => router.replace("/login")}
                style={{ width: "auto", backgroundColor: Colors.border }}
                textStyle={{ fontSize: 14, fontWeight: "700" }}
              />
            </View>
          </>
        )}

        {error ? (
          <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

