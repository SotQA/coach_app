import { Slot, Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";

export default function AuthLayout() {
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
        <ActivityIndicator />
      </View>
    );
  }

  if (user) {
    return (
      <Redirect href={user.role === "coach" ? "/coach/dashboard" : "/student/workouts"} />
    );
  }

  return <Slot />;
}

