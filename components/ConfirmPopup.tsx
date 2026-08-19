import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Colors } from "../theme/colors";
import { Radius, Spacing } from "../theme/spacing";
import { Typography, FontSizes } from "../theme/typography";

type Props = {
  visible: boolean;
  icon: string;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmTone?: "danger";
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Generic bottom-anchored confirmation popup — icon, title, body, then a
 * divided Cancel/Confirm action row. Reused for "Remove workout?" and
 * "Discard changes?"; not workout-specific despite living alongside them.
 */
export function ConfirmPopup({
  visible,
  icon,
  title,
  body,
  cancelLabel,
  confirmLabel,
  confirmTone,
  confirming,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={confirming ? undefined : onCancel}
        />
        <View
          style={{
            position: "absolute",
            left: Spacing.sm,
            right: Spacing.sm,
            bottom: 60,
            backgroundColor: Colors.card,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: Radius.md,
            overflow: "hidden",
          }}
        >
          <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, alignItems: "center" }}>
            <Text style={{ fontSize: 28, marginBottom: Spacing.xs }}>{icon}</Text>
            <Text style={{ ...Typography.title, fontSize: FontSizes.subheading, color: Colors.text, marginBottom: 4, textAlign: "center" }}>
              {title}
            </Text>
            <Text style={{ ...Typography.secondary, color: Colors.textMuted, textAlign: "center", lineHeight: 16 }}>
              {body}
            </Text>
          </View>

          <View style={{ height: 0.5, backgroundColor: Colors.border }} />

          {confirming ? (
            <View style={{ paddingVertical: Spacing.sm, alignItems: "center" }}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={{ flexDirection: "row" }}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: Spacing.sm,
                  alignItems: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "500" }}>
                  {cancelLabel}
                </Text>
              </Pressable>
              <View style={{ width: 0.5, backgroundColor: Colors.border }} />
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: Spacing.sm,
                  alignItems: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    ...Typography.secondary,
                    color: confirmTone === "danger" ? Colors.danger : Colors.text,
                    fontWeight: "700",
                  }}
                >
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
