import { useRef, useState } from "react";
import { Pressable, TouchableOpacity, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import { useUnits } from "../../context/UnitsContext";
import { toUnit, unitSuffix } from "../../utils/units";
import type { Exercise } from "../../types/Workout";
import type { LastSetResult } from "../../utils/workoutMetrics";
import type { ActiveEquipmentFlag, ActiveSubstitution } from "../../context/ActiveWorkoutSessionContext";
import { EQUIPMENT_FLAG_REASON_LABEL_KEY } from "../../utils/equipmentFlagLabels";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { SetInputRow, type SetDraft } from "./SetInputRow";
import { ExerciseCardMenuSheet } from "./ExerciseCardMenuSheet";
import { getExerciseById, getExerciseName } from "../../services/localExerciseService";

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
  /** Present when this exercise was swapped for a different one, this session only. */
  substitution?: ActiveSubstitution;
  /** Present when this session's equipment was flagged as non-comparable. */
  equipmentFlag?: ActiveEquipmentFlag;
  /** Opens the substitution picker sheet. */
  onOpenSub?: () => void;
  /** Restores the original exercise (tapping "Undo" on an already-substituted card). */
  onUndoSub?: () => void;
  /** Opens the equipment-flag reason sheet. */
  onOpenFlag?: () => void;
  /** Clears the flag (tapping "Flagged" on an already-flagged card). */
  onClearFlag?: () => void;
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
  substitution,
  equipmentFlag,
  onOpenSub,
  onUndoSub,
  onOpenFlag,
  onClearFlag,
}: ExerciseGroupProps) {
  const { t, locale } = useI18n();
  const { unit } = useUnits();
  const router = useRouter();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Holds the action chosen from the menu (e.g. "open the Sub sheet") until the menu's own
  // Modal has actually finished closing — firing it immediately would briefly overlap two
  // RN Modals and can leave the screen unresponsive.
  const pendingMenuActionRef = useRef<(() => void) | undefined>(undefined);
  const exerciseDetailPath =
    user?.role === "coach"
      ? "/coach/exerciseDetail"
      : user?.role === "athlete"
      ? "/athlete/exerciseDetail"
      : "/student/exerciseDetail";

  const activeDbId = substitution?.exerciseDbId ?? exercise.exerciseDbId;
  const localExercise = activeDbId ? getExerciseById(activeDbId) : null;
  const displayName = localExercise ? getExerciseName(localExercise, locale) : substitution?.name ?? exercise.name;
  const flagReasonLabel = equipmentFlag ? t(EQUIPMENT_FLAG_REASON_LABEL_KEY[equipmentFlag.reason]) : null;

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

  const openDetails = () => {
    router.push({
      pathname: exerciseDetailPath as any,
      params: {
        exerciseName: displayName,
        exerciseDbId: activeDbId ?? "",
        videoUrl: substitution ? "" : exercise.videoUrl ?? "",
        coachNote: exercise.coachNote ?? "",
        lang: locale,
      },
    });
  };

  return (
    <View style={[styles.container, substitution ? styles.containerSubstituted : equipmentFlag ? styles.containerFlagged : null]}>
      {/* Exercise header */}
      <View style={styles.headerRow}>
        <TouchableOpacity activeOpacity={0.7} onPress={openDetails} style={styles.header}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexBadgeText}>{exerciseIndex + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.exerciseName, substitution ? styles.exerciseNameSubstituted : null]}>
              {displayName}
            </Text>
            {substitution ? (
              <>
                <Text style={styles.originalStruck}>{substitution.originalName}</Text>
                <Text style={styles.subbedLabel}>{t("substitutedThisSessionLabel")}</Text>
              </>
            ) : (
              <>
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
              </>
            )}
            {exercise.coachNote ? (
              <Text style={styles.coachNote}>
                {t("coachNoteLabel", { note: exercise.coachNote })}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <Pressable
          onPress={() => setMenuOpen(true)}
          disabled={disabled}
          hitSlop={8}
          style={({ pressed }) => [styles.menuBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>

      {equipmentFlag ? (
        <View style={styles.flagPill}>
          <Text style={styles.flagPillText}>{t("flagPillLabel", { reason: flagReasonLabel })}</Text>
        </View>
      ) : null}

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

      <ExerciseCardMenuSheet
        visible={menuOpen}
        isSubstituted={!!substitution}
        isFlagged={!!equipmentFlag}
        onCancel={() => setMenuOpen(false)}
        onClosed={() => {
          pendingMenuActionRef.current?.();
          pendingMenuActionRef.current = undefined;
        }}
        onViewDetails={() => {
          pendingMenuActionRef.current = openDetails;
          setMenuOpen(false);
        }}
        onReplace={() => {
          pendingMenuActionRef.current = onOpenSub;
          setMenuOpen(false);
        }}
        onUndoSub={() => {
          pendingMenuActionRef.current = onUndoSub;
          setMenuOpen(false);
        }}
        onFlag={() => {
          pendingMenuActionRef.current = onOpenFlag;
          setMenuOpen(false);
        }}
        onRemoveFlag={() => {
          pendingMenuActionRef.current = onClearFlag;
          setMenuOpen(false);
        }}
      />
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
  containerSubstituted: {
    borderWidth: 1.5,
    borderColor: Colors.subBlue,
    backgroundColor: Colors.subBlueTint,
  },
  containerFlagged: {
    borderWidth: 1.5,
    borderColor: Colors.flagOrange,
    backgroundColor: Colors.flagOrangeTint,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  exerciseNameSubstituted: {
    color: Colors.subBlue,
  },
  originalStruck: {
    color: Colors.textMuted,
    fontSize: FontSizes.tiny,
    marginTop: 2,
    textDecorationLine: "line-through",
  },
  subbedLabel: {
    color: Colors.subBlue,
    fontSize: FontSizes.tiny,
    marginTop: 2,
    fontWeight: "600",
  },
  flagPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    backgroundColor: Colors.flagOrangeTint,
    borderWidth: 1,
    borderColor: Colors.flagOrange,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: Spacing.sm,
  },
  flagPillText: {
    color: Colors.flagOrange,
    fontSize: FontSizes.tiny,
    fontWeight: "600",
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
