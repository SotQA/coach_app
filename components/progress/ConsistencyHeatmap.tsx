import React from "react";
import { Pressable, Text, View } from "react-native";
import { Colors } from "../../theme/colors";
import { FontSizes, Typography } from "../../theme/typography";
import { dayKeyFromDate, dayKeyFromMs, startOfWeekMonday } from "../../utils/dateRanges";

interface ConsistencyHeatmapProps {
  countsByDay: Record<string, number>;
  endDate: Date;
  weeks?: number;
  cellSize?: number;
  gap?: number;
  onCellPress?: (dayKey: string) => void;
}

function ConsistencyHeatmapInner({
  countsByDay,
  endDate,
  weeks = 12,
  cellSize = 12,
  gap = 3,
  onCellPress,
}: ConsistencyHeatmapProps) {
  const anchorWeekStart = startOfWeekMonday(endDate);

  const gridStartMs =
    anchorWeekStart.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000;

  const days: string[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const ms = gridStartMs + (w * 7 + d) * 24 * 60 * 60 * 1000;
      days.push(dayKeyFromMs(ms));
    }
  }

  const maxCount = Math.max(1, ...days.map((k) => countsByDay[k] ?? 0));
  const totalSessions = days.reduce((s, k) => s + (countsByDay[k] ?? 0), 0);

  const todayKey = dayKeyFromDate(endDate);

  function cellColor(count: number): string {
    if (count === 0) return "transparent";
    const alpha = 0.25 + Math.min(1, count / maxCount) * 0.65;
    return `rgba(212,255,68,${alpha.toFixed(2)})`;
  }

  const gridWidth = weeks * (cellSize + gap) - gap;
  const gridHeight = 7 * (cellSize + gap) - gap;

  return (
    <View>
      <Text
        style={{
          ...Typography.micro,
          marginBottom: 8,
          color: Colors.textSecondary,
        }}
      >
        {`Last ${weeks} weeks · ${totalSessions} sessions`}
      </Text>

      <View style={{ flexDirection: "row", width: gridWidth, height: gridHeight }}>
        {Array.from({ length: weeks }).map((_, wIdx) => (
          <View
            key={wIdx}
            style={{
              flexDirection: "column",
              marginRight: wIdx < weeks - 1 ? gap : 0,
            }}
          >
            {Array.from({ length: 7 }).map((_, dIdx) => {
              const dayKey = days[wIdx * 7 + dIdx];
              const count = countsByDay[dayKey] ?? 0;
              const isFuture = dayKey > todayKey;
              const bg = isFuture ? "transparent" : cellColor(count);
              const borderColor = isFuture
                ? "transparent"
                : count === 0
                  ? Colors.hairline
                  : "transparent";

              return (
                <Pressable
                  key={dIdx}
                  onPress={() => onCellPress?.(dayKey)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    backgroundColor: bg,
                    borderWidth: count === 0 && !isFuture ? 1 : 0,
                    borderColor,
                    marginBottom: dIdx < 6 ? gap : 0,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export const ConsistencyHeatmap = React.memo(ConsistencyHeatmapInner);
