import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "../../components/PrimaryButton";
import { useAuth } from "../../context/AuthContext";
import { useActiveWorkout, type ActiveExerciseDraft } from "../../context/ActiveWorkoutContext";
import { workoutService } from "../../services/workoutService";
import type { LoggedSet, WorkoutLog, WorkoutPlan } from "../../types/Workout";
import {
  buildBestWeightMapFromLogs,
  computeExerciseVolumeFromLoggedSets,
  computeTotalVolume,
  normalizeExerciseName,
} from "../../utils/workoutMetrics";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../theme/colors";
import { Radius, Spacing } from "../../theme/spacing";
import { Typography } from "../../theme/typography";
import { ScreenLayout } from "../../components/ScreenLayout";
import { RestTimerBar } from "../../components/RestTimerBar";
import { formatElapsedForTimer, parseRestSeconds } from "../../utils/workoutDuration";

// ─── Local draft types (mirror ActiveSetDraft, using `done` for UI clarity) ──
type SetDraft = { weight: string; reps: string; rpe: string; done: boolean };
type ExerciseDraft = { sets: SetDraft[] };

function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeDecimalInput(text: string): string {
  let t = text.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = t.indexOf(".");
  if (firstDot >= 0) {
    t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
  }
  if (t.startsWith(".")) t = `0${t}`;
  return t;
}

function getNextSetFocus(
  exIdx: number,
  setIdx: number,
  plan: WorkoutPlan
): { ex: number; set: number } | null {
  const nSets = Math.max(1, Number(plan.exercises[exIdx]?.sets) || 1);
  if (setIdx + 1 < nSets) return { ex: exIdx, set: setIdx + 1 };
  if (exIdx + 1 < plan.exercises.length) return { ex: exIdx + 1, set: 0 };
  return null;
}

/** Build ActiveExerciseDraft[] from a loaded WorkoutPlan (fresh session). */
function buildExerciseDrafts(plan: WorkoutPlan): ActiveExerciseDraft[] {
  return plan.exercises.map((ex) => ({
    name: ex.name,
    sets: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({
      weight:
        ex.weight != null && Number.isFinite(Number(ex.weight)) ? String(ex.weight) : "",
      reps: "",
      rpe: ex.rpe != null && Number.isFinite(Number(ex.rpe)) ? String(ex.rpe) : "",
      completed: false,
    })),
  }));
}

/** Convert persisted ActiveExerciseDraft[] → local ExerciseDraft[] for UI. */
function toLocalDrafts(exercises: ActiveExerciseDraft[]): ExerciseDraft[] {
  return exercises.map((ex) => ({
    sets: ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
      done: s.completed,
    })),
  }));
}

