import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { BackButton } from "../components/BackButton";
import { Colors } from "../theme/colors";

export default function Layout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          headerTitleStyle: { color: Colors.text },
          headerShadowVisible: false,
          headerLeft: () => <BackButton hideIfNoBack />,
        }}
      >
        <Stack.Screen name="index" options={{ title: "Gym Coach App" }} />
        <Stack.Screen name="(auth)/login" options={{ title: "Login" }} />
        <Stack.Screen name="(auth)/signup" options={{ title: "Sign Up" }} />
        <Stack.Screen name="coach/dashboard" options={{ title: "Coach Dashboard" }} />
        <Stack.Screen
          name="coach/studentDetails"
          options={{ title: "Student Details" }}
        />
        <Stack.Screen
          name="coach/createStudent"
          options={{ title: "Create Student" }}
        />
        <Stack.Screen
          name="coach/createWorkoutPlan"
          options={{ title: "Create Workout Plan" }}
        />
        <Stack.Screen name="coach/workout" options={{ title: "Workout" }} />
        <Stack.Screen name="coach/editWorkout" options={{ title: "Edit Workout" }} />
        <Stack.Screen
          name="coach/workoutLogFeedback"
          options={{ title: "Workout feedback" }}
        />
        <Stack.Screen name="coach/viewProgress" options={{ title: "Progress" }} />
        <Stack.Screen
          name="student/dashboard"
          options={{ title: "Student Dashboard" }}
        />
        <Stack.Screen name="student/today" options={{ title: "Today" }} />
        <Stack.Screen name="student/workouts" options={{ title: "Your Workouts" }} />
        <Stack.Screen
          name="student/workout"
          options={{ title: "Workout" }}
        />
        <Stack.Screen
          name="student/workoutExecution"
          options={{ title: "Workout Execution" }}
        />
        <Stack.Screen
          name="student/workoutHistory"
          options={{ title: "Workout History" }}
        />
        <Stack.Screen
          name="student/exerciseDetails"
          options={{ title: "Exercise Details" }}
        />
        <Stack.Screen name="student/progress" options={{ title: "Progress" }} />
      </Stack>
    </AuthProvider>
  );
}