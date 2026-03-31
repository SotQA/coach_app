import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { BackButton } from "../../components/BackButton";
import { Colors } from "../../theme/colors";

export default function StudentLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "student") {
    return <Redirect href="/coach/dashboard" />;
  }

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
        headerShadowVisible: false,
        headerLeft: () => <BackButton hideIfNoBack />,
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Back" }} />
      <Stack.Screen name="today" options={{ title: "Today" }} />
      <Stack.Screen name="workout" options={{ title: "Workout" }} />
      <Stack.Screen name="workoutExecution" options={{ headerShown: false }} />
      <Stack.Screen name="exerciseDetails" options={{ title: "Exercise Details" }} />
      <Stack.Screen name="progress" options={{ title: "Progress" }} />
    </Stack>
  );
}

