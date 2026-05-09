import { memo, type ComponentProps } from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

export interface StudentActionRowProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone?: "neutral" | "danger";
  onPress: () => void;
  disabled?: boolean;
}

/** Compact icon action (legacy name: RowAction in studentDetails). */
function StudentActionRowImpl({ icon, label, tone, onPress, disabled }: StudentActionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: tone === "danger" ? Colors.dangerTint : Colors.border,
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={tone === "danger" ? "#FCA5A5" : Colors.text} />
    </Pressable>
  );
}

export const StudentActionRow = memo(StudentActionRowImpl);
