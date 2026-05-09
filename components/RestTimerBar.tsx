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
 * Self-contained rest timer card.
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

  const progress =
    rt.durationSeconds > 0
      ? Math.max(0, Math.min(1, restSecondsRemaining / rt.durationSeconds))
      : 0;

  const isPaused = rt.isPaused;
  const isAlmostDone = !isPaused && restSecondsRemaining <= 5;

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: isAlmostDone ? Colors.primary : Colors.border,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: Spacing.sm,
        }}
      >
        {/* Label + countdown */}
        <View>
          <Text
            style={{
              ...Typography.secondary,
              color: Colors.textMuted,
              fontSize: FontSizes.tiny,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 2,
            }}
          >
            {isPaused ? t("restPaused") : t("restTime")}
          </Text>
          <Text
            style={{
              ...Typography.title,
              fontSize: 36,
              fontVariant: ["tabular-nums"],
              color: isAlmostDone ? Colors.primary : Colors.text,
              lineHeight: 40,
            }}
          >
            {formatRest(restSecondsRemaining)}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: Spacing.sm, alignItems: "center" }}>
          {/* Pause / Resume */}
          <Pressable
            onPress={isPaused ? resumeRestTimer : pauseRestTimer}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: Radius.xl,
              borderWidth: 1,
              borderColor: Colors.border,
              backgroundColor: Colors.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            })}
            accessibilityLabel={isPaused ? t("resumeTimer") : t("pauseTimer")}
          >
            <Ionicons
              name={isPaused ? "play" : "pause"}
              size={18}
              color={Colors.text}
            />
          </Pressable>

          {/* Skip */}
          <Pressable
            onPress={skipRestTimer}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 10,
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
                fontSize: FontSizes.note,
              }}
            >
              {t("skip")}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Progress bar — drains left-to-right */}
      <View
        style={{
          height: 5,
          backgroundColor: Colors.surface,
          borderRadius: Radius.pill,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            backgroundColor: isAlmostDone ? Colors.danger : Colors.primary,
            borderRadius: Radius.pill,
          }}
        />
      </View>

      {/* Sub-label: planned duration */}
      <Text
        style={{
          ...Typography.secondary,
          color: Colors.textMuted,
          fontSize: FontSizes.tiny,
          marginTop: 6,
          textAlign: "right",
        }}
      >
        {t("sPlanned", { n: rt.durationSeconds })}
      </Text>
    </View>
  );
}


