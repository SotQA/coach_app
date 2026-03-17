import { FC } from "react";
import { View, Text } from "react-native";
import type { StudentSummary } from "../types/StudentSummary";
import { PrimaryButton } from "./PrimaryButton";

interface StudentCardProps {
  student: StudentSummary;
  onPress?: () => void;
}

// Simple card for displaying basic student information with an optional action.
export const StudentCard: FC<StudentCardProps> = ({ student, onPress }) => {
  const label = student.email || "Student";
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        backgroundColor: "#020617",
        borderWidth: 1,
        borderColor: "#1F2937",
      }}
    >
      <Text style={{ fontWeight: "700", color: "#F9FAFB", marginBottom: 2 }}>
        {label}
      </Text>
      {student.email ? (
        <Text style={{ color: "#9CA3AF", marginBottom: 12 }}>{student.email}</Text>
      ) : null}
      {onPress ? (
        <PrimaryButton
          title="View / Plan Workout"
          onPress={onPress}
          style={{ alignSelf: "flex-start" }}
        />
      ) : null}
    </View>
  );
};

