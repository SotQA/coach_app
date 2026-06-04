import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { FontSizes, Typography } from "../../theme/typography";
import { useUnits } from "../../context/UnitsContext";

interface PrTimelineCardProps {
  date: Date;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  width?: number;
  onPress?: () => void;
}

function PrTimelineCardInner({
  date,
  exerciseName,
  weightKg,
  reps,
  width = 200,
  onPress,
}: PrTimelineCardProps) {
  const { formatWeight } = useUnits();

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const weightLabel =
    weightKg != null ? formatWeight(weightKg) : "Bodyweight";
  const performanceLabel = `${weightLabel} × ${reps}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        height: 100,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: Colors.primary,
        padding: Spacing.sm,
        opacity: pressed && onPress ? 0.75 : 1,
        justifyContent: "space-between",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="trophy" size={16} color={Colors.primary} />
        <Text
          style={{ ...Typography.section, flex: 1, fontSize: FontSizes.note }}
          numberOfLines={1}
        >
          {exerciseName}
        </Text>
      </View>

      <Text
        style={{
          fontSize: FontSizes.h2,
          fontWeight: "800",
          color: Colors.text,
          letterSpacing: -0.5,
        }}
        numberOfLines={1}
      >
        {performanceLabel}
      </Text>

      <Text style={{ ...Typography.micro, color: Colors.textMuted }}>{dateLabel}</Text>
    </Pressable>
  );
}

export const PrTimelineCard = React.memo(PrTimelineCardInner);
