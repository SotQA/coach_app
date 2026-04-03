import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import { Colors } from "../theme/colors";

// Simple landing page that routes to login or signup.
export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (user) {
    const href = user.role === "coach" ? "/coach/dashboard" : "/student/workouts";
    return <Redirect href={href} />;
  }

  return <Redirect href="/login" />;

}