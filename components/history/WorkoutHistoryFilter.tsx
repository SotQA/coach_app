import { memo } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import {
  type WorkoutCategory,
  type WorkoutCategoryChip,
} from "@/constants/workoutCategories";
import { Colors } from "@/theme/colors";
import { Radius, Spacing } from "@/theme/spacing";
import { FontSizes } from "@/theme/typography";

interface WorkoutHistoryFilterProps {
  /** Chips currently visible. Pass `chipsPresent` from `useWorkoutHistory`. */
  chips: readonly WorkoutCategoryChip[];
  active: WorkoutCategory;
  onChange: (c: WorkoutCategory) => void;
}

/**
 * Horizontal filter-chip row. Behavior is identical to the inline row
 * that previously lived in `app/student/workoutHistory.tsx`.
 */
function WorkoutHistoryFilterImpl({
  chips,
  active,
  onChange,
}: WorkoutHistoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.xs, marginBottom: Spacing.md }}
    >
      {chips.map((c) => {
        const sel = active === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: Radius.sm,
              backgroundColor: sel ? Colors.primary : Colors.surface,
              borderWidth: 1,
              borderColor: sel ? Colors.primary : Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: FontSizes.note,
                fontWeight: sel ? "800" : "600",
                color: sel ? Colors.onPrimary : Colors.text,
              }}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const WorkoutHistoryFilter = memo(WorkoutHistoryFilterImpl);
