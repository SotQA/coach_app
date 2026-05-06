import { Pressable, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useActiveWorkout } from "../context/ActiveWorkoutContext";
import { useI18n } from "../context/I18nContext";
import { formatElapsedForTimer } from "../utils/workoutDuration";
import { Colors } from "../theme/colors";
import { Radius } from "../theme/spacing";
import { Typography } from "../theme/typography";

/** Height of the floating bar itself (not including bottom offset). */
export const FLOATING_BAR_HEIGHT = 58;

/** Extra bottom padding tab screens should add when a session is active. */
export const FLOATING_BAR_SCROLL_OFFSET = FLOATING_BAR_HEIGHT + 16;

/** mm:ss string, ceiling the seconds so "00:01" shows for the final tick. */
function formatRestCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FloatingWorkoutBar() {
  const { session, elapsedSeconds, restSecondsRemaining } = useActiveWorkout();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!session) return null;

  // Hide when the user is already on the workout execution screen.
  if (pathname.includes("workoutExecution")) return null;

  const restActive = session.restTimer?.isActive === true;
  const restPaused = session.restTimer?.isPaused === true;

  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );

  // Sit above the tab bar (49 px) + safe-area bottom + 8 px breathing room.
  const TAB_BAR_HEIGHT = 49;
  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 8;

  const isRestAlmostDone = restActive && !restPaused && restSecondsRemaining <= 5;
  const barColor = isRestAlmostDone ? Colors.danger : Colors.primary;

  const handlePress = () => {
    router.push({
      pathname: "/student/workoutExecution",
      params: { workoutPlanId: session.workoutPlanId },
    });
  };

  const restTime = formatRestCountdown(restSecondsRemaining);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        position: "absolute",
        left: 12,
        right: 12,
        bottom: bottomOffset,
        height: FLOATING_BAR_HEIGHT,
        backgroundColor: barColor,
        borderRadius: Radius.lg,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        gap: 10,
        opacity: pressed ? 0.9 : 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 9999,
      })}
    >
      {/* Status dot */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: Colors.onPrimary,
          opacity: 0.7,
        }}
      />

      {/* Main content — swaps between rest-timer mode and normal workout mode */}
      <View style={{ flex: 1 }}>
        {restActive ? (
          <>
            <Text
              style={{
                ...Typography.section,
                color: Colors.onPrimary,
                fontWeight: "800",
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              {t(restPaused ? "restPausedDot" : "restingDot", { name: session.workoutName })}
            </Text>
            <Text
              style={{
                ...Typography.secondary,
                color: Colors.onPrimary,
                opacity: 0.8,
                fontSize: 12,
                marginTop: 1,
              }}
            >
              {t(restPaused ? "remainingPaused" : "remainingTapResume", { time: restTime })}
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{
                ...Typography.section,
                color: Colors.onPrimary,
                fontWeight: "800",
                fontSize: 13,
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
              {t("setsDone", { done: doneSets, total: totalSets })} · {formatElapsedForTimer(elapsedSeconds)}
            </Text>
          </>
        )}
      </View>

      {/* Right badge — shows rest countdown or workout elapsed time */}
      <View
        style={{
          backgroundColor: "rgba(0,0,0,0.18)",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: Radius.pill,
          minWidth: 52,
          alignItems: "center",
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
          {restActive
            ? restTime
            : formatElapsedForTimer(elapsedSeconds)}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.onPrimary} />
    </Pressable>
  );
}
