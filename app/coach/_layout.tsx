import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { BackButton } from "../../components/BackButton";
import { Colors } from "../../theme/colors";

export default function CoachLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== "coach") {
    return <Redirect href="/student/workouts" />;
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
        // iOS back button label should never show "(tabs)".
        headerBackTitle: "Back",
        // Prevent white flash during iOS back-swipe / transitions.
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Back" }} />
      <Stack.Screen name="studentDetails" options={{ title: "Student Details" }} />
      <Stack.Screen
        name="createStudent"
        options={{
          title: "Create Student",
          headerLeft: () => null,
        }}
      />
      <Stack.Screen name="createWorkoutPlan" options={{ title: "Create Workout Plan" }} />
      <Stack.Screen name="workout" options={{ title: "Workout" }} />
      <Stack.Screen name="editWorkout" options={{ title: "Edit Workout" }} />
      <Stack.Screen name="workoutLogFeedback" options={{ title: "Workout feedback" }} />
      <Stack.Screen name="viewProgress" options={{ title: "Progress" }} />
    </Stack>
  );
}

