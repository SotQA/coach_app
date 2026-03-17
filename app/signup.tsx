import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Redirect } from "expo-router";
import type { UserRole } from "../types/User";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";

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
          padding: 12,
          borderWidth: 1,
          borderColor: selected ? "#2563EB" : "#374151",
          borderRadius: 999,
          marginHorizontal: 4,
          backgroundColor: selected ? "#1D4ED8" : "#020617",
        }}
      >
        <Text
          style={{
            textAlign: "center",
            fontWeight: "600",
            color: "white",
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
            Create your account
          </Text>
          <Text style={{ color: "#9CA3AF", marginBottom: 20 }}>
            Choose whether you&apos;re coaching or training and get started.
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

          <Text style={{ color: "#E5E7EB", marginBottom: 8 }}>I am a</Text>
          <View style={{ flexDirection: "row", marginBottom: 20 }}>
            <RoleButton value="coach" label="Coach" />
            <RoleButton value="student" label="Student" />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : (
            <PrimaryButton title="Sign Up" onPress={handleSignup} />
          )}
          {error ? (
            <Text style={{ color: "#FCA5A5", marginTop: 8 }}>{error}</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}