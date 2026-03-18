import { FC } from "react";
import { View, Text } from "react-native";
import type { StudentSummary } from "../types/StudentSummary";
import { PrimaryButton } from "./PrimaryButton";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

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
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginVertical: Spacing.xs,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ ...Typography.section, marginBottom: 2 }}>{label}</Text>
      {student.email ? (
        <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
          {student.email}
        </Text>
      ) : null}
      {onPress ? (
        <PrimaryButton
          title="View / Plan Workout"
          onPress={onPress}
          style={{ alignSelf: "flex-start", width: "auto", paddingHorizontal: Spacing.md }}
        />
      ) : null}
    </View>
  );
};

