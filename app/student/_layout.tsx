import { Slot, Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { Colors } from "../../theme/colors";

export default function StudentLayout() {
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

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "student") {
    return <Redirect href="/coach/dashboard" />;
  }

  return <Slot />;
}

