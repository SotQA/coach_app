import { FC } from "react";
import { View, Text } from "react-native";
import type { WorkoutPlan } from "../types/Workout";

interface WorkoutCardProps {
  plan: WorkoutPlan;
}

// Displays a simple summary of a workout plan and its exercises.
export const WorkoutCard: FC<WorkoutCardProps> = ({ plan }) => {
  return (
    <View
      style={{
        borderRadius: 20,
        padding: 16,
        marginVertical: 8,
        backgroundColor: "#020617",
        borderWidth: 1,
        borderColor: "#1F2937",
      }}
    >
      <Text
        style={{
          fontWeight: "700",
          marginBottom: 8,
          color: "#E5E7EB",
          fontSize: 16,
        }}
      >
        Workout Plan
      </Text>
      {plan.exercises.map((exercise, index) => (
        <View
          key={`${exercise.name}-${index}`}
          style={{
            marginBottom: 8,
            paddingVertical: 4,
            borderBottomWidth: index === plan.exercises.length - 1 ? 0 : 1,
            borderBottomColor: "#1F2937",
          }}
        >
          <Text style={{ fontWeight: "600", color: "#F9FAFB" }}>
            {exercise.name}
          </Text>
          <Text style={{ color: "#9CA3AF" }}>
            {exercise.sets} sets x {exercise.reps} reps
            {exercise.weight ? ` @ ${exercise.weight}kg` : ""}
          </Text>
        </View>
      ))}
    </View>
  );
};

