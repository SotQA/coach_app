import type { ReactNode } from "react";
import { Platform, Text, View, type ViewStyle } from "react-native";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { FontSizes } from "../../theme/typography";

type Props = {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
};

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  default: { elevation: 4 },
});

export function SettingsSection({ title, children, style }: Props) {
  return (
    <View style={[{ marginBottom: Spacing.md }, style]}>
      <Text
        style={{
          fontSize: FontSizes.caption,
          fontWeight: "800",
          letterSpacing: 1.2,
          color: Colors.primary,
          marginBottom: Spacing.sm,
          marginLeft: 2,
        }}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          {
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            borderWidth: 1,
            borderColor: Colors.border,
            overflow: "hidden",
            ...cardShadow,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}


