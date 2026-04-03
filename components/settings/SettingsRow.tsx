import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

type IonName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IonName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showDivider?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
};

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showDivider = true,
  destructive = false,
  showChevron = true,
}: Props) {
  const titleColor = destructive ? Colors.danger : Colors.text;
  const iconColor = destructive ? Colors.danger : Colors.primary;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: Spacing.md,
          gap: Spacing.sm,
          backgroundColor: pressed ? "rgba(255,255,255,0.04)" : "transparent",
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.sm,
            backgroundColor: destructive ? "rgba(255,69,58,0.12)" : Colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Typography.section, fontWeight: "700", color: titleColor }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 3 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showChevron ? <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} /> : null}
      </Pressable>
      {showDivider ? (
        <View
          style={{
            marginLeft: Spacing.md + 40 + Spacing.sm,
            height: 1,
            backgroundColor: Colors.border,
          }}
        />
      ) : null}
    </View>
  );
}
