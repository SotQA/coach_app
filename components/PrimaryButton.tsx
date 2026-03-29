import { FC, useRef } from "react";
import { Animated, Pressable, Text, TextStyle, ViewStyle } from "react-native";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

// Primary = lime fill + dark label; callers can override `style.backgroundColor` for secondary rows.
export const PrimaryButton: FC<PrimaryButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled,
}) => {
  const requestedWidth = (style as any)?.width as ViewStyle["width"] | undefined;
  const containerWidth = requestedWidth ?? "100%";

  const customBg = style?.backgroundColor;
  const usesPrimaryFill =
    !disabled && (customBg === undefined || customBg === Colors.primary);

  const baseStyle: ViewStyle = {
    borderRadius: Radius.lg,
    paddingVertical: 15,
    paddingHorizontal: Spacing.md,
    backgroundColor: disabled ? Colors.disabled : Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  };

  const defaultLabelColor = disabled
    ? Colors.textMuted
    : usesPrimaryFill
      ? Colors.onPrimary
      : Colors.text;

  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      style={{ width: containerWidth }}
    >
      <Animated.View
        style={[
          baseStyle,
          { width: "100%" },
          style,
          { transform: [{ scale }] },
        ]}
      >
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
      </Animated.View>
    </Pressable>
  );
};
