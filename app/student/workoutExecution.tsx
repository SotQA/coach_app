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
import * as Haptics from "expo-haptics";
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
  parseRestSeconds,
} from "../../utils/workoutDuration";

type SetDraft = { reps: string; weight: string };
type ExerciseDraft = { sets: SetDraft[] };

function parseKgInput(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function setIsDone(d: SetDraft): boolean {
  const r = Number(d.reps.trim());
  if (!Number.isInteger(r) || r <= 0) return false;
  if (d.weight.trim() === "") return true;
  const w = parseKgInput(d.weight);
  return w !== null;
}

const REST_FALLBACK_SEC = 60;

function getNextSetFocus(
  exIdx: number,
  setIdx: number,
  plan: WorkoutPlan,
  drafts: ExerciseDraft[]
): { ex: number; set: number } | null {
  const nSets = drafts[exIdx]?.sets.length ?? 0;
  if (setIdx + 1 < nSets) return { ex: exIdx, set: setIdx + 1 };
  if (exIdx + 1 < plan.exercises.length) return { ex: exIdx + 1, set: 0 };
  return null;
}

export default function WorkoutExecution() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const params = useLocalSearchParams<{ workoutPlanId?: string }>();
  const workoutPlanId = useMemo(
    () => String(params.workoutPlanId ?? "").trim(),
    [params]
  );

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [priorLogs, setPriorLogs] = useState<WorkoutLog[]>([]);
  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [focus, setFocus] = useState<{ ex: number; set: number }>({ ex: 0, set: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** Wall-clock start when workout is ready (after plan loads). */
  const sessionStartMsRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  type RestPhase = "idle" | "running" | "paused";
  const [restPhase, setRestPhase] = useState<RestPhase>("idle");
  const [restRemainingSec, setRestRemainingSec] = useState(0);
  const restEndMsRef = useRef<number | null>(null);
  const restFinishFiredRef = useRef(false);
  const restAfterSetRef = useRef<{ ex: number; set: number } | null>(null);
  const prevDoneSetsRef = useRef<boolean[][] | null>(null);
  const prevFocusExRef = useRef(0);
  const planRef = useRef<WorkoutPlan | null>(null);
  const draftsRef = useRef<ExerciseDraft[]>([]);
  planRef.current = plan;
  draftsRef.current = drafts;

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

        if (!authUser || authUser.role !== "student") {
          setError("You must be logged in as a student.");
          return;
        }

        const loaded = await workoutService.getWorkoutPlanById(workoutPlanId);
        if (!loaded) {
          setError("Workout plan not found.");
          return;
        }

        if (loaded.studentId !== authUser.id) {
          setError("You don't have access to this workout plan.");
          return;
        }

        const history = await workoutService.getWorkoutHistory(authUser.id);
        setPriorLogs(Array.isArray(history) ? history : []);

        setPlan(loaded);
        setDrafts(
          loaded.exercises.map((ex) => ({
            sets: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, () => ({
              reps: "0",
              weight:
                ex.weight != null && Number.isFinite(Number(ex.weight))
                  ? String(ex.weight)
                  : "",
            })),
          }))
        );
        setFocus({ ex: 0, set: 0 });
      } catch (e: any) {
        console.error("[student/workoutExecution] load error", e);
        setError(e.message ?? "Failed to load workout plan.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutPlanId, authUser?.id, authUser?.role]);

  // Session timer: starts when plan is ready; 1s tick; cleared on unmount or plan change.
  useEffect(() => {
    if (!plan) {
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

  useEffect(() => {
    if (!plan?.id) return;
    restEndMsRef.current = null;
    restFinishFiredRef.current = false;
    restAfterSetRef.current = null;
    setRestPhase("idle");
    setRestRemainingSec(0);
    prevDoneSetsRef.current = null;
  }, [plan?.id]);

  useEffect(() => {
    if (!plan) return;
    const prev = prevFocusExRef.current;
    if (prev !== focus.ex) {
      restEndMsRef.current = null;
      restFinishFiredRef.current = false;
      restAfterSetRef.current = null;
      setRestPhase("idle");
      setRestRemainingSec(0);
    }
    prevFocusExRef.current = focus.ex;
  }, [plan, focus.ex]);

  useEffect(() => {
    if (!plan) return;
    const current = drafts.map((d) => d.sets.map(setIsDone));
    const prev = prevDoneSetsRef.current;
    if (!prev) {
      prevDoneSetsRef.current = current;
      return;
    }
    let newest: { ex: number; set: number } | null = null;
    for (let ex = 0; ex < current.length; ex++) {
      for (let s = 0; s < (current[ex]?.length ?? 0); s++) {
        if (current[ex][s] && !prev[ex]?.[s]) {
          newest = { ex, set: s };
        }
      }
    }
    prevDoneSetsRef.current = current;
    if (!newest) return;
    const sec = parseRestSeconds(plan.exercises[newest.ex]?.rest);
    if (sec == null || sec <= 0) return;
    restAfterSetRef.current = { ex: newest.ex, set: newest.set };
    restEndMsRef.current = Date.now() + sec * 1000;
    restFinishFiredRef.current = false;
    setRestRemainingSec(sec);
    setRestPhase("running");
  }, [drafts, plan]);

  useEffect(() => {
    if (restPhase !== "running" || restEndMsRef.current == null) return;
    restFinishFiredRef.current = false;
    const tick = () => {
      const end = restEndMsRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRestRemainingSec(left);
      if (left <= 0 && !restFinishFiredRef.current) {
        restFinishFiredRef.current = true;
        restEndMsRef.current = null;
        setRestPhase("idle");
        setRestRemainingSec(0);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const after = restAfterSetRef.current;
        restAfterSetRef.current = null;
        const p = planRef.current;
        const dr = draftsRef.current;
        if (after && p) {
          const next = getNextSetFocus(after.ex, after.set, p, dr);
          if (next) setFocus(next);
        }
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restPhase]);

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

  const defaultRestSecForFocus = useMemo(() => {
    if (!plan) return REST_FALLBACK_SEC;
    return parseRestSeconds(plan.exercises[focus.ex]?.rest) ?? REST_FALLBACK_SEC;
  }, [plan, focus.ex]);

  const displayRestSeconds =
    restPhase === "idle" && restRemainingSec === 0 ? defaultRestSecForFocus : restRemainingSec;

  const pauseRest = () => {
    if (restPhase !== "running") return;
    const end = restEndMsRef.current;
    const left =
      end != null ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : restRemainingSec;
    restEndMsRef.current = null;
    setRestRemainingSec(left);
    setRestPhase("paused");
  };

  const startOrResumeRest = () => {
    if (!plan) return;
    if (restPhase === "running") return;
    if (restPhase === "paused") {
      if (restRemainingSec <= 0) return;
      restEndMsRef.current = Date.now() + restRemainingSec * 1000;
      restFinishFiredRef.current = false;
      setRestPhase("running");
      return;
    }
    const seconds = parseRestSeconds(plan.exercises[focus.ex]?.rest) ?? REST_FALLBACK_SEC;
    if (seconds <= 0) return;
    restAfterSetRef.current = { ex: focus.ex, set: focus.set };
    restEndMsRef.current = Date.now() + seconds * 1000;
    restFinishFiredRef.current = false;
    setRestRemainingSec(seconds);
    setRestPhase("running");
  };

  const resetRestTimer = () => {
    if (!plan) return;
    restEndMsRef.current = null;
    restFinishFiredRef.current = false;
    const seconds = parseRestSeconds(plan.exercises[focus.ex]?.rest) ?? REST_FALLBACK_SEC;
    setRestRemainingSec(seconds);
    setRestPhase("paused");
  };

  const skipRest = () => {
    if (!plan) return;
    const anchor = restAfterSetRef.current ?? { ex: focus.ex, set: focus.set };
    restEndMsRef.current = null;
    restFinishFiredRef.current = false;
    restAfterSetRef.current = null;
    setRestPhase("idle");
    const next = getNextSetFocus(anchor.ex, anchor.set, plan, drafts);
    if (next) {
      setFocus(next);
      setRestRemainingSec(
        parseRestSeconds(plan.exercises[next.ex]?.rest) ?? REST_FALLBACK_SEC
      );
    } else {
      setRestRemainingSec(
        parseRestSeconds(plan.exercises[focus.ex]?.rest) ?? REST_FALLBACK_SEC
      );
    }
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
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
      >
        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: 16,
            marginBottom: Spacing.md,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.sm,
              paddingBottom: Spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="time-outline" size={22} color={Colors.primary} />
              <Text style={{ ...Typography.section, color: Colors.textMuted }}>Workout Time</Text>
            </View>
            <Text
              style={{
                fontVariant: ["tabular-nums"],
                fontSize: 22,
                fontWeight: "700",
                color: Colors.text,
              }}
            >
              {formatElapsedForTimer(elapsedSeconds)}
            </Text>
          </View>
          <Text style={{ ...Typography.title, fontSize: 20, marginBottom: 4 }}>Workout Execution</Text>
          <Text style={Typography.secondary}>Log each set: reps and weight (optional for bodyweight).</Text>
        </View>

        <View
          style={{
            backgroundColor: Colors.card,
            borderRadius: Radius.md,
            padding: 16,
            marginBottom: Spacing.md,
            borderWidth: restPhase === "running" ? 2 : 1,
            borderColor: restPhase === "running" ? Colors.primary : Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: Spacing.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="hourglass-outline" size={22} color={Colors.primary} />
              <Text style={{ ...Typography.section, color: Colors.textMuted }}>Rest</Text>
            </View>
            <Text
              style={{
                fontVariant: ["tabular-nums"],
                fontSize: 22,
                fontWeight: "700",
                color: restPhase === "running" ? Colors.success : Colors.text,
              }}
            >
              {formatElapsedForTimer(displayRestSeconds)}
            </Text>
          </View>
          <Text style={{ ...Typography.secondary, fontSize: 12, marginBottom: Spacing.sm }}>
            {restPhase === "running"
              ? "Time remaining until next set."
              : restPhase === "paused"
                ? "Paused — Start to resume."
                : `Idle — target ${defaultRestSecForFocus}s for the focused exercise, or complete a set to auto-start.`}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={startOrResumeRest}
              disabled={restPhase === "running" || (restPhase === "paused" && restRemainingSec <= 0)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor:
                  restPhase === "running" || (restPhase === "paused" && restRemainingSec <= 0)
                    ? Colors.border
                    : Colors.primary,
                opacity:
                  restPhase === "running" || (restPhase === "paused" && restRemainingSec <= 0) ? 0.45 : 1,
                backgroundColor: Colors.surface,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: "600", fontSize: 13 }}>
                {restPhase === "paused" ? "Resume" : "Start"}
              </Text>
            </Pressable>
            <Pressable
              onPress={pauseRest}
              disabled={restPhase !== "running"}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: restPhase !== "running" ? Colors.border : Colors.primary,
                opacity: restPhase !== "running" ? 0.45 : 1,
                backgroundColor: Colors.surface,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: "600", fontSize: 13 }}>Pause</Text>
            </Pressable>
            <Pressable
              onPress={resetRestTimer}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: Colors.primary,
                backgroundColor: Colors.surface,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: "600", fontSize: 13 }}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={skipRest}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: Colors.primary,
                backgroundColor: Colors.surface,
              }}
            >
              <Text style={{ color: Colors.text, fontWeight: "600", fontSize: 13 }}>Skip</Text>
            </Pressable>
          </View>
        </View>

        {plan.exercises.map((exercise, exIdx) => {
          const draft = drafts[exIdx];
          const sets = draft?.sets ?? [];
          const prev = bestWeightByExercise.get(normalizeExerciseName(exercise.name));
          const maxDraftKg = Math.max(
            0,
            ...sets.map((s) => parseKgInput(s.weight) ?? 0)
          );
          const showPrHint = maxDraftKg > 0 && (prev === undefined || maxDraftKg > prev);

          const metaParts: string[] = [];
          if (exercise.rest && exercise.rest.trim() !== "") metaParts.push(`Rest: ${exercise.rest}s`);
          if (exercise.tempo && exercise.tempo.trim() !== "") metaParts.push(`Tempo: ${exercise.tempo}`);
          if (exercise.rpe !== null && exercise.rpe !== undefined) metaParts.push(`RPE: ${exercise.rpe}`);

          return (
            <View
              key={`${exercise.name}-${exIdx}`}
              style={{
                backgroundColor: Colors.surface,
                borderRadius: Radius.md,
                padding: Spacing.md,
                marginBottom: Spacing.sm,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ ...Typography.section, marginBottom: 6 }}>{exercise.name}</Text>
              <Text style={{ ...Typography.secondary, marginBottom: Spacing.xs }}>
                Planned: {exercise.sets} x {exercise.reps}
              </Text>
              {exercise.weight != null && Number.isFinite(exercise.weight) ? (
                <Text style={{ ...Typography.secondary, marginBottom: Spacing.sm }}>
                  Target weight: {exercise.weight} kg
                </Text>
              ) : null}
              {metaParts.length ? (
                <Text style={{ ...Typography.secondary, marginBottom: Spacing.md }}>{metaParts.join(" • ")}</Text>
              ) : null}

              {sets.map((setDraft, setIdx) => {
                const active = focus.ex === exIdx && focus.set === setIdx;
                const done = setIsDone(setDraft);
                return (
                  <Pressable
                    key={`set-${exIdx}-${setIdx}`}
                    onPress={() => setFocus({ ex: exIdx, set: setIdx })}
                    style={{
                      marginBottom: Spacing.sm,
                      padding: Spacing.sm,
                      borderRadius: Radius.sm,
                      borderWidth: active ? 3 : 2,
                      borderColor: active ? Colors.primary : Colors.border,
                      backgroundColor: active ? Colors.card : "transparent",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: Spacing.xs,
                      }}
                    >
                      <Text style={{ ...Typography.section, fontSize: 15 }}>Set {setIdx + 1}</Text>
                      {done ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                          <Text style={{ color: Colors.success, fontSize: 13 }}>Done</Text>
                        </View>
                      ) : (
                        <Text style={{ ...Typography.secondary, fontSize: 12 }}>Log reps to complete</Text>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.secondary, marginBottom: 4, fontSize: 12 }}>Reps</Text>
                        <TextInput
                          value={setDraft.reps}
                          onChangeText={(v) => updateSet(exIdx, setIdx, { reps: v.replace(/[^\d]/g, "") })}
                          onFocus={() => setFocus({ ex: exIdx, set: setIdx })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textMuted}
                          style={{
                            borderWidth: 1,
                            borderColor: Colors.border,
                            padding: 10,
                            borderRadius: Radius.sm,
                            color: Colors.text,
                            backgroundColor: Colors.surface,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...Typography.secondary, marginBottom: 4, fontSize: 12 }}>
                          Weight (kg)
                        </Text>
                        <TextInput
                          value={setDraft.weight}
                          onChangeText={(v) => updateSet(exIdx, setIdx, { weight: v })}
                          onFocus={() => setFocus({ ex: exIdx, set: setIdx })}
                          keyboardType="decimal-pad"
                          placeholder="Optional"
                          placeholderTextColor={Colors.textMuted}
                          style={{
                            borderWidth: 1,
                            borderColor: Colors.border,
                            padding: 10,
                            borderRadius: Radius.sm,
                            color: Colors.text,
                            backgroundColor: Colors.surface,
                          }}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {showPrHint ? (
                <Text style={{ color: Colors.success, marginTop: Spacing.xs, fontWeight: "600" }}>
                  🔥 New PR!
                </Text>
              ) : null}
            </View>
          );
        })}

        {error ? <Text style={{ color: Colors.danger, marginBottom: Spacing.sm }}>{error}</Text> : null}
        {message ? (
          <Text style={{ color: Colors.success, marginBottom: Spacing.sm }}>{message}</Text>
        ) : null}
        {saving ? <ActivityIndicator /> : <PrimaryButton title="Complete Workout" onPress={handleSubmit} />}
      </KeyboardAwareScrollView>
    </ScreenLayout>
  );
}
