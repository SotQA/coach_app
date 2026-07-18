import React from "react";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { FontSizes, Typography } from "../../theme/typography";
import { useUnits } from "../../context/UnitsContext";
import { useI18n } from "../../context/I18nContext";
import { Sparkline } from "./Sparkline";

interface StrengthSparkRowProps {
  exerciseName: string;
  currentE1RM: number | null;
  deltaKg?: number | null;
  points: number[];
  onPress?: () => void;
}

function StrengthSparkRowInner({
  exerciseName,
  currentE1RM,
  deltaKg,
  points,
  onPress,
}: StrengthSparkRowProps) {
  const { formatWeight } = useUnits();
  const { t } = useI18n();

  const hasDelta = deltaKg != null && deltaKg !== 0;
  const deltaUp = deltaKg != null && deltaKg > 0;
  const deltaColor = deltaUp ? Colors.primary : Colors.danger;
  const deltaGlyph = deltaUp ? "↑" : "↓";

  const deltaLabel = deltaKg != null && deltaKg !== 0
    ? `, ${deltaKg > 0 ? "up" : "down"} ${formatWeight(Math.abs(deltaKg))}`
    : "";
  const sparklineLabel = t("a11y_sparkline_summary", {
    exerciseName,
    latest: currentE1RM != null ? formatWeight(currentE1RM) : "—",
    delta: deltaLabel || "no change",
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${exerciseName}, ${currentE1RM != null ? formatWeight(currentE1RM) : "—"}${deltaLabel}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        height: 64,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.hairline,
        opacity: pressed && onPress ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0, paddingRight: Spacing.sm }}>
        <Text
          style={{ ...Typography.section, fontSize: FontSizes.note }}
          numberOfLines={1}
        >
          {exerciseName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
          <Text
            style={{
              fontSize: FontSizes.subheading,
              fontWeight: "800",
              color: Colors.text,
            }}
          >
            {currentE1RM != null ? formatWeight(currentE1RM) : "—"}
          </Text>
          {hasDelta ? (
            <Text
              style={{
                fontSize: FontSizes.caption,
                fontWeight: "700",
                color: deltaColor,
              }}
            >
              {deltaGlyph} {formatWeight(Math.abs(deltaKg!))}
            </Text>
          ) : null}
        </View>
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={sparklineLabel} importantForAccessibility="yes">
        <Sparkline
          points={points}
          width={120}
          height={40}
          color={Colors.primary}
          highlightLast
        />
      </View>
    </Pressable>
  );
}

export const StrengthSparkRow = React.memo(StrengthSparkRowInner);
