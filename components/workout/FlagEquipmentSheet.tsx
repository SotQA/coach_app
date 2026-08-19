import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useI18n } from "../../context/I18nContext";
import type { EquipmentFlagReason } from "../../context/ActiveWorkoutSessionContext";
import { EQUIPMENT_FLAG_REASON_LABEL_KEY } from "../../utils/equipmentFlagLabels";
import { BottomSheet } from "../BottomSheet";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

const REASONS: { value: EquipmentFlagReason; icon: string; labelKey: string }[] = [
  { value: "different_gym", icon: "🏢", labelKey: EQUIPMENT_FLAG_REASON_LABEL_KEY.different_gym },
  { value: "different_machine", icon: "⚙️", labelKey: EQUIPMENT_FLAG_REASON_LABEL_KEY.different_machine },
  { value: "miscalibrated", icon: "⚖️", labelKey: EQUIPMENT_FLAG_REASON_LABEL_KEY.miscalibrated },
  { value: "other", icon: "✏️", labelKey: EQUIPMENT_FLAG_REASON_LABEL_KEY.other },
];

const NOTE_MAX_LENGTH = 100;

export interface FlagEquipmentSheetProps {
  visible: boolean;
  /** Pre-selects the current flag's reason/note when re-opening an already-flagged exercise. */
  initialReason?: EquipmentFlagReason;
  initialNote?: string;
  onCancel: () => void;
  onConfirm: (reason: EquipmentFlagReason, note?: string) => void;
}

export function FlagEquipmentSheet({
  visible,
  initialReason,
  initialNote,
  onCancel,
  onConfirm,
}: FlagEquipmentSheetProps) {
  const { t } = useI18n();

  const [reason, setReason] = useState<EquipmentFlagReason>(initialReason ?? "different_gym");
  const [note, setNote] = useState(initialNote ?? "");

  useEffect(() => {
    if (visible) {
      setReason(initialReason ?? "different_gym");
      setNote(initialNote ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      header={
        <>
          <Text style={{ ...Typography.section, fontWeight: "900", paddingHorizontal: Spacing.md }}>
            {t("flagSheetTitle")}
          </Text>
          <Text
            style={{
              ...Typography.secondary,
              color: Colors.textMuted,
              paddingHorizontal: Spacing.md,
              marginTop: 4,
              marginBottom: Spacing.sm,
              fontSize: FontSizes.caption,
            }}
          >
            {t("flagSheetSubtitle")}
          </Text>
          <View style={{ height: 1, backgroundColor: Colors.border, marginBottom: 4 }} />
        </>
      }
    >
      {REASONS.map((r) => {
        const isOn = r.value === reason;
        return (
          <Pressable
            key={r.value}
            onPress={() => setReason(r.value)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              paddingVertical: 12,
              paddingHorizontal: Spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 18 }}>{r.icon}</Text>
            <Text style={{ ...Typography.body, flex: 1 }}>{t(r.labelKey)}</Text>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: isOn ? Colors.flagOrange : Colors.textMuted,
                backgroundColor: isOn ? Colors.flagOrange : "transparent",
              }}
            />
          </Pressable>
        );
      })}

      {reason === "other" ? (
        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}>
          <TextInput
            value={note}
            onChangeText={(v) => setNote(v.slice(0, NOTE_MAX_LENGTH))}
            placeholder={t("flagOtherNotePlaceholder")}
            placeholderTextColor={Colors.textMuted}
            maxLength={NOTE_MAX_LENGTH}
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: Radius.md,
              padding: 10,
              color: Colors.text,
              backgroundColor: Colors.surface,
            }}
          />
        </View>
      ) : null}

      <View style={{ height: Spacing.xs }} />

      <Pressable
        onPress={() => onConfirm(reason, reason === "other" && note.trim() ? note.trim() : undefined)}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
          marginBottom: Spacing.xs,
          backgroundColor: Colors.flagOrange,
          borderRadius: Radius.lg,
          paddingVertical: 14,
          paddingHorizontal: Spacing.sm,
          alignItems: "center",
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ ...Typography.section, fontWeight: "900", color: "#000", textAlign: "center" }}>
          {t("flagConfirmButton")}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
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
