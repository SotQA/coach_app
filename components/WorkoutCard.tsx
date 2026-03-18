import { FC } from "react";
import { View, Text } from "react-native";
import type { WorkoutPlan } from "../types/Workout";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface WorkoutCardProps {
  plan: WorkoutPlan;
}

// Displays a simple summary of a workout plan and its exercises.
export const WorkoutCard: FC<WorkoutCardProps> = ({ plan }) => {
  const title = (plan.name ?? "").toString().trim() || "Workout Plan";
  return (
    <View
      style={{
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginVertical: Spacing.xs,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text
        style={{
          ...Typography.section,
          marginBottom: Spacing.sm,
          color: Colors.text,
        }}
      >
        {title}
      </Text>
      {plan.exercises.map((exercise, index) => (
        <View
          key={`${exercise.name}-${index}`}
          style={{
            marginBottom: Spacing.xs,
            paddingVertical: 6,
            borderBottomWidth: index === plan.exercises.length - 1 ? 0 : 1,
            borderBottomColor: Colors.border,
          }}
        >
          <Text style={{ ...Typography.section, fontSize: 15 }}>
            {exercise.name}
          </Text>
          <Text style={Typography.secondary}>
            {exercise.sets} sets x {exercise.reps} reps
            {exercise.weight ? ` @ ${exercise.weight}kg` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
};

