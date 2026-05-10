import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ExerciseGroup } from "../../components/workout/ExerciseGroup";
import { type SetDraft } from "../../components/workout/SetInputRow";
import { useAuth } from "../../context/AuthContext";
import { useActiveWorkoutSession, type ActiveExerciseDraft } from "../../context/ActiveWorkoutSessionContext";
import { useElapsedSeconds } from "../../context/ElapsedTimeContext";
import { useI18n } from "../../context/I18nContext";
import type { WorkoutPlan } from "../../types/Workout";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography, FontSizes } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { RestTimerBar } from "../../components/RestTimerBar";
import { formatElapsedForTimer, parseRestSeconds } from "../../utils/workoutDuration";
import { logger } from "../../utils/logger";
import { useWorkoutExecutionData } from "../../hooks/useWorkoutExecutionData";
import { useFinishWorkout } from "../../hooks/useFinishWorkout";
import { useSetInputRefs } from "../../hooks/useSetInputRefs";
import { useUnits } from "../../context/UnitsContext";
import { toKg, toUnit } from "../../utils/units";
import type { WeightUnit } from "../../context/UnitsContext";

type ExerciseDraft = { sets: SetDraft[] };

function weightToDisplay(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null || !Number.isFinite(kg)) return "";
  const display = toUnit(kg, unit);
  if (display == null) return "";
  return unit === "lb" ? display.toFixed(1) : String(Math.round(display * 10) / 10);
}

/** Build ActiveExerciseDraft[] from a loaded WorkoutPlan (fresh session).
 *  Drafts always store kg; prescribed weight is converted for display via weightToDisplay. */
function buildExerciseDrafts(plan: WorkoutPlan, unit: WeightUnit): ActiveExerciseDraft[] {
  return plan.exercises.map((ex) => ({
    name: ex.name,
    sets: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({
      weight: weightToDisplay(
        ex.weight != null && Number.isFinite(Number(ex.weight)) ? Number(ex.weight) : null,
        unit
      ),
      reps: "",
      rpe: ex.rpe != null && Number.isFinite(Number(ex.rpe)) ? String(ex.rpe) : "",
      completed: false,
    })),
  }));
}

/** Convert persisted ActiveExerciseDraft[] → local ExerciseDraft[] for UI.
 *  Session stores kg strings; convert to active unit for display. */
function toLocalDrafts(exercises: ActiveExerciseDraft[], unit: WeightUnit): ExerciseDraft[] {
  return exercises.map((ex) => ({
    sets: ex.sets.map((s) => {
      const kg = parseFloat(s.weight);
      const displayW =
        s.weight !== "" && Number.isFinite(kg) ? weightToDisplay(kg, unit) : s.weight;
      return { weight: displayW, reps: s.reps, rpe: s.rpe, done: s.completed };
    }),
  }));
}

