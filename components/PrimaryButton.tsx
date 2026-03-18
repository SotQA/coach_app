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

// Simple shared primary button with consistent rounded styling and color.
export const PrimaryButton: FC<PrimaryButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled,
}) => {
  const baseStyle: ViewStyle = {
    width: "100%",
    borderRadius: Radius.md,
    paddingVertical: 15,
    paddingHorizontal: Spacing.md,
    backgroundColor: disabled ? Colors.disabled : Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  };

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
      style={{ width: "100%" }}
    >
      <Animated.View style={[baseStyle, style, { transform: [{ scale }] }]}>
        <Text
          style={[
            {
              ...Typography.section,
              color: Colors.text,
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

