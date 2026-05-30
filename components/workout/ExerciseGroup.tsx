import { TouchableOpacity, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../context/I18nContext";
import { useUnits } from "../../context/UnitsContext";
import { toUnit, unitSuffix } from "../../utils/units";
import type { Exercise } from "../../types/Workout";
import type { LastSetResult } from "../../utils/workoutMetrics";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { SetInputRow, type SetDraft } from "./SetInputRow";

export interface ExerciseGroupProps {
  exerciseIndex: number;
  exercise: Exercise;
  drafts: SetDraft[];
  /** Sets from the most recent session for this exercise, for reference display. */
  lastResults?: LastSetResult[];
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
  lastResults,
  disabled = false,
  onSetChange,
  onMarkSetDone,
  registerRef,
}: ExerciseGroupProps) {
  const { t } = useI18n();
  const { unit } = useUnits();
  const router = useRouter();

  const displayWeight =
    exercise.weight != null && Number.isFinite(Number(exercise.weight))
      ? toUnit(Number(exercise.weight), unit)
      : null;
  const weightSuffix =
    displayWeight != null
      ? ` @ ${parseFloat(displayWeight.toFixed(2))}${unitSuffix(unit)}`
      : "";
  const rpeSuffix = exercise.rpe != null ? ` RPE ${exercise.rpe}` : "";

  // Format last-session results as "60×8, 60×8, 60×8" (weight in active unit).
  const lastResultsLabel = (() => {
    if (!lastResults || lastResults.length === 0) return null;
    const parts = lastResults.map((s) => {
      const w = s.weight != null ? toUnit(s.weight, unit) : null;
      const wStr = w != null ? parseFloat(w.toFixed(2)).toString() : "—";
      return `${wStr}×${s.reps}`;
    });
    return parts.join(", ");
  })();

  return (
    <View style={styles.container}>
      {/* Exercise header */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: "/student/exerciseDetail",
            params: {
              exerciseName: exercise.name,
              exerciseDbId: exercise.exerciseDbId ?? "",
              videoUrl: exercise.videoUrl ?? "",
              coachNote: exercise.coachNote ?? "",
              lang: "en",
            },
          })
        }
        style={styles.header}
      >
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>{exerciseIndex + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Ionicons name="information-circle" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.exerciseMeta}>
            {t("target", { sets: exercise.sets, reps: exercise.reps })}
            {weightSuffix}
            {rpeSuffix}
          </Text>
          {lastResultsLabel ? (
            <Text style={styles.lastResults}>
              {t("lastSession")}: {lastResultsLabel}
            </Text>
          ) : null}
          {exercise.coachNote ? (
            <Text style={styles.coachNote}>
              {t("coachNoteLabel", { note: exercise.coachNote })}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

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
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 4,
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
  lastResults: {
    ...Typography.secondary,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: "italic",
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
