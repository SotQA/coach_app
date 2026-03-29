import type { ReactNode } from "react";
import { View, Text, ViewStyle } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

type Props = {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
};

export function ProfileCard({ title, right, children, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.card,
          borderRadius: Radius.md,
          padding: 18,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        style,
      ]}
    >
      {title ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: Spacing.sm,
          }}
        >
          <Text style={{ ...Typography.section, color: Colors.textMuted }}>{title}</Text>
          {right ? <View>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

