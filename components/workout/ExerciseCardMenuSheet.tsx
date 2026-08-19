import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../context/I18nContext";
import { BottomSheet } from "../BottomSheet";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";

export interface ExerciseCardMenuSheetProps {
  visible: boolean;
  isSubstituted: boolean;
  isFlagged: boolean;
  onCancel: () => void;
  /** Fires once this sheet has actually finished closing — see BottomSheetProps.onClosed. */
  onClosed?: () => void;
  onViewDetails: () => void;
  onReplace: () => void;
  onUndoSub: () => void;
  onFlag: () => void;
  onRemoveFlag: () => void;
}

/** Per-exercise-card overflow menu — consolidates the details / substitute / flag actions. */
export function ExerciseCardMenuSheet({
  visible,
  isSubstituted,
  isFlagged,
  onCancel,
  onClosed,
  onViewDetails,
  onReplace,
  onUndoSub,
  onFlag,
  onRemoveFlag,
}: ExerciseCardMenuSheetProps) {
  const { t } = useI18n();

  const rows = [
    {
      key: "details",
      icon: <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />,
      label: t("exerciseMenuViewDetails"),
      onPress: onViewDetails,
    },
    isSubstituted
      ? { key: "undoSub", icon: <Text style={{ fontSize: 15, color: Colors.subBlue }}>⇄</Text>, label: t("exerciseMenuUndoSub"), onPress: onUndoSub }
      : { key: "replace", icon: <Text style={{ fontSize: 15, color: Colors.subBlue }}>⇄</Text>, label: t("exerciseMenuReplace"), onPress: onReplace },
    isFlagged
      ? { key: "removeFlag", icon: <Text style={{ fontSize: 15, color: Colors.flagOrange }}>⚑</Text>, label: t("exerciseMenuRemoveFlag"), onPress: onRemoveFlag }
      : { key: "flag", icon: <Text style={{ fontSize: 15, color: Colors.flagOrange }}>⚑</Text>, label: t("exerciseMenuFlag"), onPress: onFlag },
  ];

  return (
    <BottomSheet visible={visible} onClose={onCancel} onClosed={onClosed}>
      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={row.onPress}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sm,
            paddingVertical: 14,
            paddingHorizontal: Spacing.md,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {row.icon}
          <Text style={{ ...Typography.body }}>{row.label}</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={onCancel}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
          marginTop: Spacing.xs,
          backgroundColor: Colors.surface,
          borderRadius: Radius.lg,
          paddingVertical: 12,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontWeight: "600" }}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheet>
  );
}
