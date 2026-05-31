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

export default function CoachLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role === "student") return <Redirect href="/student/workouts" />;
  if (user.role === "athlete") return <Redirect href={"/athlete/workouts" as any} />;
  if (user.role !== "coach") return <Redirect href="/login" />;

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
          // Prevent white flash during iOS back-swipe / transitions.
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Back" }} />
        <Stack.Screen name="studentDetails" options={{ headerShown: false }} />
        <Stack.Screen
          name="createStudent"
          options={{
            title: "Create Student",
            headerLeft: () => null,
          }}
        />
        <Stack.Screen name="selectTrainingGroup" options={{ title: "Select Training Group" }} />
        <Stack.Screen name="createTrainingGroup" options={{ title: "Create Training Group" }} />
        <Stack.Screen name="createWorkoutPlan" options={{ title: "Create Workout Plan" }} />
        <Stack.Screen name="workout" options={{ title: "Workout" }} />
        <Stack.Screen name="editWorkout" options={{ title: "Edit Workout" }} />
        <Stack.Screen name="workoutLogFeedback" options={{ title: "Workout feedback" }} />
        <Stack.Screen name="assignedWorkouts" options={{ title: "Assigned workouts" }} />
        <Stack.Screen name="workoutExecution" options={{ headerShown: false }} />
        <Stack.Screen name="createPersonalPlan" options={{ title: "Create Plan" }} />
        <Stack.Screen name="personalProgress" options={{ title: "My Progress" }} />
      </Stack>
      <FloatingWorkoutBar />
    </View>
  );
}