export default function WorkoutExecution() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const activeWorkout = useActiveWorkout();
  const authUserId = authUser?.id;
  const authUserRole = authUser?.role;
  const params = useLocalSearchParams<{
    workoutPlanId?: string;
    groupId?: string;
    workoutName?: string;
  }>();
  const workoutPlanId = useMemo(
    () => String(params.workoutPlanId ?? "").trim(),
    [params.workoutPlanId]
  );
  const groupId = useMemo(() => String(params.groupId ?? "").trim(), [params.groupId]);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [priorLogs, setPriorLogs] = useState<WorkoutLog[]>([]);
  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const planRef = useRef<WorkoutPlan | null>(null);
  const draftsRef = useRef<ExerciseDraft[]>([]);
  planRef.current = plan;
  draftsRef.current = drafts;

  // Guard to prevent double-initialization when plan loads.
  const sessionInitRef = useRef(false);

  // Debounce timer for syncing notes to context (avoids AsyncStorage thrash on every keystroke).
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for focusing next row inputs: [exIdx][setIdx] -> { weight, reps, rpe }
  const inputRefs = useRef<
    { weight: TextInput | null; reps: TextInput | null; rpe: TextInput | null }[][]
  >([]);

  // ── Load plan & prior logs ────────────────────────────────────────────────
  useEffect(() => {
    sessionInitRef.current = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      setPlan(null);

      try {
        if (!workoutPlanId) {
          setError("Missing workoutPlanId.");
          return;
        }
        if (!authUserId || authUserRole !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const loaded = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!loaded) {
          setError("Workout plan not found.");
          return;
        }
        if (loaded.studentId !== authUserId) {
          setError("You don't have access to this workout plan.");
          return;
        }

        const history = await workoutService.getWorkoutHistory(authUserId);
        setPriorLogs(Array.isArray(history) ? history : []);
        setPlan(loaded);
      } catch (e: any) {
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, authUserId, authUserRole]);

  // ── Session init: restore existing session or start a fresh one ──────────
  // Runs once per plan load. Uses the context session as source of truth.
  useEffect(() => {
    if (!plan || sessionInitRef.current) return;
    sessionInitRef.current = true;

    const existing = activeWorkout.session;

    if (existing && existing.workoutPlanId === workoutPlanId) {
      // ✅ Restore: user returned to an in-progress session.
      setDrafts(toLocalDrafts(existing.exercises));
      setSessionNotes(existing.notes ?? "");
    } else if (!existing) {
      // 🆕 Fresh start: no active session at all.
      const exercises = buildExerciseDrafts(plan);
      activeWorkout.startSession({
        studentId: authUserId!,
        workoutPlanId: plan.id,
        workoutName: plan.name,
        groupId,
        exercises,
        notes: "",
      });
      setDrafts(toLocalDrafts(exercises));
      setSessionNotes("");
    } else {
      // ⚠️ A different session is active — redirect to it instead.
      router.replace({
        pathname: "/student/workoutExecution",
        params: { workoutPlanId: existing.workoutPlanId },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  // Cleanup notes debounce on unmount.
  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    };
  }, []);

  const bestWeightByExercise = useMemo(
    () => buildBestWeightMapFromLogs(priorLogs),
    [priorLogs]
  );

  // ── Set update: keeps local UI state + context in sync ───────────────────
  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetDraft>) => {
    // Sync to global context for persistence.
    activeWorkout.updateSet(exIdx, setIdx, {
      ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
      ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
      ...(patch.rpe !== undefined ? { rpe: patch.rpe } : {}),
      ...(patch.done !== undefined ? { completed: patch.done } : {}),
    });

    // Auto-start rest timer when a set is marked as completed.
    if (patch.done === true && planRef.current) {
      const exercise = planRef.current.exercises[exIdx];
      const restSecs = parseRestSeconds(exercise?.rest);
      if (restSecs && restSecs > 0) {
        activeWorkout.startRestTimer(restSecs);
      }
    }

    // Update local UI state.
    setDrafts((prev) =>
      prev.map((row, i) =>
        i !== exIdx
          ? row
          : { sets: row.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) }
      )
    );
  };

  // ── Notes update: debounce context sync to avoid AsyncStorage thrash ─────
  const handleNotesChange = (text: string) => {
    setSessionNotes(text);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      activeWorkout.updateNotes(text);
    }, 400);
  };

  // ── Finish session: save to Firestore, clear context + storage ───────────
  const handleSubmit = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!authUser || authUser.role !== "student") {
        setError("You must be logged in as a student.");
        return;
      }

      const completedExercises = plan.exercises.map((exercise, exIdx) => {
        const draft = drafts[exIdx];
        if (!draft || draft.sets.length === 0) {
          throw new Error(`Missing set data for "${exercise.name}".`);
        }

        const loggedSets: LoggedSet[] = draft.sets.map((d, si) => {
          if (!d.done) {
            return { setNumber: si + 1, reps: 0, weight: null };
          }
          const raw = String(d.reps).trim();
          const r = raw === "" ? 0 : Number(raw);
          if (!Number.isFinite(r) || !Number.isInteger(r) || r < 0) {
            throw new Error(
              `Set ${si + 1} (${exercise.name}): use a whole number for reps (0 skips the set).`
            );
          }
          let weightOut: number | null = null;
          if (r > 0) {
            const trimmedW = d.weight.trim();
            if (trimmedW !== "") {
              const w = parseKgInput(d.weight);
              if (w === null) {
                throw new Error(`Set ${si + 1} (${exercise.name}): invalid weight.`);
              }
              weightOut = w;
            }
          }
          return { setNumber: si + 1, reps: r, weight: weightOut };
        });

        const exKey = normalizeExerciseName(exercise.name);
        const prevBest = bestWeightByExercise.get(exKey);
        const maxKg = Math.max(
          0,
          ...loggedSets
            .filter((s) => s.reps > 0)
            .map((s) => (s.weight != null && Number.isFinite(s.weight) ? s.weight : 0))
        );
        const isPr = maxKg > 0 && (prevBest === undefined || maxKg > prevBest);
        const volume = computeExerciseVolumeFromLoggedSets(loggedSets);

        return {
          name: exercise.name,
          repsPlanned: String(exercise.reps ?? ""),
          sets: loggedSets,
          rest: exercise.rest ?? "",
          tempo: exercise.tempo ?? "",
          rpe: exercise.rpe ?? null,
          volume,
          isPr,
        };
      });

      const totalVolume = computeTotalVolume(completedExercises);
      const prNames = completedExercises.filter((e) => e.isPr).map((e) => e.name);

      // Duration: derived from session startedAt for accuracy across app reopens.
      const startedAt = activeWorkout.session?.startedAt ?? Date.now();
      const durationSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

      await workoutService.logCompletedWorkout({
        studentId: authUser.id,
        workoutPlanId: plan.id,
        workoutName: plan.name,
        exercises: completedExercises,
        completedAt: new Date().toISOString(),
        totalVolume,
        durationSeconds,
        sessionNotes: sessionNotes.trim() || undefined,
      });

      // Clear the active session from context + AsyncStorage.
      await activeWorkout.finishSession();

      if (prNames.length > 0) {
        Alert.alert("Great session!", `🔥 New PR on: ${prNames.join(", ")}`);
      }
      setMessage("Workout saved to history.");
      router.replace("/student/workoutHistory");
    } catch (e: any) {
      setError(e.message ?? "Failed to save workout.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error && !plan) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: Spacing.md, backgroundColor: Colors.bg }}>
        <Text style={{ color: Colors.danger }}>Workout plan not loaded.</Text>
      </View>
    );
  }

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{
            padding: Spacing.md,
            // Extra space when rest timer card is visible in the sticky footer.
            paddingBottom: activeWorkout.session?.restTimer?.isActive ? 220 : 120,
          }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
        {/* Header */}
        <View style={{ marginBottom: Spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.text} />
            </Pressable>
            <Text style={{ ...Typography.section, fontWeight: "900" }}>Log Session</Text>
            {/* Timer badge — driven by context (survives app reopen) */}
            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: Radius.pill,
                backgroundColor: Colors.card,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  ...Typography.secondary,
                  color: Colors.primary,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatElapsedForTimer(activeWorkout.elapsedSeconds)}
              </Text>
            </View>
          </View>

          <Text style={{ ...Typography.title, fontSize: 22, marginTop: Spacing.sm }}>{plan.name}</Text>
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 4 }}>
            {(authUser?.firstName || authUser?.lastName
              ? `${authUser?.firstName ?? ""} ${authUser?.lastName ?? ""}`.trim()
              : "You") +
              " • " +
              new Date().toLocaleDateString(undefined, { weekday: "short" })}
          </Text>
        </View>

        {/* Session notes */}
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.lg,
            padding: Spacing.md,
            marginBottom: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>
            Session notes
          </Text>
          <TextInput
            value={sessionNotes}
            onChangeText={handleNotesChange}
            placeholder="Add session notes..."
            placeholderTextColor={Colors.textMuted}
            multiline
            style={{
              borderWidth: 1,
              borderColor: Colors.border,
              padding: 12,
              borderRadius: Radius.md,
              color: Colors.text,
              backgroundColor: Colors.surface,
              minHeight: 72,
            }}
          />
        </View>

        {/* Exercise rows */}
        {plan.exercises.map((exercise, exIdx) => {
          const draft = drafts[exIdx];
          const sets = draft?.sets ?? [];
          const targetParts: string[] = [];
          targetParts.push(`${exercise.sets} sets x ${exercise.reps} reps`);
          if (exercise.weight != null && Number.isFinite(Number(exercise.weight))) {
            targetParts.push(`@ ${exercise.weight}kg`);
          }
          if (exercise.rpe != null) targetParts.push(`RPE ${exercise.rpe}`);

          return (
            <View
              key={`${exercise.name}-${exIdx}`}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: Radius.lg,
                padding: 14,
                marginBottom: Spacing.sm,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ ...Typography.secondary, color: Colors.primary, fontWeight: "800" }}>
                    {exIdx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...Typography.section, fontWeight: "900" }}>{exercise.name}</Text>
                  <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginTop: 2 }}>
                    Target: {targetParts.join(" ")}
                  </Text>
                  {exercise.coachNote ? (
                    <Text style={{ ...Typography.secondary, color: Colors.primary, marginTop: 2 }}>
                      Coach: {exercise.coachNote}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Set table header */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                  marginBottom: Spacing.xs,
                }}
              >
                <Text style={{ width: 32, ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  Set
                </Text>
                <Text style={{ flex: 1, ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  Kg
                </Text>
                <Text style={{ flex: 1, ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  Reps
                </Text>
                <Text style={{ flex: 1, ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  RPE
                </Text>
                <Text style={{ width: 34, ...Typography.secondary, color: Colors.textMuted, textAlign: "center" }}>
                  ✓
                </Text>
              </View>

              {sets.map((setDraft, setIdx) => {
                const done = setDraft.done === true;
                return (
                  <View
                    key={`set-${exIdx}-${setIdx}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 6,
                      borderRadius: Radius.md,
                      backgroundColor: done ? "rgba(212,255,68,0.10)" : "transparent",
                      borderWidth: 1,
                      borderColor: done ? "rgba(212,255,68,0.45)" : "rgba(255,255,255,0.08)",
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        width: 32,
                        ...Typography.section,
                        fontSize: 14,
                        color: done ? Colors.primary : Colors.text,
                        textAlign: "center",
                      }}
                    >
                      {setIdx + 1}
                    </Text>
                    <TextInput
                      ref={(r) => {
                        inputRefs.current[exIdx] = inputRefs.current[exIdx] ?? [];
                        inputRefs.current[exIdx][setIdx] = inputRefs.current[exIdx][setIdx] ?? {
                          weight: null,
                          reps: null,
                          rpe: null,
                        };
                        inputRefs.current[exIdx][setIdx].weight = r;
                      }}
                      value={setDraft.weight}
                      onChangeText={(v) => updateSet(exIdx, setIdx, { weight: normalizeDecimalInput(v) })}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textMuted}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: Radius.sm,
                        color: Colors.text,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        textAlign: "center",
                      }}
                    />
                    <TextInput
                      ref={(r) => {
                        inputRefs.current[exIdx] = inputRefs.current[exIdx] ?? [];
                        inputRefs.current[exIdx][setIdx] = inputRefs.current[exIdx][setIdx] ?? {
                          weight: null,
                          reps: null,
                          rpe: null,
                        };
                        inputRefs.current[exIdx][setIdx].reps = r;
                      }}
                      value={setDraft.reps}
                      onChangeText={(v) => updateSet(exIdx, setIdx, { reps: v.replace(/[^\d]/g, "") })}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: Radius.sm,
                        color: Colors.text,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        textAlign: "center",
                      }}
                    />
                    <TextInput
                      ref={(r) => {
                        inputRefs.current[exIdx] = inputRefs.current[exIdx] ?? [];
                        inputRefs.current[exIdx][setIdx] = inputRefs.current[exIdx][setIdx] ?? {
                          weight: null,
                          reps: null,
                          rpe: null,
                        };
                        inputRefs.current[exIdx][setIdx].rpe = r;
                      }}
                      value={setDraft.rpe}
                      onChangeText={(v) => updateSet(exIdx, setIdx, { rpe: normalizeDecimalInput(v) })}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={Colors.textMuted}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: Radius.sm,
                        color: Colors.text,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        textAlign: "center",
                      }}
                    />
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Complete set ${setIdx + 1}`}
                      onPress={() => {
                        const nextDone = !done;
                        updateSet(exIdx, setIdx, { done: nextDone });
                        if (nextDone) {
                          const next = getNextSetFocus(exIdx, setIdx, plan);
                          if (next) {
                            setTimeout(() => {
                              inputRefs.current?.[next.ex]?.[next.set]?.weight?.focus?.();
                            }, 80);
                          }
                        }
                      }}
                      style={({ pressed }) => ({
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: done ? "rgba(212,255,68,0.55)" : "rgba(255,255,255,0.10)",
                        backgroundColor: done ? Colors.primary : "rgba(255,255,255,0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={done ? Colors.onPrimary : "rgba(255,255,255,0.20)"}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        })}

        {error ? (
          <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
        ) : null}
        {message ? (
          <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Sticky footer — rest timer card (when active) + finish button */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: Spacing.md,
          paddingBottom: Spacing.md,
          paddingTop: Spacing.sm,
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        <RestTimerBar />
        {saving ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <PrimaryButton title="Finish Session" onPress={handleSubmit} />
        )}
      </View>
    </ScreenLayout>
  );
}
