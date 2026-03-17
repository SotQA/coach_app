import { FC } from "react";
import { Text, TouchableOpacity, ViewStyle, TextStyle } from "react-native";

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
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: disabled ? "#A0AEC0" : "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[baseStyle, style]}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text
        style={[
          {
            color: "white",
            fontWeight: "600",
            fontSize: 16,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

