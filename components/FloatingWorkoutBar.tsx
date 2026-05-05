import { Pressable, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useActiveWorkout } from "../context/ActiveWorkoutContext";
import { formatElapsedForTimer } from "../utils/workoutDuration";
import { Colors } from "../theme/colors";
import { Radius } from "../theme/spacing";
import { Typography } from "../theme/typography";

/** Height of the floating bar itself (not including bottom offset). */
export const FLOATING_BAR_HEIGHT = 58;

/** Extra bottom padding tab-screen ScrollViews should add when a session is active. */
export const FLOATING_BAR_SCROLL_OFFSET = FLOATING_BAR_HEIGHT + 16;

export function FloatingWorkoutBar() {
  const { session, elapsedSeconds } = useActiveWorkout();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!session) return null;

  // Hide when the user is already on the workout execution screen.
  if (pathname.includes("workoutExecution")) return null;

  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );

  // Sit above the tab bar (49 px) + safe-area bottom + 8 px breathing room.
  const TAB_BAR_HEIGHT = 49;
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 8;

  const handlePress = () => {
    router.push({
      pathname: "/student/workoutExecution",
      params: { workoutPlanId: session.workoutPlanId },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        position: "absolute",
        left: 12,
        right: 12,
        bottom: bottomOffset,
        height: FLOATING_BAR_HEIGHT,
        backgroundColor: Colors.primary,
        borderRadius: Radius.lg,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        gap: 12,
        opacity: pressed ? 0.9 : 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 9999,
      })}
    >
      {/* Pulsing dot */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: Colors.onPrimary,
          opacity: 0.7,
        }}
      />

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...Typography.section,
            color: Colors.onPrimary,
            fontWeight: "800",
            fontSize: 14,
          }}
          numberOfLines={1}
        >
          {session.workoutName}
        </Text>
        <Text
          style={{
            ...Typography.secondary,
            color: Colors.onPrimary,
            opacity: 0.75,
            fontSize: 12,
            marginTop: 1,
          }}
        >
          {doneSets}/{totalSets} sets · {formatElapsedForTimer(elapsedSeconds)}
        </Text>
      </View>

      {/* Timer badge */}
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.15)",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: Radius.pill,
        }}
      >
        <Text
          style={{
            ...Typography.secondary,
            color: Colors.onPrimary,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            fontSize: 13,
          }}
        >
          {formatElapsedForTimer(elapsedSeconds)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.onPrimary} />
    </Pressable>
  );
}
