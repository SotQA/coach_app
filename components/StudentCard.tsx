import { FC } from "react";
import { Platform, View, Text } from "react-native";
import type { StudentSummary } from "../types/StudentSummary";
import { Avatar } from "./Avatar";
import { PrimaryButton } from "./PrimaryButton";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography, FontSizes } from "../theme/typography";
import { useI18n } from "../context/I18nContext";

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
  currentSplitName?: string | null;
}

// Simple card for displaying basic student information with an optional action.
export const StudentCard: FC<StudentCardProps> = ({
  student,
  onPress,
  actionTitle,
  secondaryActionTitle,
  onSecondaryPress,
  currentSplitName,
}) => {
  const { t } = useI18n();
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
  const header = fullName || student.email || t("roleStudent");
  const resolvedActionTitle = actionTitle ?? t("planWorkout");
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
        <Avatar
          photoURL={student.photoURL}
          initials={initials}
          size={44}
          backgroundColor={Colors.surface}
          textColor={Colors.text}
          borderColor={Colors.primary}
          borderWidth={2}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ ...Typography.section, fontSize: 16, fontWeight: "800" }}>{header}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
            {currentSplitName
              ? t("currentSplitChip", { name: currentSplitName })
              : t("noTrainingSplitAssigned")}
          </Text>
        </View>
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
              textStyle={{ color: Colors.text, fontWeight: "800", fontSize: FontSizes.note }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PrimaryButton
              title={resolvedActionTitle}
              onPress={onPress as () => void}
              style={{
                width: "100%",
                borderRadius: Radius.md,
                paddingVertical: 11,
                paddingHorizontal: Spacing.xs,
                ...(Platform.OS === "ios"
                  ? {
                      shadowColor: Colors.primary,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.45,
                      shadowRadius: 10,
                    }
                  : { elevation: 8 }),
              }}
              textStyle={{ fontWeight: "800", fontSize: FontSizes.note }}
            />
          </View>
        </View>
      ) : onPress ? (
        <View style={{ marginTop: Spacing.sm }}>
          <PrimaryButton
            title={resolvedActionTitle}
            onPress={onPress}
            style={{ alignSelf: "flex-start", width: "auto", paddingHorizontal: Spacing.md }}
          />
        </View>
      ) : null}
    </View>
  );
};



