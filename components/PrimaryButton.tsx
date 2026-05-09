import { FC, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextStyle, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

const PRESS_SCALE = 0.97;

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  /** @default "primary" — lime fill. `"secondary"` = transparent + primary border + primary label. */
  variant?: "primary" | "secondary";
  /** Shown to the left of the title (e.g. icon). */
  leftSlot?: ReactNode;
  /** When true, shows a spinner and ignores presses. */
  loading?: boolean;
}

export const PrimaryButton: FC<PrimaryButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled,
  variant = "primary",
  leftSlot,
  loading = false,
}) => {
  const requestedWidth = (style as { width?: ViewStyle["width"] })?.width;
  const containerWidth = requestedWidth ?? "100%";

  const isSecondary = variant === "secondary";
  const inactive = disabled || loading;

  const customBg = style?.backgroundColor;
  const usesPrimaryFill =
    !inactive &&
    !isSecondary &&
    (customBg === undefined || customBg === Colors.primary);

  const defaultLabelColor = inactive
    ? Colors.textMuted
    : isSecondary
      ? Colors.primary
      : usesPrimaryFill
        ? Colors.onPrimary
        : Colors.text;

  const baseStyle: ViewStyle = {
    borderRadius: Radius.lg,
    paddingVertical: 15,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  };

  if (isSecondary) {
    baseStyle.backgroundColor = "transparent";
    baseStyle.borderWidth = 1.5;
    baseStyle.borderColor = inactive ? Colors.disabled : Colors.primary;
  } else {
    baseStyle.backgroundColor = inactive ? Colors.disabled : Colors.primary;
  }

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const runPressIn = () => {
    if (inactive) return;
    scale.value = withSpring(PRESS_SCALE);
  };
  const runPressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      onPressIn={runPressIn}
      onPressOut={runPressOut}
      style={{ width: containerWidth }}
    >
      <Animated.View
        style={[
          baseStyle,
          { width: "100%" },
          leftSlot && !loading ? { flexDirection: "row", gap: 10 } : null,
          style,
          animStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isSecondary ? Colors.primary : Colors.onPrimary} />
        ) : (
          <>
            {leftSlot}
            <Text
              style={[
                {
                  ...Typography.section,
                  color: defaultLabelColor,
                  textAlign: "center",
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
};
