import { FC } from "react";
import { View, Text } from "react-native";
import type { Student } from "../types/Student";
import { PrimaryButton } from "./PrimaryButton";

interface StudentCardProps {
  student: Student;
  onPress?: () => void;
}

// Simple card for displaying basic student information with an optional action.
export const StudentCard: FC<StudentCardProps> = ({ student, onPress }) => {
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
        {student.name}
      </Text>
      <Text style={{ color: "#9CA3AF", marginBottom: 12 }}>{student.email}</Text>
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

