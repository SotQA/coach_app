import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

// Login screen that authenticates with Firebase and routes the user
// either to the coach dashboard or student dashboard based on Firestore role.
export default function Login() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? "Failed to login.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0F172A",
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
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 20,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={24}
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
            <>
              <PrimaryButton title="Login" onPress={handleLogin} />
              <PrimaryButton
                title="Create account"
                onPress={() => router.push("/signup")}
                style={{ marginTop: 12, backgroundColor: "#1F2937" }}
              />
            </>
          )}
          {error ? (
            <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text>
          ) : null}
        </View>
    </KeyboardAwareScrollView>
  );
}