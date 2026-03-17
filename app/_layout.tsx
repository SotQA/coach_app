import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Gym Coach App" }} />
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
      <Stack.Screen name="coach/dashboard" options={{ title: "Coach Dashboard" }} />
      <Stack.Screen
        name="coach/createStudent"
        options={{ title: "Create Student" }}
      />
      <Stack.Screen
        name="coach/createWorkoutPlan"
        options={{ title: "Create Workout Plan" }}
      />
      <Stack.Screen
        name="student/dashboard"
        options={{ title: "Student Dashboard" }}
      />
      <Stack.Screen
        name="student/workout"
        options={{ title: "Workout" }}
      />
      <Stack.Screen
        name="student/workoutHistory"
        options={{ title: "Workout History" }}
      />
    </Stack>
  );
}