export default function WorkoutExecution() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const activeWorkout = useActiveWorkoutSession();
  const elapsedSeconds = useElapsedSeconds();
  const { t } = useI18n();
  const authUserId = authUser?.id;

  const params = useLocalSearchParams<{ workoutPlanId?: string; groupId?: string }>();
  const workoutPlanId = useMemo(() => String(params.workoutPlanId ?? "").trim(), [params.workoutPlanId]);
  const groupId = useMemo(() => String(params.groupId ?? "").trim(), [params.groupId]);

  const { unit } = useUnits();
  const { data: execData, loading, error: loadError } = useWorkoutExecutionData(workoutPlanId);
  const plan = execData?.plan ?? null;
  const bestWeightByExercise = execData?.bestWeightByExercise ?? new Map<string, number>();

  const { finishWorkout, submitting, submitError } = useFinishWorkout();
  const refs = useSetInputRefs();

  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");

  const planRef = useRef<WorkoutPlan | null>(null);
  const draftsRef = useRef<ExerciseDraft[]>([]);
  planRef.current = plan;
  draftsRef.current = drafts;

  const sessionInitRef = useRef(false);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset session-init guard when user or plan changes.
  useEffect(() => {
    sessionInitRef.current = false;
    refs.reset();
  }, [workoutPlanId, authUserId, refs]);

  // Session init: restore existing session or start a fresh one.
  useEffect(() => {
    if (!plan || sessionInitRef.current) return;
    sessionInitRef.current = true;
    const existing = activeWorkout.session;
    if (existing && existing.workoutPlanId === workoutPlanId) {
      setDrafts(toLocalDrafts(existing.exercises, unit));
      setSessionNotes(existing.notes ?? "");
    } else if (!existing) {
      const exercises = buildExerciseDrafts(plan, unit);
      activeWorkout.startSession({ studentId: authUserId!, workoutPlanId: plan.id, workoutName: plan.name, groupId, exercises, notes: "" });
      setDrafts(toLocalDrafts(exercises, unit));
      setSessionNotes("");
    } else {
      router.replace({ pathname: "/student/workoutExecution", params: { workoutPlanId: existing.workoutPlanId } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  // Cleanup notes debounce on unmount.
  useEffect(() => {
    return () => { if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current); };
  }, []);

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetDraft>) => {
    const exercise = planRef.current?.exercises?.[exIdx];
    const draftsForEx = draftsRef.current[exIdx];
    if (!exercise) { logger.warn("[workoutExecution] missing exercise at idx", exIdx); return; }
    if (!draftsForEx || draftsForEx.sets[setIdx] === undefined) {
      logger.warn("[workoutExecution] missing set at idx", { exIdx, setIdx }); return;
    }
    // Convert the display-unit weight to kg before persisting into the session context.
    let sessionWeight: string | undefined;
    if (patch.weight !== undefined) {
      const displayVal = parseFloat(patch.weight);
      if (Number.isFinite(displayVal)) {
        const kgVal = toKg(displayVal, unit);
        sessionWeight = kgVal != null ? String(kgVal) : "";
      } else {
        sessionWeight = patch.weight;
      }
    }
    activeWorkout.updateSet(exIdx, setIdx, {
      ...(patch.weight !== undefined && { weight: sessionWeight! }),
      ...(patch.reps !== undefined && { reps: patch.reps }),
      ...(patch.rpe !== undefined && { rpe: patch.rpe }),
      ...(patch.done !== undefined && { completed: patch.done }),
    });
    if (patch.done === true) {
      const restSecs = parseRestSeconds(exercise.rest);
      if (restSecs && restSecs > 0) activeWorkout.startRestTimer(restSecs);
    }
    setDrafts((prev) =>
      prev.map((row, i) =>
        i !== exIdx ? row : { sets: row.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) }
      )
    );
  };

  const handleNotesChange = (text: string) => {
    setSessionNotes(text);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => { activeWorkout.updateNotes(text); }, 400);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={S.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (loadError && !plan) {
    return (
      <View style={S.errorContainer}>
        <Text style={S.errorText}>{loadError.message}</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={S.errorContainer}>
        <Text style={S.errorText}>Workout plan not loaded.</Text>
      </View>
    );
  }

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={S.scroll}
        contentContainerStyle={[
          S.scrollContent,
          activeWorkout.session?.restTimer?.isActive && S.scrollContentRestActive,
        ]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
        {/* Header */}
        <View style={S.headerBlock}>
          <View style={S.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [S.backBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </Pressable>
            <Text style={S.headerTitle}>{t("logSession")}</Text>
            <View style={S.timerBadge}>
              <Text style={S.timerText}>{formatElapsedForTimer(elapsedSeconds)}</Text>
            </View>
          </View>
          <Text style={S.planName}>{plan.name}</Text>
          <Text style={S.planMeta}>
            {(authUser?.firstName || authUser?.lastName
              ? `${authUser?.firstName ?? ""} ${authUser?.lastName ?? ""}`.trim()
              : "You") +
              " • " +
              new Date().toLocaleDateString(undefined, { weekday: "short" })}
          </Text>
        </View>

        {/* Session notes */}
        <View style={S.notesCard}>
          <Text style={S.notesLabel}>{t("sessionNotes")}</Text>
          <TextInput
            value={sessionNotes}
            onChangeText={handleNotesChange}
            placeholder={t("addSessionNotes")}
            placeholderTextColor={Colors.textMuted}
            multiline
            editable={!submitting}
            style={S.notesInput}
          />
        </View>

        {/* Exercise groups */}
        {plan.exercises.map((exercise, exIdx) => (
          <ExerciseGroup
            key={`${exercise.name}-${exIdx}`}
            exerciseIndex={exIdx}
            exercise={exercise}
            drafts={drafts[exIdx]?.sets ?? []}
            disabled={submitting}
            onSetChange={(setIdx, patch) => updateSet(exIdx, setIdx, patch)}
            onMarkSetDone={(setIdx) => {
              const nextDone = !drafts[exIdx]?.sets[setIdx]?.done;
              updateSet(exIdx, setIdx, { done: nextDone });
              if (nextDone) refs.focusNextSet(exIdx, setIdx);
            }}
            registerRef={(setIdx, field, node) => refs.registerRef(exIdx, setIdx, field, node)}
          />
        ))}

        {submitError ? (
          <Text style={S.errorText}>{submitError}</Text>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Sticky footer */}
      <View style={S.footer}>
        <RestTimerBar />
        {submitting ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <PrimaryButton
            title={t("finishSession")}
            onPress={() => plan && finishWorkout({ plan, drafts, notes: sessionNotes, bestWeightByExercise })}
          />
        )}
      </View>
    </ScreenLayout>
  );
}

const S = StyleSheet.create({
  centered:              { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  errorContainer:        { flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg },
  errorText:             { color: Colors.danger, marginBottom: Spacing.sm },
  scroll:                { flex: 1, backgroundColor: Colors.bg },
  scrollContent:         { padding: Spacing.md, paddingBottom: 120 },
  scrollContentRestActive: { paddingBottom: 220 },
  headerBlock:           { marginBottom: Spacing.sm },
  headerRow:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn:               { width: 40, height: 40, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  headerTitle:           { ...Typography.section, fontWeight: "900" },
  timerBadge:            { paddingVertical: 8, paddingHorizontal: 10, borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  timerText:             { ...Typography.secondary, color: Colors.primary, fontVariant: ["tabular-nums"] },
  planName:              { ...Typography.title, fontSize: FontSizes.h3, marginTop: Spacing.sm },
  planMeta:              { ...Typography.secondary, color: Colors.textMuted, marginTop: 4 },
  notesCard:             { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  notesLabel:            { ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 },
  notesInput:            { borderWidth: 1, borderColor: Colors.border, padding: 12, borderRadius: Radius.md, color: Colors.text, backgroundColor: Colors.surface, minHeight: 72 },
  footer:                { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: Spacing.sm, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
});
