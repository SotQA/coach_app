import { forwardRef, memo, useCallback } from "react";
import { Text, TextInput, View, StyleSheet, type TextInputProps } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "../theme/colors";

const FOCUS_MS = 200;

export interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  error?: string | null;
  maxLength?: number;
  testID?: string;
}

const InputFieldBase = forwardRef<TextInput, InputFieldProps>(function InputFieldBase(
  {
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType,
    autoCapitalize,
    autoComplete,
    error,
    maxLength,
    testID,
  },
  ref
) {
  const focused = useSharedValue(0);

  const handleFocus = useCallback(() => {
    focused.value = withTiming(1, { duration: FOCUS_MS });
  }, [focused]);

  const handleBlur = useCallback(() => {
    focused.value = withTiming(0, { duration: FOCUS_MS });
  }, [focused]);

  const animatedFrameStyle = useAnimatedStyle(() => {
    const borderWidth = interpolate(focused.value, [0, 1], [1, 1.5]);
    const borderColor = interpolateColor(focused.value, [0, 1], [
      Colors.hairlineStrong,
      Colors.primary,
    ]);
    const shadowOpacity = interpolate(focused.value, [0, 1], [0, 0.6]);
    const elevation = interpolate(focused.value, [0, 1], [0, 6]);
    return {
      borderWidth,
      borderColor,
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity,
      shadowRadius: 8,
      elevation,
    };
  });

  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputRow, animatedFrameStyle]}>
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={styles.input}
        />
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export const InputField = memo(InputFieldBase);
InputField.displayName = "InputField";

const styles = StyleSheet.create({
  column: { flexDirection: "column" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  inputRow: {
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
    fontSize: 16,
    color: Colors.text,
    minHeight: 44,
  },
  error: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 6,
  },
});
