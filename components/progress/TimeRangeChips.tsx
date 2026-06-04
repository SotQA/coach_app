import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { FontSizes } from "../../theme/typography";
import type { TimeRangePreset } from "../../utils/coachProgressAnalytics";

interface TimeRangeChipsProps {
  value: TimeRangePreset;
  onChange: (p: TimeRangePreset) => void;
}

const PRESETS: { key: TimeRangePreset; label: string }[] = [
  { key: "4w", label: "4 wks" },
  { key: "8w", label: "8 wks" },
  { key: "3m", label: "3 mo" },
  { key: "6m", label: "6 mo" },
  { key: "all", label: "All" },
];

function TimeRangeChipsInner({ value, onChange }: TimeRangeChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: Spacing.xs, paddingBottom: Spacing.sm }}
    >
      {PRESETS.map((p) => {
        const selected = p.key === value;
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={({ pressed }) => ({
              backgroundColor: selected ? Colors.primary : Colors.surface,
              borderRadius: Radius.pill,
              paddingVertical: 6,
              paddingHorizontal: 14,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text
              style={{
                fontSize: FontSizes.caption,
                fontWeight: "700",
                color: selected ? Colors.onPrimary : Colors.textSecondary,
                letterSpacing: 0.2,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const TimeRangeChips = React.memo(TimeRangeChipsInner);
