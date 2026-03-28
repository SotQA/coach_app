import type { ComponentProps } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

type Props = {
  icon?: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon = "barbell-outline", title, subtitle }: Props) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.md,
      }}
    >
      <Ionicons name={icon} size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.sm }} />
      <Text style={{ ...Typography.section, textAlign: "center", marginBottom: subtitle ? 6 : 0 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ ...Typography.secondary, textAlign: "center", maxWidth: 280 }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}
