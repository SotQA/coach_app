import { memo, type ComponentProps } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

export interface StudentStatCardProps {
  label: string;
  value: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  tint?: string;
}

function StudentStatCardImpl({ label, value, icon, tint }: StudentStatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: Colors.card,
        borderRadius: Radius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={tint ?? Colors.textMuted} style={{ marginBottom: 6 }} />
      ) : null}
      <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center", width: "100%" }}>
        {label}
      </Text>
      <Text style={{ ...Typography.title, fontSize: FontSizes.h3, marginTop: 6, textAlign: "center", width: "100%" }}>
        {value}
      </Text>
    </View>
  );
}

export const StudentStatCard = memo(StudentStatCardImpl);
