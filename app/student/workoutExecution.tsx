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
import {
  formatElapsedForTimer,
} from "../../utils/workoutDuration";

type SetDraft = { weight: string; reps: string; rpe: string; done: boolean };
type ExerciseDraft = { sets: SetDraft[] };

function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeDecimalInput(text: string): string {
  // Keep it permissive while typing (allow "7.", ".", "0.5"), but strip invalid chars.
  let t = text.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = t.indexOf(".");
  if (firstDot >= 0) {
    t = t.slice(0, firstDot + 1) + t.slice(firstDot + 1).replace(/\./g, "");
  }
  if (t.startsWith(".")) t = `0${t}`;
  return t;
}

function getNextSetFocus(exIdx: number, setIdx: number, plan: WorkoutPlan): { ex: number; set: number } | null {
  const nSets = Math.max(1, Number(plan.exercises[exIdx]?.sets) || 1);
  if (setIdx + 1 < nSets) return { ex: exIdx, set: setIdx + 1 };
  if (exIdx + 1 < plan.exercises.length) return { ex: exIdx + 1, set: 0 };
  return null;
}

export default function WorkoutExecution() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const authUserId = authUser?.id;
  const authUserRole = authUser?.role;
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(
    () => String(params.workoutPlanId ?? "").trim(),
    [params]
  );

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [priorLogs, setPriorLogs] = useState<WorkoutLog[]>([]);
  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Wall-clock start when workout is ready (after plan loads). */
  const sessionStartMsRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const planRef = useRef<WorkoutPlan | null>(null);
  const draftsRef = useRef<ExerciseDraft[]>([]);
  planRef.current = plan;
  draftsRef.current = drafts;

  // Refs for focusing next row inputs: [exIdx][setIdx] -> { weight, reps, rpe }
  const inputRefs = useRef<
    { weight: TextInput | null; reps: TextInput | null; rpe: TextInput | null }[][]
  >([]);

  useEffect(() => {
    const load = async () => {
      console.log("[student/workoutExecution] load start", { workoutPlanId });
      setLoading(true);
      try {
        setError(null);
        setMessage(null);
        setPlan(null);

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
        setDrafts(
          loaded.exercises.map((ex) => ({
            sets: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({
              weight:
                ex.weight != null && Number.isFinite(Number(ex.weight))
                  ? String(ex.weight)
                  : "",
              reps: "",
              rpe: ex.rpe != null && Number.isFinite(Number(ex.rpe)) ? String(ex.rpe) : "",
              done: false,
            })),
          }))
        );
        setSessionNotes("");
      } catch (e: any) {
        console.error("[student/workoutExecution] load error", e);
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, authUserId, authUserRole]);

  // Session timer: starts when plan is ready; 1s tick; cleared on unmount or plan change.
  useEffect(() => {
    const planId = plan?.id;
    if (!planId) {
      sessionStartMsRef.current = null;
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    sessionStartMsRef.current = start;
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [plan?.id]);

  const bestWeightByExercise = useMemo(
    () => buildBestWeightMapFromLogs(priorLogs),
    [priorLogs]
  );

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetDraft>) => {
    setDrafts((prev) =>
      prev.map((row, i) =>
        i !== exIdx
          ? row
          : {
              sets: row.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })),
            }
      )
    );
  };

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

          return {
            setNumber: si + 1,
            reps: r,
            weight: weightOut,
          };
        });

        const exKey = normalizeExerciseName(exercise.name);
        const prevBest = bestWeightByExercise.get(exKey);
        const maxKg = Math.max(
          0,
          ...loggedSets
            .filter((s) => s.reps > 0)
            .map((s) => (s.weight != null && Number.isFinite(s.weight) ? s.weight : 0))
        );
        const isPr =
          maxKg > 0 && (prevBest === undefined || maxKg > prevBest);

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

      const started = sessionStartMsRef.current;
      const durationSeconds =
        started != null ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;

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

      if (prNames.length > 0) {
        Alert.alert("Great session!", `🔥 New PR on: ${prNames.join(", ")}`);
      }
      setMessage("Workout saved to history.");
      router.replace("/student/workoutHistory");
    } catch (e: any) {
      console.error("[student/workoutExecution] submit error", e);
      setError(e.message ?? "Failed to save workout.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.bg,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !plan) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: Spacing.md,
          backgroundColor: Colors.bg,
        }}
      >
        <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>
          Workout plan not loaded.
        </Text>
      </View>
    );
  }

  return (
    <ScreenLayout>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 120 }}
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
              <Text style={{ ...Typography.secondary, color: Colors.primary, fontVariant: ["tabular-nums"] }}>
                {formatElapsedForTimer(elapsedSeconds)}
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
          <Text style={{ ...Typography.secondary, color: Colors.textMuted, marginBottom: 6 }}>Session notes</Text>
          <TextInput
            value={sessionNotes}
            onChangeText={setSessionNotes}
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
                </View>
              </View>

              {/* Set table header */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                  borderRadius: Radius.md,
                  backgroundColor: "transparent",
                  marginBottom: Spacing.xs,
                }}
              >
                <Text
                  style={{
                    width: 32,
                    ...Typography.secondary,
                    color: Colors.textMuted,
                    textAlign: "center",
                  }}
                >
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
                              const ref = inputRefs.current?.[next.ex]?.[next.set]?.weight;
                              ref?.focus?.();
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
                        name={done ? "checkmark" : "checkmark"}
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

        {error ? <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text> : null}
        {message ? (
          <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Sticky footer */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: Spacing.md,
          backgroundColor: Colors.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        {saving ? <ActivityIndicator /> : <PrimaryButton title="Finish Session" onPress={handleSubmit} />}
      </View>
    </ScreenLayout>
  );
}
