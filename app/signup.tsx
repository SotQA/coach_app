import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Redirect } from "expo-router";
import type { UserRole } from "../types/User";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

// Signup screen that lets the user choose a role (coach | student),
// creates the Firebase Auth user, and stores the role in Firestore.
export default function Signup() {
  const { user, loading: authLoading, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("coach");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signup(email.trim(), password, role);
    } catch (e: any) {
      setError(e.message ?? "Failed to sign up.");
    } finally {
      setLoading(false);
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

  if (user) {
    const href = user.role === "coach" ? "/coach/dashboard" : "/student/today";
    return <Redirect href={href} />;
  }

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
          <Text
            style={{
              ...Typography.title,
              marginBottom: Spacing.xs,
            }}
          >
            Create your account
          </Text>
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

          <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>I am a</Text>
          <View style={{ flexDirection: "row", marginBottom: Spacing.lg }}>
            <RoleButton value="coach" label="Coach" />
            <RoleButton value="student" label="Student" />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <PrimaryButton title="Sign Up" onPress={handleSignup} />
          )}
          {error ? (
            <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
          ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}