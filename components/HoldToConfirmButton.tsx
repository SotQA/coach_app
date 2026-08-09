import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography } from "../theme/typography";

interface HoldToConfirmButtonProps {
  title: string;
  onConfirm: () => void;
  /** @default 1000 */
  durationMs?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export function HoldToConfirmButton({
  title,
  onConfirm,
  durationMs = 1000,
  style,
  textStyle,
  disabled,
}: HoldToConfirmButtonProps) {
  const progress = useSharedValue(0);
  const confirmedRef = useRef(false);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  const fireConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  }, [onConfirm]);

  const handlePressIn = () => {
    if (disabled) return;
    confirmedRef.current = false;
    setIsHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          confirmedRef.current = true;
          scheduleOnRN(fireConfirm);
        }
      }
    );
  };

  const handlePressOut = () => {
    setIsHolding(false);
    if (confirmedRef.current) return;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 200 });
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Hold to confirm"
    >
      <View
        style={[
          styles.base,
          { backgroundColor: disabled ? Colors.disabled : Colors.danger },
          style,
        ]}
      >
        <Animated.View style={[styles.fill, fillStyle]} />
        <Text style={[styles.label, textStyle]}>{isHolding ? "Hold..." : title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    paddingVertical: 15,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  label: {
    ...Typography.section,
    color: "white",
    textAlign: "center",
  },
});
