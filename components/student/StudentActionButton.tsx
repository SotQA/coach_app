import { memo, type ComponentProps } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

export interface StudentActionButtonProps {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  variant: "primary" | "secondary";
  onPress: () => void;
}

function StudentActionButtonImpl({ title, icon, iconColor, variant, onPress }: StudentActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: variant === "primary" ? Colors.primary : Colors.card,
        borderWidth: variant === "primary" ? 0 : 1,
        borderColor: variant === "primary" ? "transparent" : Colors.border,
        opacity: pressed ? 0.92 : 1,
        ...(variant === "primary"
          ? {
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 8,
            }
          : null),
      })}
    >
      <Ionicons
        name={icon}
        size={18}
        color={iconColor ?? (variant === "primary" ? Colors.onPrimary : Colors.primary)}
      />
      <Text
        numberOfLines={3}
        style={{
          ...Typography.section,
          fontSize: FontSizes.note,
          lineHeight: 16,
          fontWeight: variant === "primary" ? "800" : "700",
          color: variant === "primary" ? Colors.onPrimary : Colors.text,
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export const StudentActionButton = memo(StudentActionButtonImpl);
