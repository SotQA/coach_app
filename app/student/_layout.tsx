import { Redirect, Stack, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { FloatingWorkoutBar } from "../../components/FloatingWorkoutBar";
import { Colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";

function HeaderBackButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="chevron-back" size={26} color={Colors.text} />
      </View>
    </Pressable>
  );
}

export default function StudentLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "student") {
    return <Redirect href="/coach/dashboard" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          headerLeft: ({ canGoBack }) => canGoBack ? <HeaderBackButton /> : null,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Back" }} />
        <Stack.Screen name="today" options={{ title: "Today" }} />
        <Stack.Screen name="workout" options={{ title: "Workout" }} />
        <Stack.Screen name="workoutExecution" options={{ headerShown: false }} />
        <Stack.Screen name="workoutPlanDetail" options={{ title: "Workout" }} />
        <Stack.Screen name="exerciseDetails" options={{ title: "Exercise Details" }} />
        <Stack.Screen name="exerciseDetail" options={{ headerShown: false }} />
        <Stack.Screen name="workoutHistory" options={{ title: "History" }} />
        <Stack.Screen name="progress" options={{ title: "Progress" }} />
      </Stack>
      {/* Floats above tab bar on all student screens except workoutExecution */}
      <FloatingWorkoutBar />
    </View>
  );
}

