import { memo } from "react";
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dayKeyFromDate } from "@/utils/dateRanges";
import { Colors } from "@/theme/colors";
import { Radius, Spacing } from "@/theme/spacing";
import { FontSizes, Typography } from "@/theme/typography";
import type {
  CalCell,
  DayAggregate,
} from "@/hooks/useWorkoutHistory";

interface WorkoutCalendarProps {
  cells: CalCell[];
  countsByDay: Record<string, DayAggregate>;
  heatOpacity: (count: number) => number;
  selectedDayKey: string | null;
  todayKey: string;
  onSelectDay: (key: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}

const ROW_GAP = 6;
const CELL_HEIGHT = 38;
const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/**
 * Month-navigation row + calendar card with day cells, heatmap, and legend.
 * Pure presentation — all state lives in `useWorkoutHistory`.
 */
function WorkoutCalendarImpl({
  cells,
  countsByDay,
  heatOpacity,
  selectedDayKey,
  todayKey,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}: WorkoutCalendarProps) {
  const { width: windowW } = useWindowDimensions();
  const calendarMaxW = windowW - (Spacing.md + Spacing.lg) * 2;
  const cellW = Math.max(
    32,
    Math.floor((calendarMaxW - ROW_GAP * 6) / 7),
  );

  return (
    <>
      {/* Month nav: prev / today / next */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: Spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={onPrevMonth}
          style={({ pressed }) => ({
            padding: Spacing.sm,
            borderRadius: Radius.md,
            backgroundColor: Colors.card,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to current month"
          onPress={onCurrentMonth}
          style={{
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.sm,
          }}
        >
          <Text
            style={{
              ...Typography.section,
              color: Colors.primary,
              fontWeight: "700",
            }}
          >
            Today
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={onNextMonth}
          style={({ pressed }) => ({
            padding: Spacing.sm,
            borderRadius: Radius.md,
            backgroundColor: Colors.card,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </Pressable>
      </View>

      {/* Calendar card */}
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Colors.border,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          marginBottom: Spacing.md,
        }}
      >
        <View style={{ width: calendarMaxW, alignSelf: "center" }}>
          {/* Weekday headers */}
          <View
            style={{
              flexDirection: "row",
              marginBottom: 10,
              gap: ROW_GAP,
            }}
          >
            {WEEKDAY_LABELS.map((L, i) => (
              <View
                key={`${L}-${i}`}
                style={{ width: cellW, alignItems: "center" }}
              >
                <Text
                  style={{
                    ...Typography.secondary,
                    fontSize: FontSizes.caption,
                    fontWeight: "800",
                    color: Colors.textMuted,
                  }}
                >
                  {L}
                </Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: ROW_GAP,
            }}
          >
            {cells.map((cell, idx) => {
              if (cell.kind === "pad") {
                return (
                  <View
                    key={`p-${idx}`}
                    style={{ width: cellW, height: CELL_HEIGHT }}
                  />
                );
              }
              const key = dayKeyFromDate(cell.date);
              const agg = countsByDay[key];
              const count = agg?.count ?? 0;
              const isSelected = selectedDayKey === key;
              const isToday = key === todayKey;
              const op = heatOpacity(count);
              return (
                <Pressable
                  key={key}
                  onPress={() => onSelectDay(key)}
                  style={{
                    width: cellW,
                    height: CELL_HEIGHT,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: Radius.md,
                    borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                    borderColor: isSelected
                      ? Colors.primary
                      : isToday
                        ? Colors.border
                        : "transparent",
                    backgroundColor:
                      count > 0 ? `rgba(212,255,68,${op})` : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: Colors.text,
                      lineHeight: 17,
                    }}
                  >
                    {cell.dayNum}
                  </Text>
                  {count > 0 ? (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 2.5,
                        marginTop: 2,
                        backgroundColor: Colors.success,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: Spacing.md,
            flexWrap: "wrap",
            gap: Spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text
              style={{
                ...Typography.secondary,
                fontSize: FontSizes.caption,
                color: Colors.textMuted,
                fontWeight: "600",
              }}
            >
              Less
            </Text>
            {[0.15, 0.35, 0.55, 0.85].map((a, i) => (
              <View
                key={i}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: Colors.primary,
                  opacity: a,
                }}
              />
            ))}
            <Text
              style={{
                ...Typography.secondary,
                fontSize: FontSizes.caption,
                color: Colors.textMuted,
                fontWeight: "600",
              }}
            >
              More
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: Colors.success,
                }}
              />
              <Text
                style={{
                  ...Typography.secondary,
                  fontSize: FontSizes.caption,
                  color: Colors.textMuted,
                  fontWeight: "600",
                }}
              >
                Completed
              </Text>
            </View>
          </View>
        </View>
      </View>

    </>
  );
}

export const WorkoutCalendar = memo(WorkoutCalendarImpl);
