import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Radius } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { normalizeDecimalInput } from "../../utils/inputParsing";

export type SetDraft = { weight: string; reps: string; rpe: string; done: boolean };

export interface SetInputRowProps {
  setNumber: number;
  draft: SetDraft;
  disabled?: boolean;
  onChange: (patch: Partial<SetDraft>) => void;
  onMarkDone: () => void;
  registerRef: (field: "weight" | "reps" | "rpe", node: TextInput | null) => void;
}

/**
 * A single set row: weight / reps / RPE inputs and the "done" toggle.
 * Does not know about focus order — the parent handles that via `onMarkDone`
 * and the `registerRef` callback.
 */
export function SetInputRow({
  setNumber,
  draft,
  disabled = false,
  onChange,
  onMarkDone,
  registerRef,
}: SetInputRowProps) {
  const done = draft.done;

  return (
    <View
      style={[
        styles.row,
        done ? styles.rowDone : styles.rowPending,
      ]}
    >
      <Text style={[styles.setNumber, done && styles.setNumberDone]}>{setNumber}</Text>

      <TextInput
        ref={(r) => registerRef("weight", r)}
        value={draft.weight}
        onChangeText={(v) => onChange({ weight: normalizeDecimalInput(v) })}
        inputMode="decimal"
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={Colors.textMuted}
        editable={!disabled}
        style={styles.input}
      />
      <TextInput
        ref={(r) => registerRef("reps", r)}
        value={draft.reps}
        onChangeText={(v) => onChange({ reps: v.replace(/[^\d]/g, "") })}
        inputMode="numeric"
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        editable={!disabled}
        style={styles.input}
      />
      <TextInput
        ref={(r) => registerRef("rpe", r)}
        value={draft.rpe}
        onChangeText={(v) => onChange({ rpe: normalizeDecimalInput(v) })}
        inputMode="decimal"
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={Colors.textMuted}
        editable={!disabled}
        style={styles.input}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Complete set ${setNumber}`}
        onPress={onMarkDone}
        disabled={disabled}
        style={({ pressed }) => [
          styles.checkBtn,
          done ? styles.checkBtnDone : styles.checkBtnPending,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Ionicons
          name="checkmark"
          size={18}
          color={done ? Colors.onPrimary : "rgba(255,255,255,0.20)"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  rowDone: {
    backgroundColor: "rgba(212,255,68,0.10)",
    borderColor: "rgba(212,255,68,0.45)",
  },
  rowPending: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.08)",
  },
  setNumber: {
    width: 32,
    ...Typography.section,
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
  },
  setNumberDone: {
    color: Colors.primary,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    color: Colors.text,
    backgroundColor: Colors.surfaceSubtle,
    textAlign: "center",
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBtnDone: {
    borderColor: "rgba(212,255,68,0.55)",
    backgroundColor: Colors.primary,
  },
  checkBtnPending: {
    borderColor: Colors.surfaceHighlight,
    backgroundColor: Colors.surfaceSubtle,
  },
});
