import { FC } from "react";
import { Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StudentSummary } from "../types/StudentSummary";
import { PrimaryButton } from "./PrimaryButton";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface StudentCardProps {
  student: StudentSummary;
  onPress?: () => void;
  /**
   * Backwards compatible single action (used by older screens).
   */
  actionTitle?: string;
  /**
   * Optional secondary action (screenshot-style cards).
   */
  secondaryActionTitle?: string;
  onSecondaryPress?: () => void;
}

// Simple card for displaying basic student information with an optional action.
export const StudentCard: FC<StudentCardProps> = ({
  student,
  onPress,
  actionTitle = "Plan Workout",
  secondaryActionTitle,
  onSecondaryPress,
}) => {
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
  const header = fullName || student.email || "Student";
  const initials =
    `${student.firstName?.trim()?.[0] ?? ""}${student.lastName?.trim()?.[0] ?? ""}`.toUpperCase() ||
    "S";

  const showTwoButtons = Boolean(onPress && secondaryActionTitle && onSecondaryPress);
  return (
    <View
      style={{
        borderRadius: Radius.lg,
        padding: Spacing.md,
        marginVertical: Spacing.xs,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: Colors.surface,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...Typography.section, fontWeight: "900" }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.section, fontSize: 16, fontWeight: "800" }}>{header}</Text>
          {student.email ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
              {student.email}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More actions"
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>

      {showTwoButtons ? (
        <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, alignItems: "stretch" }}>
          {/* PrimaryButton uses width: 100% unless width is set — wrap so each gets half the row. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <PrimaryButton
              title={secondaryActionTitle as string}
              onPress={onSecondaryPress as () => void}
              style={{
                width: "100%",
                backgroundColor: Colors.surface,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: Radius.md,
                paddingVertical: 11,
                paddingHorizontal: Spacing.xs,
              }}
              textStyle={{ color: Colors.text, fontWeight: "800", fontSize: 13 }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PrimaryButton
              title={actionTitle}
              onPress={onPress}
              style={{
                width: "100%",
                borderRadius: Radius.md,
                paddingVertical: 11,
                paddingHorizontal: Spacing.xs,
              }}
              textStyle={{ fontWeight: "800", fontSize: 13, color: Colors.onPrimary }}
            />
          </View>
        </View>
      ) : onPress ? (
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton
            title={actionTitle}
            onPress={onPress}
            style={{ alignSelf: "flex-start", width: "auto", paddingHorizontal: Spacing.md }}
          />
        </View>
      ) : null}
    </View>
  );
};

