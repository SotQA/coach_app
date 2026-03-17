import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { authService } from "../services/authService";
import type { AppUser } from "../types/User";
import { PrimaryButton } from "../components/PrimaryButton";

// Login screen that authenticates with Firebase and routes the user
// either to the coach dashboard or student dashboard based on Firestore role.
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigateAfterLogin = (user: AppUser) => {
    if (user.role === "coach") {
      router.replace("/coach/dashboard");
    } else {
      router.replace("/student/today");
    }
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await authService.login(email.trim(), password);
      navigateAfterLogin(user);
    } catch (e: any) {
      setError(e.message ?? "Failed to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            backgroundColor: "#111827",
            borderRadius: 24,
            padding: 24,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 8,
              color: "white",
            }}
          >
            Welcome back
          </Text>
          <Text style={{ color: "#9CA3AF", marginBottom: 20 }}>
            Log in to manage your coaching or stay on top of your workouts.
          </Text>
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Email</Text>
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              borderRadius: 12,
              marginBottom: 12,
              padding: 12,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
          <Text style={{ color: "#E5E7EB", marginBottom: 4 }}>Password</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor="#6B7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "#1F2937",
              borderRadius: 12,
              marginBottom: 16,
              padding: 12,
              color: "white",
              backgroundColor: "#020617",
            }}
          />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <PrimaryButton title="Login" onPress={handleLogin} />
          )}
          {error ? (
            <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}