import { memo } from "react";
import { Text, View } from "react-native";
import { Colors } from "@/theme/colors";
import { Radius, Spacing } from "@/theme/spacing";
import { Typography } from "@/theme/typography";
import type { LogWithMeta } from "@/hooks/useWorkoutHistory";
import { WorkoutLogCard } from "./WorkoutLogCard";

interface WorkoutLogListProps {
  logs: LogWithMeta[];
  expandedLogId: string | null;
  onToggleExpanded: (id: string) => void;
}

/**
 * Renders the per-day session list. Empty state matches the inline
 * empty card that previously lived in `app/student/workoutHistory.tsx`.
 */
function WorkoutLogListImpl({
  logs,
  expandedLogId,
  onToggleExpanded,
}: WorkoutLogListProps) {
  if (logs.length === 0) {
    return (
      <View
        style={{
          backgroundColor: Colors.card,
          borderRadius: Radius.lg,
          padding: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.border,
          marginBottom: Spacing.md,
        }}
      >
        <Text
          style={{
            ...Typography.secondary,
            color: Colors.textMuted,
            textAlign: "center",
          }}
        >
          No sessions for this day with the current filter. Try another date or
          &quot;All&quot;.
        </Text>
      </View>
    );
  }

  return (
    <>
      {logs.map((log) => (
        <WorkoutLogCard
          key={log.id}
          log={log}
          expanded={expandedLogId === log.id}
          onToggle={() => onToggleExpanded(log.id)}
        />
      ))}
    </>
  );
}

export const WorkoutLogList = memo(WorkoutLogListImpl);
