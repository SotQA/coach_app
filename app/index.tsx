import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";

// Simple landing page that routes to login or signup.
export default function Home() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#0F172A",
      }}
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
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 8,
            color: "white",
          }}
        >
          Gym Coach App
        </Text>
        <Text
          style={{
            marginBottom: 24,
            color: "#9CA3AF",
          }}
        >
          Manage students, build workout plans, and track progress in one place.
        </Text>
        <PrimaryButton
          title="Login"
          onPress={() => router.push("/login")}
          style={{ marginBottom: 12 }}
        />
        <PrimaryButton
          title="Sign Up"
          onPress={() => router.push("/signup")}
          style={{ backgroundColor: "white" }}
          textStyle={{ color: "#111827" }}
        />
      </View>
    </View>
  );
}