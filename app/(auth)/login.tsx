import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const appUser = await login(email.trim(), password);
      router.replace(appUser.role === "coach" ? "/coach/dashboard" : "/student/today");
    } catch (e: any) {
      setError(e.message ?? "Failed to login.");
    } finally {
      setSubmitting(false);
    }
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
        <Text style={{ ...Typography.title, marginBottom: Spacing.xs }}>Welcome back</Text>
        <Text style={{ ...Typography.secondary, marginBottom: Spacing.lg }}>
          Log in to manage your coaching or stay on top of your workouts.
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

        {submitting ? (
          <ActivityIndicator style={{ marginVertical: 12 }} />
        ) : (
          <>
            <PrimaryButton title="Login" onPress={handleLogin} />
            <PrimaryButton
              title="Create account"
              onPress={() => router.push("/signup")}
              style={{ marginTop: Spacing.sm, backgroundColor: Colors.border }}
            />
          </>
        )}

        {error ? (
          <Text style={{ color: Colors.danger, marginTop: Spacing.xs }}>{error}</Text>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

