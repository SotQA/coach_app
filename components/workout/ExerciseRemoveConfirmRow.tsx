import { Pressable, Text, View } from "react-native";
import { useI18n } from "../../context/I18nContext";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";

type Props = {
  exerciseName: string;
  onKeep: () => void;
  onRemove: () => void;
};

/** Expands in place of an ExerciseCard while its removal is being confirmed. */
export function ExerciseRemoveConfirmRow({ exerciseName, onKeep, onRemove }: Props) {
  const { t } = useI18n();
  return (
    <View
      style={{
        backgroundColor: "rgba(255,69,58,0.12)",
        borderWidth: 1,
        borderColor: Colors.danger,
        borderRadius: Radius.md,
        padding: Spacing.sm,
      }}
    >
      <Text style={{ ...Typography.section, color: Colors.text, fontWeight: "700", marginBottom: Spacing.sm }}>
        {t("removeExerciseTitle", { name: exerciseName })}
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <Pressable
          onPress={onKeep}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: Colors.surface,
            borderRadius: Radius.sm,
            paddingVertical: Spacing.xs,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, fontSize: FontSizes.note }}>
            {t("keepExerciseAction")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: Colors.danger,
            borderRadius: Radius.sm,
            paddingVertical: Spacing.xs,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ ...Typography.secondary, color: "white", fontSize: FontSizes.note, fontWeight: "700" }}>
            {t("removeAction")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
