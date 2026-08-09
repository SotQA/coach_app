import { Redirect, Stack, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { CoachSpeedDial } from "../../components/CoachSpeedDial";
import { CoachFabVisibilityProvider, useCoachFabVisibility } from "../../context/CoachFabVisibilityContext";
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

function CoachStack() {
  const navigation = useNavigation();
  const { setVisible } = useCoachFabVisibility();

  // `transitionStart` fires the moment a native-stack transition begins —
  // including at the start of an interactive swipe-back gesture — unlike
  // focus/pathname state, which only updates once the gesture commits. Using
  // it here (scoped to this "coach" root screen) keeps the FAB in sync with
  // screens presented outside the nested coach Stack, e.g. Edit Profile.
  useEffect(() => {
    setVisible(navigation.isFocused());
    // `transitionStart` is a native-stack-only event not present on the
    // generic navigation type expo-router's useNavigation() returns here.
    const nativeStackNavigation = navigation as unknown as {
      addListener: (
        event: "transitionStart",
        callback: (e: { data: { closing: boolean } }) => void
      ) => () => void;
    };
    return nativeStackNavigation.addListener("transitionStart", (e) => {
      setVisible(!e.data.closing);
    });
  }, [navigation, setVisible]);

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
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="workoutComparison" options={{ headerShown: false }} />
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
        <Stack.Screen name="exerciseDetail" options={{ headerShown: false }} />
        <Stack.Screen name="createPersonalPlan" options={{ title: "Create Plan" }} />
        <Stack.Screen name="workoutPlanDetail" options={{ title: "Workout" }} />
        <Stack.Screen name="personalProgress" options={{ title: "My Progress" }} />
      </Stack>
      <CoachSpeedDial />
    </View>
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
    <CoachFabVisibilityProvider>
      <CoachStack />
    </CoachFabVisibilityProvider>
  );
}
