import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { WorkoutLogExercise } from "@/types/Workout";
import { Colors } from "@/theme/colors";
import { Radius, Spacing } from "@/theme/spacing";
import { FontSizes, Typography } from "@/theme/typography";
import { computeExerciseVolumeFromLoggedSets } from "@/utils/workoutMetrics";
import { formatDurationForHistory } from "@/utils/workoutDuration";
import {
  countPrs,
  sessionVolumeKg,
} from "@/utils/workoutLogStats";
import type { LogWithMeta } from "@/hooks/useWorkoutHistory";
import { useUnits } from "@/context/UnitsContext";
import { useI18n } from "@/context/I18nContext";
import { getExerciseByName, getExerciseName } from "@/services/localExerciseService";

interface WorkoutLogCardProps {
  log: LogWithMeta;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * A single expandable session card. Header shows duration / volume / PR
 * count; body (when expanded) shows coach feedback and per-exercise breakdown.
 *
 * Behavior matches the inline render block that previously lived in
 * `app/student/workoutHistory.tsx`.
 */
function WorkoutLogCardImpl({ log, expanded, onToggle }: WorkoutLogCardProps) {
  const { formatWeight } = useUnits();
  const { t, locale } = useI18n();
  const vol = sessionVolumeKg(log);
  const prs = countPrs(log);
  const dur = formatDurationForHistory(log.durationSeconds, t);

  return (
    <Pressable
      onPress={onToggle}
      style={{
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: Spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={Colors.success}
            />
            <Text
              style={{
                fontSize: FontSizes.tiny,
                fontWeight: "800",
                color: Colors.success,
                letterSpacing: 0.5,
              }}
            >
              {t("completedBadge")}
            </Text>
          </View>
          <Text
            style={{
              ...Typography.section,
              fontSize: FontSizes.subheading,
              fontWeight: "800",
            }}
            numberOfLines={2}
          >
            {log.workoutName || t("workoutFallbackName")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: Spacing.md,
              marginTop: Spacing.sm,
            }}
          >
            {dur ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={Colors.textMuted}
                />
                <Text style={{ ...Typography.secondary, color: Colors.text }}>
                  {dur}
                </Text>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Ionicons
                name="barbell-outline"
                size={16}
                color={Colors.textMuted}
              />
              <Text style={{ ...Typography.secondary, color: Colors.text }}>
                {formatWeight(vol)}
              </Text>
            </View>
            {prs > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Ionicons
                  name="trophy-outline"
                  size={16}
                  color={Colors.primary}
                />
                <Text
                  style={{
                    ...Typography.secondary,
                    color: Colors.primary,
                    fontWeight: "700",
                  }}
                >
                  {t(prs === 1 ? "prCount_one" : "prCount_other", { count: prs })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-forward"}
          size={22}
          color={Colors.textMuted}
        />
      </View>

      {expanded ? (
        <View
          style={{
            marginTop: Spacing.md,
            paddingTop: Spacing.md,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          {log.coachFeedback ? (
            <View
              style={{
                marginBottom: Spacing.sm,
                padding: Spacing.sm,
                borderRadius: Radius.sm,
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.primary,
              }}
            >
              <Text
                style={{
                  ...Typography.section,
                  fontSize: FontSizes.note,
                  color: Colors.primary,
                  marginBottom: 4,
                }}
              >
                {t("coachFeedbackLabel")}
              </Text>
              <Text style={{ ...Typography.secondary, color: Colors.text }}>
                {log.coachFeedback}
              </Text>
            </View>
          ) : null}
          {log.exercises.map((ex, i) => {
            const exRow = ex as WorkoutLogExercise;
            const v =
              typeof exRow.volume === "number" && Number.isFinite(exRow.volume)
                ? exRow.volume
                : computeExerciseVolumeFromLoggedSets(exRow.sets);
            const localExercise = getExerciseByName(ex.name);
            const displayName = localExercise ? getExerciseName(localExercise, locale) : ex.name;
            return (
              <View
                key={`${log.id}-${ex.name}-${i}`}
                style={{ marginBottom: Spacing.sm }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text style={{ ...Typography.section, fontSize: 15 }}>
                    {displayName}
                  </Text>
                  {exRow.isPr ? (
                    <Text
                      style={{
                        color: Colors.primary,
                        fontWeight: "800",
                        fontSize: FontSizes.caption,
                      }}
                    >
                      {t("prBadge")}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    ...Typography.secondary,
                    fontSize: FontSizes.note,
                    marginTop: 4,
                  }}
                >
                  {t("plannedLabel", { value: ex.repsPlanned || "—" })}
                </Text>
                {(exRow.sets ?? []).map((s) => {
                  const wLabel =
                    s.weight != null && Number.isFinite(s.weight)
                      ? formatWeight(s.weight)
                      : t("bodyweightAbbrev");
                  return (
                    <Text
                      key={`${log.id}-${i}-${s.setNumber}`}
                      style={{
                        ...Typography.secondary,
                        fontSize: FontSizes.note,
                      }}
                    >
                      {t("setLabel", { n: s.setNumber, weight: wLabel, reps: s.reps })}
                    </Text>
                  );
                })}
                {v > 0 ? (
                  <Text
                    style={{
                      ...Typography.secondary,
                      fontSize: FontSizes.caption,
                      marginTop: 4,
                      color: Colors.textMuted,
                    }}
                  >
                    {t("volumeLabel", { value: formatWeight(v) })}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}

export const WorkoutLogCard = memo(WorkoutLogCardImpl);
