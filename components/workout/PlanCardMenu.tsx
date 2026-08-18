import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Spacing } from "../../theme/spacing";
import { FontSizes } from "../../theme/typography";

type Anchor = { x: number; y: number; width: number; height: number };

type Props = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

/**
 * Per-card ··· overflow menu. Renders its dropdown through a transparent
 * Modal (rather than inline absolute positioning) so it isn't clipped by
 * the ScrollView the card lives in, anchored under the tapped button via
 * measureInWindow.
 */
export function PlanCardMenu({ isOpen, onOpen, onClose, onEdit, onRemove }: Props) {
  const { t } = useI18n();
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const handleOpen = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      onOpen();
    });
  };

  const windowWidth = Dimensions.get("window").width;

  return (
    <>
      <Pressable
        ref={buttonRef}
        onPress={handleOpen}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("planCardMenuA11y")}
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isOpen ? Colors.primary : Colors.surface,
          flexShrink: 0,
        }}
      >
        <Ionicons name="ellipsis-horizontal" size={16} color={isOpen ? Colors.onPrimary : Colors.textMuted} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }}
            onPress={onClose}
          />
          {anchor ? (
            <View
              style={{
                position: "absolute",
                top: anchor.y + anchor.height + 6,
                right: windowWidth - (anchor.x + anchor.width),
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 13,
                minWidth: 140,
                maxWidth: windowWidth - Spacing.md * 2,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOpacity: 0.6,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  onClose();
                  onEdit();
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  height: 44,
                  paddingHorizontal: Spacing.sm,
                  borderBottomWidth: 0.5,
                  borderBottomColor: Colors.border,
                  backgroundColor: pressed ? Colors.surface : "transparent",
                })}
              >
                <Ionicons name="create-outline" size={16} color={Colors.text} />
                <Text style={{ color: Colors.text, fontSize: FontSizes.note, fontWeight: "500" }}>
                  {t("editWorkoutA11y")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onClose();
                  onRemove();
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  height: 44,
                  paddingHorizontal: Spacing.sm,
                  backgroundColor: pressed ? Colors.surface : "transparent",
                })}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={{ color: Colors.danger, fontSize: FontSizes.note, fontWeight: "500" }}>
                  {t("removeWorkoutA11y")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
