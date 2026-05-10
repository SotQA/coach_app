import { StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../../context/I18nContext";
import { useUnits } from "../../context/UnitsContext";
import { toUnit, unitSuffix } from "../../utils/units";
import type { Exercise } from "../../types/Workout";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { SetInputRow, type SetDraft } from "./SetInputRow";

export interface ExerciseGroupProps {
  exerciseIndex: number;
  exercise: Exercise;
  drafts: SetDraft[];
  disabled?: boolean;
  onSetChange: (setIndex: number, patch: Partial<SetDraft>) => void;
  onMarkSetDone: (setIndex: number) => void;
  registerRef: (
    setIndex: number,
    field: "weight" | "reps" | "rpe",
    node: TextInput | null
  ) => void;
}

/**
 * Renders the header (name, prescribed sets×reps, target weight, coach note)
 * and a set-table header + one `SetInputRow` per set.
 * Does not know about the plan as a whole — only its own exercise.
 */
export function ExerciseGroup({
  exerciseIndex,
  exercise,
  drafts,
  disabled = false,
  onSetChange,
  onMarkSetDone,
  registerRef,
}: ExerciseGroupProps) {
  const { t } = useI18n();
  const { unit } = useUnits();

  const displayWeight =
    exercise.weight != null && Number.isFinite(Number(exercise.weight))
      ? toUnit(Number(exercise.weight), unit)
      : null;
  const weightSuffix =
    displayWeight != null
      ? ` @ ${unit === "lb" ? displayWeight.toFixed(1) : Math.round(displayWeight * 10) / 10}${unitSuffix(unit)}`
      : "";
  const rpeSuffix = exercise.rpe != null ? ` RPE ${exercise.rpe}` : "";

  return (
    <View style={styles.container}>
      {/* Exercise header */}
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>{exerciseIndex + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseMeta}>
            {t("target", { sets: exercise.sets, reps: exercise.reps })}
            {weightSuffix}
            {rpeSuffix}
          </Text>
          {exercise.coachNote ? (
            <Text style={styles.coachNote}>
              {t("coachNoteLabel", { note: exercise.coachNote })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Set table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: 32 }]}>{t("setColumn")}</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{unitSuffix(unit).toUpperCase()}</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t("repsColumn")}</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t("rpeColumn")}</Text>
        <Text style={[styles.tableHeaderCell, { width: 34 }]}>✓</Text>
      </View>

      {/* Set rows */}
      {drafts.map((setDraft, setIdx) => (
        <SetInputRow
          key={`set-${exerciseIndex}-${setIdx}`}
          setNumber={setIdx + 1}
          draft={setDraft}
          disabled={disabled}
          onChange={(patch) => onSetChange(setIdx, patch)}
          onMarkDone={() => onMarkSetDone(setIdx)}
          registerRef={(field, node) => registerRef(setIdx, field, node)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceSubtle,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: Colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: {
    ...Typography.secondary,
    color: Colors.primary,
    fontWeight: "800",
  },
  exerciseName: {
    ...Typography.section,
    fontWeight: "900",
  },
  exerciseMeta: {
    ...Typography.secondary,
    color: Colors.textMuted,
    marginTop: 2,
  },
  coachNote: {
    ...Typography.secondary,
    color: Colors.primary,
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: Spacing.xs,
  },
  tableHeaderCell: {
    ...Typography.secondary,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
