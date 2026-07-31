import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useActiveWorkoutSession } from "../context/ActiveWorkoutSessionContext";
import { useI18n } from "../context/I18nContext";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography, FontSizes } from "../theme/typography";

/** Format seconds into mm:ss, always ceiling so "0:01" shows for the last tick. */
function formatRest(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Self-contained rest timer pill.
 *
 * Reads directly from ActiveWorkoutContext so it can be dropped anywhere
 * without prop drilling. Renders nothing when no rest timer is active.
 */
export function RestTimerBar() {
  const {
    session,
    restSecondsRemaining,
    pauseRestTimer,
    resumeRestTimer,
    skipRestTimer,
  } = useActiveWorkoutSession();
  const { t } = useI18n();

  const rt = session?.restTimer;
  if (!rt?.isActive) return null;

  const isPaused = rt.isPaused;
  const isAlmostDone = !isPaused && restSecondsRemaining <= 5;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        gap: Spacing.sm,
        backgroundColor: Colors.card,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: isAlmostDone ? Colors.primary : Colors.border,
        paddingVertical: 6,
        paddingHorizontal: 8,
        marginBottom: Spacing.sm,
      }}
    >
      {/* Pause / Resume */}
      <Pressable
        onPress={isPaused ? resumeRestTimer : pauseRestTimer}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: Colors.border,
          backgroundColor: Colors.surface,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.75 : 1,
        })}
        accessibilityLabel={isPaused ? t("resumeTimer") : t("pauseTimer")}
      >
        <Ionicons name={isPaused ? "play" : "pause"} size={14} color={Colors.text} />
      </Pressable>

      {/* Countdown */}
      <Text
        style={{
          ...Typography.title,
          fontSize: 18,
          fontVariant: ["tabular-nums"],
          color: isAlmostDone ? Colors.primary : Colors.text,
        }}
      >
        {formatRest(restSecondsRemaining)}
      </Text>

      {/* Skip */}
      <Pressable
        onPress={skipRestTimer}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: Radius.pill,
          backgroundColor: Colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
        accessibilityLabel={t("skip")}
      >
        <Text
          style={{
            ...Typography.secondary,
            color: Colors.onPrimary,
            fontWeight: "700",
            fontSize: FontSizes.tiny,
          }}
        >
          {t("skip")}
        </Text>
      </Pressable>
    </View>
  );
}


